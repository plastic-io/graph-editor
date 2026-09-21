import {useStore as useAuthenticationStore} from "@plastic-io/graph-editor-vue3-authentication-provider";
import {useStore as useSyncStatusStore, newUlid} from "@plastic-io/graph-editor-vue3-sync-status";
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
const CLIENT_INFO = { name: "graph-editor", version: "2.0.0" };
/** Anything larger than this, base64 encoded, goes over HTTP instead. */
const MAX_FRAME = 28000;
/** How long to wait for the server's answer before sending a mutation again. */
const ACK_TIMEOUT = 20000;
const MAX_ATTEMPTS = 5;

/** One mutation on its way to the server. */
interface Outbound {
  mutationId: string;
  description: string;
  encoded: string;
  frame: any;
  attempts: number;
  sentAt: number;
}

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
  private outbox: Outbound[] = [];
  private inFlight: Outbound | null = null;
  private ackTimer: any = null;
  private detachOpen: (() => void) | null = null;
  private recovering = false;
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
    this.sendRaw(writeSyncStep1(encodeStateVector(session.doc)), "Sync");
    useSyncStatusStore().setConnected(true);
    if (typeof this.wss.onOpen === "function") {
      // After a reconnect: exchange state vectors again (anything missed while
      // the socket was down flows both ways) and send the unanswered mutation
      // again under the same id.
      this.detachOpen = this.wss.onOpen(() => {
        if (!this.session) {
          return;
        }
        this.sendRaw(writeSyncStep1(encodeStateVector(this.session.doc)), "Sync");
        if (this.inFlight) {
          this.transmit(this.inFlight);
        } else {
          this.pump();
        }
      });
    }

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
  /** The graph server requires the Auth0 access token on every HTTP route. */
  private authHeaders(): Record<string, string> {
    const token = useAuthenticationStore().identity.token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
  private async loadInitialState(session: any) {
    if (!this.httpBase) {
      return;
    }
    try {
      const ours = toBase64(encodeStateVector(session.doc));
      const response = await fetch(
        `${this.httpBase}crdt/${this.graphId}/state?sv=${encodeURIComponent(ours)}`,
        { headers: this.authHeaders() },
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

  /** A protocol message the server answers with sync frames, not with an ack (sync step 1). */
  private sendRaw(payload: Uint8Array, description: string) {
    this.wss.send({
      action: "yjs",
      kind: "sync",
      graphId: this.graphId,
      payload: toBase64(payload),
      description,
      format: UPDATE_FORMAT,
    });
  }

  /**
   * Queue a mutation for the server.
   *
   * Every mutation carries a client-minted id (plan §5.1) so the server can
   * answer it, replay it idempotently, and so the sync status can show what
   * happened to it.  Only one mutation is in flight per graph: the server
   * handles frames concurrently, and an update that arrived before the one it
   * builds on would be refused as depending on unseen changes.  Everything
   * edited while waiting is merged into the next one.
   */
  private sendSync(payload: Uint8Array, description: string) {
    const encoded = toBase64(payload);
    const mutationId = newUlid();
    useSyncStatusStore().track(mutationId, description);
    this.outbox.push({
      mutationId,
      description,
      encoded,
      attempts: 0,
      sentAt: 0,
      frame: {
        action: "yjs",
        kind: "sync",
        schemaVersion: 2,
        graphId: this.graphId,
        payload: encoded,
        description,
        format: UPDATE_FORMAT,
        mutationId,
        clientInfo: CLIENT_INFO,
      },
    });
    this.pump();
  }

  private pump() {
    if (this.inFlight || this.outbox.length === 0 || !this.connected) {
      return;
    }
    this.inFlight = this.outbox.shift() as Outbound;
    this.transmit(this.inFlight);
  }

  private transmit(item: Outbound) {
    item.attempts += 1;
    item.sentAt = Date.now();
    if (item.encoded.length > MAX_FRAME) {
      this.postOverHttp(item);
    } else {
      this.wss.send(item.frame);
    }
    this.armAckTimer();
  }

  /**
   * No answer means the frame or its answer was lost (a Lambda that failed, a
   * socket that dropped).  The same mutation id is sent again: the server
   * replays the original answer if it had accepted it, so a resend never
   * stores a change twice.
   */
  private armAckTimer() {
    if (this.ackTimer) {
      clearTimeout(this.ackTimer);
    }
    this.ackTimer = setTimeout(() => {
      this.ackTimer = null;
      const item = this.inFlight;
      if (!item) {
        return;
      }
      if (item.attempts >= MAX_ATTEMPTS) {
        console.error(`No answer from the graph server for change "${item.description}" after ${item.attempts} attempts.`);
        useSyncStatusStore().rejected(item.mutationId, "NO_ANSWER", "the graph server did not answer");
        this.inFlight = null;
        this.pump();
        return;
      }
      console.warn(`No answer yet for change "${item.description}"; sending it again (${item.attempts + 1}/${MAX_ATTEMPTS}).`);
      this.transmit(item);
    }, ACK_TIMEOUT);
  }

  private async postOverHttp(item: Outbound) {
    if (!this.httpBase) {
      console.error("An update is too large for the socket and no HTTP endpoint is configured.");
      return;
    }
    try {
      const response = await fetch(`${this.httpBase}crdt/${this.graphId}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this.authHeaders() },
        body: JSON.stringify({
          payload: item.encoded, description: item.description, format: UPDATE_FORMAT,
          schemaVersion: 2, mutationId: item.mutationId, clientInfo: CLIENT_INFO,
        }),
      });
      let result: any = null;
      try { result = await response.json(); } catch (err) { /* no body */ }
      this.onDecision(result && result.mutationId ? result : {
        mutationId: item.mutationId,
        decision: response.ok ? "accepted" : "rejected",
        code: response.ok ? undefined : `HTTP_${response.status}`,
        reason: response.ok ? undefined : response.statusText,
      });
    } catch (err) {
      // the ack timer will send it again
      console.warn("Cannot post a large update; will retry.", err);
    }
  }

  /** The server's answer to one of our mutations: an ack or a reject frame (or the HTTP result). */
  private onDecision(result: any) {
    const status = useSyncStatusStore();
    if (!result || !result.mutationId) {
      return;
    }
    const current = this.inFlight;
    if (!current || current.mutationId !== result.mutationId) {
      // A late answer to a resend, or an answer to something sent while
      // leaving the graph: record it, nothing waits on it.
      if (result.decision === "accepted") {
        status.accepted(result.mutationId, result.updateId);
      } else if (result.decision === "rejected") {
        status.rejected(result.mutationId, result.code || "REJECTED", result.reason || "");
      }
      return;
    }
    if (this.ackTimer) {
      clearTimeout(this.ackTimer);
      this.ackTimer = null;
    }
    this.inFlight = null;
    if (result.decision === "accepted") {
      status.accepted(result.mutationId, result.updateId);
      this.pump();
      return;
    }
    console.error(`The graph server rejected change "${current.description}": ${result.code} ${result.reason || ""}`);
    status.rejected(result.mutationId, result.code || "REJECTED", result.reason || "");
    this.recover(current, result);
  }

  /**
   * Rejection handling (plan §4.4.4): the local document now holds a change
   * the server refused, and every later local change builds on it, so the
   * server would refuse those too.  Yjs cannot un-apply an update, so the graph
   * is reloaded from the server.  Nothing is silently lost: the graph as it
   * stood, and the names of the changes it contained, are kept as a draft the
   * user can download from the sync status menu.
   */
  private recover(item: Outbound, result: any) {
    if (this.recovering || !this.session) {
      return;
    }
    this.recovering = true;
    const status = useSyncStatusStore();
    const dropped = this.outbox;
    this.outbox = [];
    status.dismiss(dropped.map((o) => o.mutationId));
    status.setQuarantine({
      at: Date.now(),
      reason: `${result.code || "REJECTED"}: ${result.reason || ""}`,
      descriptions: [item.description].concat(dropped.map((o) => o.description)),
      graph: this.session.projection(),
    });
    const graphStore = useOrchestratorStore().graphStore;
    if (graphStore && typeof graphStore.reloadFromServer === "function") {
      graphStore.reloadFromServer(`change "${item.description}" was rejected: ${result.code} ${result.reason || ""}`);
    }
    // recovering stays true: disconnect() (called by the reload) resets the provider
  }

  private onMessage(response: any) {
    if (!response || response.graphId !== this.graphId) {
      return;
    }
    if (response.kind === "ack" || response.kind === "reject") {
      this.onDecision(response);
      return;
    }
    if (!response.payload) {
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
    const response = await fetch(`${this.httpBase}crdt/${graphId}/history`, { headers: this.authHeaders() });
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
    const response = await fetch(`${this.httpBase}crdt/${graphId}/state/${id}`, { headers: this.authHeaders() });
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
    if (this.detachOpen) {
      this.detachOpen();
      this.detachOpen = null;
    }
    if (this.ackTimer) {
      clearTimeout(this.ackTimer);
      this.ackTimer = null;
    }
    // Whatever is still unanswered goes out now, in order, without waiting:
    // the graph is closing and nothing here can act on the answers.  Late
    // answers are still recorded by the sync status through onDecision.
    if (this.connected && !this.recovering) {
      this.outbox.forEach((item) => this.wss.send(item.frame));
    }
    this.outbox = [];
    this.inFlight = null;
    this.recovering = false;
    useSyncStatusStore().setConnected(false);
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
