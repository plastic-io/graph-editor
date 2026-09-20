import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { describeOrigin, mergeUpdates, UPDATE_FORMAT } from "@plastic-io/graph-crdt";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
import { useStore as useOrchestratorStore } from "@plastic-io/graph-editor-vue3-orchestrator";
import { useStore as usePreferencesStore } from "@plastic-io/graph-editor-vue3-preferences-provider";
import {
  appendUpdate,
  listHistory,
  updatesUpTo,
  clearHistory,
  type HistoryListing,
} from "./historyStore";

const DOC_PREFIX = "plastic-io-graph-";

/**
 * How long consecutive changes of the same kind are gathered before being
 * written to the log as one entry.
 *
 * Typing in a code editor produces a document update per keystroke, and a drag
 * produces one per frame.  Logging each of those separately would give rewind
 * a timeline of hundreds of indistinguishable steps, so they are merged into
 * the single action a person would recognise.
 */
const LOG_COALESCE_MS = 800;
/** Never gather more than this many updates into one entry. */
const LOG_MAX_BATCH = 200;

export class IndexedDBCrdtProvider {
  readonly name = "indexeddb";
  /** Only holds what this browser saw, so the server's log wins when present. */
  readonly historyPriority = 1;
  private persistence: IndexeddbPersistence | null = null;
  private detach: (() => void) | null = null;
  private graphId = "";
  private pending: { description: string; updates: Uint8Array[] } | null = null;
  private flushTimer: any = null;
  /** Writes are chained so entries land in the order they happened. */
  private writeQueue: Promise<void> = Promise.resolve();
  private userId = "local";

  async connect(graphId: string, session: any): Promise<void> {
    this.graphId = graphId;
    this.persistence = new IndexeddbPersistence(DOC_PREFIX + graphId, session.doc);
    await this.persistence.whenSynced;

    const preferences = usePreferencesStore();
    this.userId = (preferences.preferences && preferences.preferences.userId) || "local";
    this.detach = session.onUpdate((update: Uint8Array, origin: any) => {
      // Updates replayed out of this very log would double it in size on
      // every reload, so only genuinely new work is recorded.
      if (origin && origin.source === "indexeddb") {
        return;
      }
      this.record(update, describeOrigin(origin));
    });
  }

  /** Gather a change into the current log entry, opening one if needed. */
  private record(update: Uint8Array, description: string) {
    if (this.pending && this.pending.description !== description) {
      this.flushLog();
    }
    if (!this.pending) {
      this.pending = { description, updates: [] };
    }
    this.pending.updates.push(update);
    if (this.pending.updates.length >= LOG_MAX_BATCH) {
      this.flushLog();
      return;
    }
    clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.flushLog(), LOG_COALESCE_MS);
  }

  /** Write the gathered changes as one entry. */
  private flushLog() {
    clearTimeout(this.flushTimer);
    this.flushTimer = null;
    const pending = this.pending;
    this.pending = null;
    if (!pending || pending.updates.length === 0) {
      return;
    }
    const record = {
      graphId: this.graphId,
      time: Date.now(),
      description: pending.description,
      userId: this.userId,
      format: UPDATE_FORMAT,
      update: mergeUpdates(pending.updates),
    };
    this.writeQueue = this.writeQueue
      .then(() => appendUpdate(record))
      .catch((err) => {
        console.warn("Cannot append to the local history log.", err);
      });
  }

  async history(graphId: string): Promise<HistoryListing[]> {
    // Anything still being gathered belongs in the timeline being asked for.
    this.flushLog();
    await this.writeQueue;
    return listHistory(graphId);
  }

  /** Every update needed to rebuild the graph as of `entry`. */
  async updatesFor(graphId: string, entry: { seq: number }): Promise<Uint8Array[]> {
    this.flushLog();
    await this.writeQueue;
    return updatesUpTo(graphId, entry.seq, UPDATE_FORMAT);
  }

  /** Drop the stored document and its log when a graph is deleted. */
  async remove(graphId: string): Promise<void> {
    await clearHistory(graphId);
    const scratch = new Y.Doc();
    const persistence = new IndexeddbPersistence(DOC_PREFIX + graphId, scratch);
    await persistence.clearData();
    scratch.destroy();
  }

  disconnect() {
    // Whatever was still being gathered belongs to the graph being left.
    this.flushLog();
    if (this.detach) {
      this.detach();
      this.detach = null;
    }
    if (this.persistence) {
      this.persistence.destroy();
      this.persistence = null;
    }
  }
}

export default class IndexedDBCrdtProviderModule extends EditorModule {
  constructor(config: Record<string, any>) {
    super();
    useOrchestratorStore().syncProviders.push(new IndexedDBCrdtProvider());
  }
}
