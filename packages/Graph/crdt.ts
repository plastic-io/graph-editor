import * as Y from "yjs";
import {
  fromJSON,
  toJSON,
  reconcile,
  isEmpty,
  ROOT_KEY,
  LocalOrigin,
  RemoteOrigin,
  UPDATE_EVENT,
  applyUpdate,
  mergeUpdates,
  documentSize,
} from "@plastic-io/graph-crdt";
import { newId } from "@plastic-io/graph-editor-vue3-utils";

/**
 * How long to let text edits accumulate before rebuilding the plain-JSON
 * projection.  Code editors are bound to the document directly, so nothing on
 * screen is waiting on this; the only consumer is the node recompile, which is
 * debounced further still.
 */
const TEXT_PROJECTION_DEBOUNCE = 300;

/**
 * How many actions stay undoable.
 *
 * This is not only a product decision.  Yjs garbage collects the contents of
 * deleted items, but an UndoManager pins everything inside its scope so that it
 * can put it back, which stops collection entirely.  An unbounded undo history
 * therefore means an unbounded document: ten thousand create-and-delete events
 * on a three hundred node graph produced 1.8MB pinned, against 250KB once the
 * history is bounded and the dropped entries are released.
 */
const MAX_UNDO_STEPS = 200;

/**
 * Dropped history entries to accumulate before running a collection pass.
 * Collection walks the whole document, so it is worth batching.
 */
const COLLECT_AFTER_DROPPED = 50;

export interface HistoryEvent {
  id: string;
  description: string;
  time: number;
}

export interface ProjectionInfo {
  /** True when this change came from something the local user did. */
  local: boolean;
  /** True when it came from undo or redo rather than a fresh edit. */
  fromUndo: boolean;
  origin: any;
}

type ProjectionListener = (projection: any, info: ProjectionInfo) => void;
type HistoryListener = (events: HistoryEvent[], position: number) => void;
type UpdateListener = (update: Uint8Array, origin: any) => void;

/**
 * Owns the Yjs document for one open graph and translates between it and the
 * editor's plain-JSON world.
 *
 * The editor's several dozen mutation actions all work by mutating a plain
 * JavaScript snapshot and then asking for it to be saved.  Rather than rewrite
 * every one of them, `commit` takes that snapshot and reconciles it into the
 * document, which turns "here is what the graph should look like now" into the
 * granular CRDT operations that merge correctly against other people's edits.
 */
export class GraphCrdtSession {
  readonly graphId: string;
  readonly doc: Y.Doc;
  readonly undoManager: Y.UndoManager;

  /** Which continuous gesture, if any, is currently writing. */
  private activeBatch: string | null = null;
  /** How many actions stay undoable.  See MAX_UNDO_STEPS. */
  readonly maxUndoSteps: number;
  private droppedHistory: any[] = [];
  private projectionTimer: any = null;
  private pendingProjectionOrigin: any = null;
  private projectionListeners = new Set<ProjectionListener>();
  private historyListeners = new Set<HistoryListener>();
  private updateListeners = new Set<UpdateListener>();
  private destroyed = false;

  constructor(graphId: string, options: { maxUndoSteps?: number } = {}) {
    this.graphId = graphId;
    this.maxUndoSteps = options.maxUndoSteps ?? MAX_UNDO_STEPS;
    this.doc = new Y.Doc({ guid: graphId });

    this.undoManager = new Y.UndoManager(this.doc.getMap(ROOT_KEY), {
      // Only the local user's own edits are undoable.  Remote edits, storage
      // loads and network sync all use other origins and stay out of the way.
      trackedOrigins: new Set([LocalOrigin]),
      // Every discrete action explicitly closes its own undo step, so this
      // window only governs continuous gestures.  It is generous so that a
      // drag with a pause in the middle still undoes as one movement.
      captureTimeout: 3000,
    });

    this.undoManager.on("stack-item-added", (event: any) => {
      const origin = event.origin;
      const meta = event.stackItem.meta;
      if (origin instanceof LocalOrigin) {
        meta.set("description", origin.description || "Change");
        meta.set("time", Date.now());
        meta.set("id", newId());
        this.emitHistory();
        return;
      }
      // Undoing or redoing moves an action to the opposite stack, and Yjs
      // builds a brand new stack item for it with no metadata.  The action it
      // came from is the one the manager is currently applying, so its label
      // travels with it and the history panel keeps reading the same names.
      const source = this.undoManager.currStackItem as any;
      const sourceMeta = source && source.meta;
      meta.set("description", (sourceMeta && sourceMeta.get("description")) || "Change");
      meta.set("time", (sourceMeta && sourceMeta.get("time")) || Date.now());
      meta.set("id", (sourceMeta && sourceMeta.get("id")) || newId());
      this.emitHistory();
    });

    this.undoManager.on("stack-item-added", () => this.trimUndoHistory());
    this.undoManager.on("stack-item-popped", () => this.emitHistory());
    this.undoManager.on("stack-cleared", () => this.emitHistory());

    // Updates are taken in the project's own format.  A Y.Doc emits both
    // encodings for the same transaction, so a provider that speaks the other
    // one, such as y-indexeddb, keeps working untouched.
    this.doc.on(UPDATE_EVENT as any, (update: Uint8Array, origin: any) => {
      if (this.destroyed) {
        return;
      }
      this.updateListeners.forEach((listener) => listener(update, origin));
    });

    this.doc.on("afterTransaction", (transaction: any) => {
      if (this.destroyed || transaction.changedParentTypes.size === 0) {
        return;
      }
      // Typing in a code editor produces a transaction per keystroke, and
      // rebuilding the whole graph projection that often would be wasteful:
      // the editor is bound to the text directly, so nothing on screen is
      // waiting for it.  Structural changes still land immediately.
      //
      // `changed` holds the types that were written to.  `changedParentTypes`
      // would be the wrong thing to look at, because it also carries every
      // ancestor so that deep observers fire, which means it always reaches
      // the root map.
      const written = Array.from(transaction.changed.keys());
      const textOnly =
        written.length > 0 && written.every((type: any) => type instanceof Y.Text);
      if (textOnly) {
        this.scheduleProjection(transaction.origin);
        return;
      }
      this.cancelScheduledProjection();
      this.emitProjection(transaction.origin);
    });
  }

