import type {App} from "vue";
import type {Router} from "vue-router";
import type {Toc, TocItem, GraphDiff, NodeArtifact, GraphArtifact} from "@plastic-io/graph-editor-vue3-document-provider";
import {useStore as useOrchistratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
import {useStore as useAuthenticationStore} from "@plastic-io/graph-editor-vue3-authentication-provider";
import {authRequiredFor} from "@plastic-io/graph-editor-vue3-auth0-authentication-provider";
import {deref, newId} from "@plastic-io/graph-editor-vue3-utils";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
const CHUNK_SIZE = 35000;
import HTTPDataProvider from "./HTTPDataProvider";
export default class WssDocumentProvider extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    const orchistratorStore = useOrchistratorStore();
    const preferencesStore = usePreferencesStore();
    if (preferencesStore.preferences!.useLocalStorage) {
        return;
    }
    const wssDataProvider = new WSSDataProvider(
      preferencesStore.preferences!.graphWSSServer,
      preferencesStore.preferences!.graphHTTPServer,
      (e: any) => {},
      () => {},
      () => {},
    );
    // Graph changes travel over the CRDT provider now, which writes an
    // append-only update log instead of a diff that the server has to apply on
    // top of whatever it last read.  This module stays for the table of
    // contents, artifacts, publishing and fetching a graph by id.
    (orchistratorStore.dataProviders.graph as any) = wssDataProvider;
    (orchistratorStore.dataProviders as any).publish = wssDataProvider;
    (orchistratorStore.dataProviders as any).toc = {
      ...wssDataProvider,
      async get(tocKey: string) {
        return await wssDataProvider.getToc();
      },
      updateToc(key: string, value: any) {
        orchistratorStore.toc[key] = value;
      },
    };
    (orchistratorStore.dataProviders as any).artifact = wssDataProvider;
    // Identity: against an HTTPS server with an Auth0 API identifier the socket opens once
    // the Auth0 provider has a token and refreshes it before each reconnect; against a local
    // dev server (no authorizer) it opens straight away without one.
    const authenticationStore = useAuthenticationStore();
    wssDataProvider.requireToken = authRequiredFor(preferencesStore.preferences);
    if (!wssDataProvider.requireToken) {
      wssDataProvider.connect();
    }
    wssDataProvider.tokenProvider = async () => {
      const provider = orchistratorStore.authProvider as any;
      if (provider && typeof provider.getToken === "function") {
        try {
          return await provider.getToken();
        } catch (err) {
          return authenticationStore.identity.token || undefined;
        }
      }
      return authenticationStore.identity.token || undefined;
    };
    authenticationStore.$subscribe((mutation: any, state: any) => {
      if (state.identity && state.identity.token) {
        wssDataProvider.setToken(state.identity.token);
      }
    });
    if (authenticationStore.identity.token) {
      wssDataProvider.setToken(authenticationStore.identity.token);
    }
  }
};




