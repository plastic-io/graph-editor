import * as Y from "yjs";
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from "y-protocols/awareness";
import {
  MESSAGE_SYNC_STEP1,
  readSyncMessage,
  writeSyncStep1,
  writeSyncStep2,
  writeUpdate,
  toBase64,
  fromBase64,
  channelIdFor,
  describeOrigin,
  UPDATE_FORMAT,
  encodeState,
  encodeStateVector,
  mergeUpdates,
  isEmptyUpdate,
} from "@plastic-io/graph-crdt";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
import { useStore as useOrchestratorStore } from "@plastic-io/graph-editor-vue3-orchestrator";
import { useStore as usePreferencesStore } from "@plastic-io/graph-editor-vue3-preferences-provider";

/** Local edits are batched for this long before going out. */
const FLUSH_INTERVAL = 150;
/** Anything larger than this, base64 encoded, goes over HTTP instead. */
const MAX_FRAME = 28000;

const USER_COLORS = [
  "#e6194b", "#3cb44b", "#4363d8", "#f58231", "#911eb4",
  "#42d4f4", "#f032e6", "#bfef45", "#469990", "#9a6324",
];

function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return USER_COLORS[hash % USER_COLORS.length];
}

/**
 * Carries the graph's CRDT document over the graph server's WebSocket.
 *
 * It rides the connection the rest of the editor already uses rather than
 * opening a second one, and it speaks the Yjs sync protocol inside the JSON
 * envelope API Gateway needs in order to route a message.
 */
export class WssCrdtProvider {
  readonly name = "wss";
  /** Holds every change anyone made, so this is the log rewind should read. */
  readonly historyPriority = 10;
  private session: any = null;
  private graphId = "";
  private wss: any = null;
  private httpBase = "";
  private queue: Uint8Array[] = [];
  private pendingDescription = "Change";
  private flushTimer: any = null;
  private detach: (() => void) | null = null;
  private historyCache: any[] = [];
  private channelListener: ((response: any) => void) | null = null;
  awareness: Awareness | null = null;

  private get connected(): boolean {
    return !!(this.wss && typeof this.wss.send === "function");
  }

  async connect(graphId: string, session: any): Promise<void> {
    const orchestrator = useOrchestratorStore();
    const preferences = usePreferencesStore();
    const prefs: any = preferences.preferences || {};
    if (prefs.useLocalStorage) {
      // Sandbox mode: the browser is the only peer.
      return;
    }
    this.graphId = graphId;
    this.session = session;
    this.wss = orchestrator.dataProviders.graph;
    this.httpBase = (prefs.graphHTTPServer || "").replace(/\/?$/, "/");
    if (!this.connected) {
      console.warn("No graph server connection; editing stays local to this browser.");
      return;
    }

    // A whole graph does not fit in a WebSocket frame, so the first load comes
    // over HTTP and the socket only carries changes from then on.
    await this.loadInitialState(session);

    this.channelListener = (response: any) => this.onMessage(response);
    this.wss.subscribe(channelIdFor(graphId), this.channelListener);
    this.sendSync(writeSyncStep1(encodeStateVector(session.doc)), "Sync");

    this.detach = session.onUpdate((update: Uint8Array, origin: any) => {
      if (origin && origin.source === this.name) {
        return;
      }
      const description = describeOrigin(origin);
      // Batching is only meant to collapse a burst of one kind of change, such
      // as typing.  Merging a node creation into an unrelated edit would file
      // it under the wrong name in the graph's history.
      if (this.queue.length > 0 && description !== this.pendingDescription) {
        this.flush();
      }
      this.queue.push(update);
      this.pendingDescription = description;
      this.scheduleFlush();
    });

    this.startAwareness(session, prefs);
  }

  /**
   * Fetch what this browser is missing, and push what the server is missing.
   *
   * Browser storage has already loaded by the time this runs, so asking for the
   * whole graph would re-download something we mostly have.  Sending our state
   * vector and receiving only the difference is the exchange Yjs documents, and
   * it means reopening a graph you were just editing transfers almost nothing.
   */
  private async loadInitialState(session: any) {
    if (!this.httpBase) {
      return;
    }
    try {
      const ours = toBase64(encodeStateVector(session.doc));
      const response = await fetch(
        `${this.httpBase}crdt/${this.graphId}/state?sv=${encodeURIComponent(ours)}`,
      );
      const data = await response.json();
      if (data && data.payload) {
        session.applyRemote(fromBase64(data.payload), this.name);
      }
      if (data && data.stateVector) {
        // Anything edited offline is on this side only; send it now rather
        // than waiting for the socket handshake to discover it.
        const missing = encodeState(session.doc, fromBase64(data.stateVector));
        if (!isEmptyUpdate(missing)) {
          this.sendSync(writeUpdate(missing), "Sync");
        }
      }
    } catch (err) {
      console.warn("Cannot fetch the stored document; falling back to socket sync.", err);
    }
  }

  /* ------------------------------------------------------ messaging */