  /* -------------------------------------------------- lifecycle */

  /** Populate an empty document from legacy JSON.  A no-op otherwise. */
  seed(graph: Record<string, any>, source = "seed"): boolean {
    if (!isEmpty(this.doc)) {
      return false;
    }
    // Wrapping the build in an outer transaction gives the whole seed a single
    // origin, which keeps it out of the undo stack and lets the history log
    // label it as the start of the graph rather than a remote edit.
    this.doc.transact(() => {
      fromJSON(graph, this.doc);
    }, new RemoteOrigin(source));
    return true;
  }

  /* -------------------------------------------------- history size */

  /**
   * Drop the oldest undoable actions once the history is longer than we keep,
   * and let go of what they were holding on to.
   */
  private trimUndoHistory() {
    const excess = this.undoManager.undoStack.length - this.maxUndoSteps;
    if (excess > 0) {
      this.droppedHistory.push(...this.undoManager.undoStack.splice(0, excess));
    }
    if (this.droppedHistory.length >= COLLECT_AFTER_DROPPED) {
      this.collectDroppedHistory();
    }
  }

  /**
   * Release the items that dropped history entries were pinning, then collect
   * them.
   *
   * Yjs collects deleted content when the transaction that deleted it is
   * cleaned up, and skips anything an UndoManager has marked to keep.  Once we
   * have decided an action is too old to undo, its claim has to be released and
   * the collection re-run, or the content stays in the document forever.
   *
   * `keep` and the walk up to the parent are Yjs internals.  A failure here
   * costs space, never correctness, so it is contained.
   */
  private collectDroppedHistory() {
    const dropped = this.droppedHistory;
    this.droppedHistory = [];
    if (dropped.length === 0) {
      return;
    }
    try {
      const release = (transaction: any, deleteSet: any) => {
        Y.iterateDeletedStructs(transaction, deleteSet, (struct: any) => {
          let item = struct;
          while (item && item.keep) {
            item.keep = false;
            item = item.parent && item.parent._item;
          }
        });
      };
      // A plain origin, so the undo manager does not treat this as an edit.
      Y.transact(
        this.doc,
        (transaction: any) => {
          dropped.forEach((stackItem: any) => {
            release(transaction, stackItem.deletions);
            release(transaction, stackItem.insertions);
          });
        },
        new RemoteOrigin("history-trim"),
      );
      Y.tryGc(Y.createDeleteSetFromStructStore(this.doc.store), this.doc.store, () => true);
    } catch (err) {
      console.warn("Cannot release old undo history; the document will keep it.", err);
    }
  }

  /** Bytes this document would take to send to a peer that has nothing. */
  get byteLength(): number {
    return documentSize(this.doc);
  }

  destroy() {
    this.destroyed = true;
    this.cancelScheduledProjection();
    this.projectionListeners.clear();
    this.historyListeners.clear();
    this.updateListeners.clear();
    this.undoManager.destroy();
    this.doc.destroy();
  }

  /* -------------------------------------------------- reading */

  get isEmpty(): boolean {
    return isEmpty(this.doc);
  }

  projection(): any | null {
    return toJSON(this.doc);
  }

  /* -------------------------------------------------- writing */

  /**
   * Save `snapshot` as the new state of the graph, described by
   * `description` for the history panel.  Returns true when something
   * actually changed.
   */
  commit(description: string, snapshot: Record<string, any>): boolean {
    // One commit is one undo step, which is what the pre-CRDT editor did.
    this.activeBatch = null;
    this.undoManager.stopCapturing();
    return reconcile(this.doc, snapshot, new LocalOrigin(description));
  }

