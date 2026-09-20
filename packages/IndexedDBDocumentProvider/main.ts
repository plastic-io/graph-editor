import {newId} from "@plastic-io/graph-editor-vue3-utils";
import type {Node, Graph} from "@plastic-io/plastic-io";
import type {Toc, TocItem, GraphDiff, NodeArtifact, GraphArtifact} from "@plastic-io/graph-editor-vue3-document-provider";
import {useStore as useOrchistratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
import DocumentProvider from "@plastic-io/graph-editor-vue3-document-provider";
import {Appearance} from "@plastic-io/graph-editor-vue3-appearance";
import IndexedDBWorker from "./storageWorker?worker";
import {fromJSON, toJSON} from 'flatted';
const preferencesKey = "preferences";
const tocKey = "toc.json";
const eventsPrefix = "events/";
const artifactsPrefix = "artifacts/";
const DEBOUNCE_TIME = 1500;
export default class IndexedDBProvider extends EditorModule {
  constructor(config: Record<string, any>) {
    super();
    const orchistratorStore = useOrchistratorStore();
    const localDataProviderGraph = new IndexedDBDataProvider();
    localDataProviderGraph.type = 'update';
    const localDataProviderArtifact = new IndexedDBDataProvider();
    localDataProviderArtifact.type = 'artifact';
    const preferencesStore = usePreferencesStore();
    if (!preferencesStore.preferences!.useLocalStorage) {
        return;
    }
    // The graph document itself is persisted by the CRDT provider now.  This
    // module stays because the table of contents, artifacts and publishing all
    // still go through it, and because opening a graph created before the
    // migration reads its projection from here.
    orchistratorStore.dataProviders.graph = localDataProviderGraph;
    orchistratorStore.dataProviders.publish = localDataProviderArtifact;
    orchistratorStore.dataProviders.toc = localDataProviderArtifact;
    orchistratorStore.dataProviders.artifact = localDataProviderArtifact;
  }
};

const DBNAME = "plastic-io-document-provider";
// MIRROR WORLD!  This class is a reflection of another class in the storageWorker file
// this class is a worker abstraction layer
class IndexedDBDataProvider extends DocumentProvider {
    graph = null as any
    broadcastChannel = new BroadcastChannel(DBNAME);
    worker = new IndexedDBWorker() as any;
    listeners = {} as any;
    type = '';
    constructor() {
        super();
        this.worker.onmessage = (e: any) => {
            const id = e.data.source;
            const args = fromJSON(e.data.event);
            if (id === 'toc-update') {
                this.broadcastChannel.postMessage({
                    type: 'tocUpdate',
                    item: args.toc,
                });
                this.dispatchEvent('subscriber', args.graph);
                return;
            }
            this.dispatchEvent(id, args);
        };
    }

    addEventListener(eventType: string, listener: (event: any) => void): void {
        if (!this.listeners[eventType]) {
            this.listeners[eventType] = [];
        }
        this.listeners[eventType].push(listener);
    }

    removeEventListener(eventType: string, listener: (event: any) => void): void {
        if (!this.listeners[eventType]) return;
        const index = this.listeners[eventType].indexOf(listener);
        if (index !== -1) {
            this.listeners[eventType].splice(index, 1);
        }
    }

    dispatchEvent(type: string, event: any): void {
        const eventListeners = this.listeners[type];
        if (eventListeners) {
            for (const listener of eventListeners) {
                Promise.resolve().then(() => {
                    listener(event);
                });
            }
        }
    }

    createWorkerResponder(method: string, args: any[]): Promise<any> {
        return new Promise(async (success, fail) => {
            const id = newId();
            const listener = (e: any) => {
                this.removeEventListener(id, listener);
                success(e);
            };
            this.addEventListener(id, listener);
            this.worker.postMessage({ id, method, args: toJSON(args) });
        });
    }

    getEvents(url: string): Promise<GraphDiff[] | any> {
        return this.createWorkerResponder('getEvents', [url]);
    }

    async set(url: string, value: GraphDiff | NodeArtifact | GraphArtifact): Promise<void> {
        return this.createWorkerResponder('set', [url, value, this.type]);
    }
    async updateToc(): Promise<any> {
        return this.createWorkerResponder('updateToc', []);
    }
    async getToc(): Promise<any> {
        return this.createWorkerResponder('getToc', []);
    }
    async subscribe(url: string | null, callback: any): Promise<void> {

    }
    async get(url: string): Promise<Graph | any> {
        const response = await this.createWorkerResponder('get', [url, this.type]);
        if (!this.graph) {
            this.graph = JSON.parse(JSON.stringify(response));
        }
        if (!response) {
            throw new Error("Resource not found." + url);
        }
        return response;
    }
    async delete(url: string): Promise<void> {
        return this.createWorkerResponder('delete', [url]);
    }
}