  private scheduleFlush() {
    if (this.flushTimer) {
      return;
    }
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, FLUSH_INTERVAL);
  }

  /**
   * Coalesce everything typed since the last flush into one update.  Without
   * this a burst of keystrokes in the code editor would be one Lambda
   * invocation each.
   */
  private flush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.queue.length === 0) {
      return;
    }
    const merged = mergeUpdates(this.queue);
    const description = this.pendingDescription;
    this.queue = [];
    this.sendSync(writeUpdate(merged), description);
  }

  private sendSync(payload: Uint8Array, description: string) {
    const encoded = toBase64(payload);
    if (encoded.length > MAX_FRAME) {
      this.postOverHttp(encoded, description);
      return;
    }
    this.wss.send({
      action: "yjs",
      kind: "sync",
      graphId: this.graphId,
      payload: encoded,
      description,
      format: UPDATE_FORMAT,
    });
  }

  private async postOverHttp(payload: string, description: string) {
    if (!this.httpBase) {
      console.error("An update is too large for the socket and no HTTP endpoint is configured.");
      return;
    }
    try {
      await fetch(`${this.httpBase}crdt/${this.graphId}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, description, format: UPDATE_FORMAT }),
      });
    } catch (err) {
      console.error("Cannot post a large update.", err);
    }
  }

  private onMessage(response: any) {
    if (!response || !response.payload || response.graphId !== this.graphId) {
      return;
    }
    if (response.kind === "awareness") {
      if (this.awareness) {
        applyAwarenessUpdate(this.awareness, fromBase64(response.payload), this.name);
      }
      return;
    }
    const message = readSyncMessage(fromBase64(response.payload));
    if (message.type === MESSAGE_SYNC_STEP1) {
      // The server is asking for whatever we have that it does not, which is
      // how work done while offline gets back in.
      const update = encodeState(this.session.doc, message.content);
      if (!isEmptyUpdate(update)) {
        this.sendSync(writeSyncStep2(update), "Sync");
      }
      return;
    }
    this.session.applyRemote(message.content, this.name);
  }

  /* ------------------------------------------------------ presence */

  private startAwareness(session: any, prefs: any) {
    const awareness = new Awareness(session.doc);
    this.awareness = awareness;
    const userId = String(prefs.userId || prefs.workstationId || "anonymous");
    awareness.setLocalStateField("user", {
      id: userId,
      name: prefs.userName || "Anonymous",
      email: prefs.email || "",
      avatar: prefs.avatar || "",
      // Coloured by the document's client id rather than the user id, because
      // every fresh preferences file carries the same default user id and
      // everyone would otherwise be given the same colour.
      color: colorFor(String(session.doc.clientID)),
    });
    awareness.on("update", ({ added, updated, removed }: any) => {
      const changed = added.concat(updated, removed);
      if (changed.length === 0) {
        return;
      }
      // Awareness has its own encoding and is unaffected by the document
      // update format.
      this.wss.send({
        action: "yjs",
        kind: "awareness",
        graphId: this.graphId,
        payload: toBase64(encodeAwarenessUpdate(awareness, changed)),
      });
    });
    const orchestrator = useOrchestratorStore();
    awareness.on("change", () => {
      const users: Record<string, any> = {};
      const cursors: Record<string, any> = {};
      awareness.getStates().forEach((state: any, clientId: number) => {
        if (clientId === session.doc.clientID || !state || !state.user) {
          return;
        }
        users[String(clientId)] = state.user;
        if (state.cursor) {
          cursors[String(clientId)] = { ...state.cursor, user: state.user };
        }
      });
      orchestrator.graphUsers = users;
      orchestrator.graphUserMouse = cursors;
    });
  }

  /** Publish where this user's pointer and selection are. */
  setPresence(cursor: { x: number; y: number } | null, selection?: any) {
    if (!this.awareness) {
      return;
    }
    this.awareness.setLocalStateField("cursor", cursor);
    if (selection) {
      this.awareness.setLocalStateField("selection", selection);
    }
  }

  /* ------------------------------------------------------ rewind */

  async history(graphId: string) {
    if (!this.httpBase) {
      return [];
    }
    const response = await fetch(`${this.httpBase}crdt/${graphId}/history`);
    this.historyCache = await response.json();
    return this.historyCache;
  }

  async updatesFor(graphId: string, entry: any): Promise<Uint8Array[]> {
    if (!this.httpBase || !entry) {
      return [];
    }
    const id = entry.id || (this.historyCache.find((h: any) => h.seq === entry.seq) || {}).id;
    if (!id) {
      return [];
    }
    const response = await fetch(`${this.httpBase}crdt/${graphId}/state/${id}`);
    const data = await response.json();
    return data && data.payload ? [fromBase64(data.payload)] : [];
  }

  /** Ask the server to drop the document.  Object removal happens there. */
  async remove(graphId: string): Promise<void> {
    if (!this.connected) {
      return;
    }
    this.wss.send({ action: "deleteGraph", id: graphId });
  }

  disconnect() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    // Anything typed in the last moment still belongs to the graph being left.
    this.flush();
    if (this.detach) {
      this.detach();
      this.detach = null;
    }
    if (this.channelListener && this.connected && this.graphId) {
      // Without this the server keeps sending this connection traffic for a
      // graph nobody here is looking at any more.
      this.wss.unsubscribe(channelIdFor(this.graphId), this.channelListener);
    }
    this.channelListener = null;
    if (this.awareness) {
      this.awareness.destroy();
      this.awareness = null;
    }
    this.session = null;
    this.graphId = "";
  }
}

export default class WssCrdtProviderModule extends EditorModule {
  constructor(config: Record<string, any>) {
    super();
    const orchestratorStore = useOrchestratorStore();
    const preferencesStore = usePreferencesStore();
    const prefs: any = preferencesStore.preferences || {};
    if (prefs.useLocalStorage) {
      // Sandbox mode: the browser is the only peer.
      return;
    }
    orchestratorStore.syncProviders.push(new WssCrdtProvider());
  }
}