  /**
   * Save `snapshot` while allowing consecutive commits that share
   * `batchKey` to collapse into a single undo step.  Used by continuous
   * gestures such as dragging a node.
   */
  commitBatched(description: string, batchKey: string, snapshot: Record<string, any>): boolean {
    this.openBatch(batchKey);
    return reconcile(this.doc, snapshot, new LocalOrigin(description, batchKey));
  }

  /** Apply a binary update that arrived from storage or from a peer. */
  applyRemote(update: Uint8Array, source: string) {
    applyUpdate(this.doc, update, new RemoteOrigin(source));
  }

  /** Run `fn` as one local transaction, for direct writes to Y types. */
  transactLocal(description: string, fn: (root: Y.Map<any>) => void, batchKey?: string) {
    this.openBatch(batchKey || null);
    this.doc.transact(() => {
      fn(this.doc.getMap(ROOT_KEY));
    }, new LocalOrigin(description, batchKey || null));
  }

  /**
   * Start a new undo step unless we are already inside the same gesture.
   * Without this the first frame of a drag would fold into whatever action
   * came before it, and undoing the drag would undo that too.
   */
  private openBatch(batchKey: string | null) {
    if (batchKey && batchKey === this.activeBatch) {
      return;
    }
    this.undoManager.stopCapturing();
    this.activeBatch = batchKey;
  }

  /**
   * Close off a continuous gesture.  Yjs merges changes inside its capture
   * window into one undo step, so this just makes sure the next action starts
   * a fresh one rather than joining the gesture.
   */
  endLiveEdit() {
    this.activeBatch = null;
    this.undoManager.stopCapturing();
  }

  /* -------------------------------------------------- history */

  undo(): boolean {
    return this.undoManager.undo() !== null;
  }

  redo(): boolean {
    return this.undoManager.redo() !== null;
  }

  /** Move `delta` steps through the undo history. */
  move(delta: number) {
    let remaining = Math.abs(delta);
    while (remaining > 0) {
      const moved = delta < 0 ? this.undo() : this.redo();
      if (!moved) {
        break;
      }
      remaining -= 1;
    }
  }

  get historyPosition(): number {
    return this.undoManager.undoStack.length;
  }

  /**
   * The full history in chronological order.  Everything before
   * `historyPosition` has been applied, everything at or after it has been
   * undone and can be redone.
   */
  historyEvents(): HistoryEvent[] {
    const read = (stackItem: any): HistoryEvent => ({
      id: stackItem.meta.get("id") || newId(),
      description: stackItem.meta.get("description") || "Change",
      time: stackItem.meta.get("time") || 0,
    });
    return [
      ...this.undoManager.undoStack.map(read),
      ...[...this.undoManager.redoStack].reverse().map(read),
    ];
  }

  /* -------------------------------------------------- events */

  onProjection(listener: ProjectionListener): () => void {
    this.projectionListeners.add(listener);
    return () => this.projectionListeners.delete(listener);
  }

  onHistory(listener: HistoryListener): () => void {
    this.historyListeners.add(listener);
    return () => this.historyListeners.delete(listener);
  }

  onUpdate(listener: UpdateListener): () => void {
    this.updateListeners.add(listener);
    return () => this.updateListeners.delete(listener);
  }

  /** Force listeners to re-read, used after the initial load. */
  refresh() {
    this.cancelScheduledProjection();
    this.emitProjection(new RemoteOrigin("refresh"));
    this.emitHistory();
  }

  private scheduleProjection(origin: any) {
    this.pendingProjectionOrigin = origin;
    if (this.projectionTimer) {
      return;
    }
    this.projectionTimer = setTimeout(() => {
      this.projectionTimer = null;
      const pending = this.pendingProjectionOrigin;
      this.pendingProjectionOrigin = null;
      this.emitProjection(pending);
    }, TEXT_PROJECTION_DEBOUNCE);
  }

  private cancelScheduledProjection() {
    if (!this.projectionTimer) {
      return;
    }
    clearTimeout(this.projectionTimer);
    this.projectionTimer = null;
    this.pendingProjectionOrigin = null;
  }

  private emitProjection(origin: any) {
    const projection = this.projection();
    if (!projection) {
      return;
    }
    const info: ProjectionInfo = {
      local: origin instanceof LocalOrigin,
      fromUndo: origin === this.undoManager,
      origin,
    };
    this.projectionListeners.forEach((listener) => listener(projection, info));
  }

  private emitHistory() {
    const events = this.historyEvents();
    const position = this.historyPosition;
    this.historyListeners.forEach((listener) => listener(events, position));
  }
}

/**
 * Rebuild the graph as it stood after `count` updates, by replaying the update
 * log into a throwaway document.  Used by the rewind transport.
 */
export function projectUpdates(updates: Uint8Array[], count?: number): any | null {
  const doc = new Y.Doc();
  const limit = count === undefined ? updates.length : Math.min(count, updates.length);
  if (limit > 0) {
    applyUpdate(doc, mergeUpdates(updates.slice(0, limit)));
  }
  const graph = toJSON(doc);
  doc.destroy();
  return graph;
}

export default GraphCrdtSession;