class WSSDataProvider {
    asyncUpdate: boolean;
    httpUrl: string;
    wssUrl: string;
    keepOpen: boolean;
    chunks: any;
    httpDataProvider: HTTPDataProvider;
    webSocket!: WebSocket;
    token = "";
    state: string;
    messages: any[];
    message: (e: any) => void;
    open: () => void;
    close: () => void;
    events: any;
    subscriptions: string[];
    constructor(wssUrl: string, httpUrl: string, message: (e: any) => void, open: () => void, close: () => void) {
        if (!wssUrl) {
            throw new Error("No wssUrl was passed to WSSDataProvider");
        }
        if (!httpUrl) {
            throw new Error("No httpUrl was passed to WSSDataProvider");
        }
        this.asyncUpdate = true;
        this.events = {};
        this.chunks = {};
        this.messages = [];
        this.keepOpen = true;
        this.wssUrl = wssUrl;
        this.httpUrl = httpUrl;
        this.message = message;
        this.open = open;
        this.close = close;
        this.subscriptions = [];
        this.state = "connecting";
        this.keepOpen = true;
        this.httpDataProvider = new HTTPDataProvider(this.httpUrl);
        // The socket opens once a token is available (setToken); until then every send()
        // queues.  The server requires the token at $connect, as a subprotocol.
    }
    tokenProvider: (() => Promise<string | undefined>) | null = null;
    /** When the server checks tokens the socket waits for one; a local dev server needs none. */
    requireToken = false;
    private opening = false;
    private reconnectDelay = 1000;
    setToken(token: string) {
        this.token = token;
        this.httpDataProvider.setToken(token);
        if (this.state !== "open" && !this.opening) {
            this.connect();
        }
    }
    send(e: any) {
        if (this.state !== "open") {
            return this.messages.push(e);
        }
        const value = JSON.stringify(e);
        this.webSocket.send(value);
    }
    async connect() {
        if (this.state === "open" || this.opening) {
            return;
        }
        this.opening = true;
        if (this.tokenProvider) {
            // tokens expire; fetch a fresh one before every (re)connect
            try {
                const fresh = await this.tokenProvider();
                if (fresh) {
                    this.token = fresh;
                    this.httpDataProvider.setToken(fresh);
                }
            } catch (err) {
                console.warn("Cannot refresh the access token before connecting", err);
            }
        }
        if (!this.token && this.requireToken) {
            this.opening = false;
            return;
        }
        this.state = "connecting";
        this.webSocket = this.token
            ? new WebSocket(this.wssUrl, ["access_token", this.token])
            : new WebSocket(this.wssUrl);
        this.opening = false;
        this.webSocket.addEventListener("open", () => {
            this.state = "open";
            this.reconnectDelay = 1000;
            this.open();
            while (this.messages.length > 0) {
                this.send(this.messages.shift());
            }
            this.subscriptions.forEach((channelId) => {
                this.subscribe(channelId, null);
            });
        });
        this.webSocket.addEventListener("close", () => {
            this.state = "closed";
            this.close();
            if (this.keepOpen) {
                // back off so a rejected handshake (expired token, 401) does not spin
                setTimeout(() => this.connect(), this.reconnectDelay);
                this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
            }
        });
        this.webSocket.addEventListener("message", (e) => {
            const val = JSON.parse(e.data);
            this.messageHandler(val);
        });
    }
    async getToc() {
      const response = await fetch(this.httpUrl + 'toc.json');
      const data = await response.json();
      return data;
    }
    messageHandler(e: any) {
        if (e.chunkCollectionId) {
            this.chunks[e.chunkCollectionId] = this.chunks[e.chunkCollectionId] || [];
            this.chunks[e.chunkCollectionId].push(e);
            if (this.chunks[e.chunkCollectionId].length === e.parts) {
                const msg: any[] = [];
                this.chunks[e.chunkCollectionId].sort((a: any, b: any) => {
                    return a.part - b.part;
                }).forEach((chunk: any) => {
                    msg.push(chunk.value);
                });
                this.messageHandler(JSON.parse(msg.join("")));
            }
            return;
        }
        if (e.unsubscribed) {
            const idx = this.subscriptions.indexOf(e.unsubscribed);
            if (idx !== -1) {
                this.subscriptions.splice(idx, 1);
            }
        }
        if (e.messageId && typeof this.events[e.messageId] === "function") {
            this.events[e.messageId](e.response);
        }
        if (e.subscribed && this.subscriptions.indexOf(e.subscribed) === -1) {
            this.subscriptions.push(e.subscribed);
        }
        if (e.channelId) {
            if (this.events[e.channelId]) {
                this.events[e.channelId].forEach((listener: any) => {
                    listener(e.response);
                });
            }
        }
        this.message(e);
    }
    disconnect() {
        this.keepOpen = false;
        this.webSocket.close();
    }
    subscribe(channelId: string, listener: ((e: any) => void) | null) {
        if (listener) {
            if (!this.events[channelId]) {
                this.events[channelId] = [];
            }
            this.events[channelId].push(listener);
        }
        this.send({
            action: "subscribe",
            channelId,
        });
    }
    unsubscribe(channelId: string, listener: (e: any) => void) {
        if (!this.events[channelId]) {
            return;
        }
        const idx = this.events[channelId].indexOf(listener);
        if (idx === -1) {
            return;
        }
        this.events[channelId].splice(idx, 1);
        this.send({
            action: "unsubscribe",
            channelId,
        });
    }
    async deploy(args: any) {
        return new Promise((success) => {
            const value = {
                messageId: newId(),
                action: "deploy",
                env: args.env,
                version: args.version,
                id: args.id,
            };
            this.send(value);
            this.events[value.messageId] = success;
        });
    }
    async listSubscribers(channelId: string) {
        return new Promise((success) => {
            const value = {
                messageId: newId(),
                action: "listSubscribers",
                channelId,
            };
            this.send(value);
            this.events[value.messageId] = success;
        });
    }
    async listSubscriptions(connectionId: string) {
        return new Promise((success) => {
            const value = {
                messageId: newId(),
                action: "listSubscriptions",
                connectionId,
            };
            this.send(value);
            this.events[value.messageId] = success;
        });
    }
    sendToAll(value: any) {
        this.send({
            action: "sendToAll",
            value,
        });
    }
    sendToChannel(channelId: string, e: {value: any, channelId: string}) {
        this.send({
            action: "sendToChannel",
            value: e.value,
            channelId: e.channelId,
        });
    }
    sendToConnection(connectionId: string, e: {value: any, connectionId: string}) {
        this.send({
            action: "sendToConnection",
            value: e.value,
            connectionId: e.connectionId,
        });
    }
    get(id: string) {
        return new Promise((success, reject) => {
            const value = {
                action: "getGraph",
                id,
                version: "latest",
                messageId: newId(),
            };
            this.send(value);
            this.events[value.messageId] = (e: any) => {
                if (e.err) {
                  return reject(new Error(e.err));
                }
                success(e);
            };
        });
    }
    /**
     * Delete a graph.  The server hides it by default and keeps everything it
     * is made of; `permanent` destroys it, which nothing in the interface
     * asks for.
     */
    delete(url: string, permanent = false) {
        this.send({
            action: "deleteGraph",
            id: url,
            permanent,
        });
    }
    /** Put a hidden graph back in the list. */
    restore(url: string) {
        this.send({
            action: "undeleteGraph",
            id: url,
        });
    }
    async set(url: string, value: any) {
        // can be three things, changes, published graph, published node
        if ("changes" in value) {
            const valueLen = JSON.stringify(value).length;
            if (valueLen > CHUNK_SIZE) {
                try {
                    const response = await this.httpDataProvider.set("addEvent", JSON.stringify({
                        action: "addEvent",
                        event: value,
                    }));
                    this.messageHandler(response);
                } catch (err) {
                    throw new Error("Cannot write event via HTTP POST: " + err);
                }
                return;
            }
            this.send({
                action: "addEvent",
                event: value,
            });
        } else if ("node" in value) {
            this.send({
                action: "publishNode",
                graphId: value.node.graphId,
                nodeId: value.node.id,
                version: value.node.version,
                messageId: newId(),
            });
        } else if ("graph" in value) {
            this.send({
                action: "publishGraph",
                id: value.graph.id,
                version: value.graph.version,
                messageId: newId(),
            });
        }
    }
}
