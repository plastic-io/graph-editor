import type {Node, Graph} from "@plastic-io/plastic-io";
import type {Toc, TocItem, GraphDiff, NodeArtifact, GraphArtifact} from "@plastic-io/graph-editor-vue3-document-provider";
import {useStore as useOrchistratorStore} from "@plastic-io/graph-editor-vue3-graph-orchestrator";
import GraphEditorModule from "@plastic-io/graph-editor-vue3-graph-editor-module";
import DocumentProvider from "@plastic-io/graph-editor-vue3-document-provider";
import {Appearance} from "@plastic-io/graph-editor-vue3-graph-canvas";
import {applyChange} from "deep-diff";
import Hashes from "jshashes";
const preferencesKey = "preferences";
const tocKey = "toc.json";
const eventsPrefix = "events/";
const artifactsPrefix = "artifacts/";

// Note: localStorage methods are not async.  Async  methods are used to show
// what it would look like to implement an async data provider which are far
// more typical than sync providers like local store.

export default class LocalStorageDocumentProvider extends GraphEditorModule {
  constructor(config: Record<string, any>) {
    super();
    const orchistratorStore = useOrchistratorStore();
    const localDataProvider = new LocalDataProvider();
    orchistratorStore.dataProviders.graph = localDataProvider;
    orchistratorStore.dataProviders.publish = localDataProvider;
    orchistratorStore.dataProviders.toc = localDataProvider;
    orchistratorStore.dataProviders.artifact = localDataProvider;
  }
};

class LocalDataProvider extends DocumentProvider {
    constructor() {
        super();
    }
    async updateToc(key: string, value: TocItem) {
        let sToc: string | null = await localStorage.getItem(tocKey);
        let toc: Toc;
        if (!sToc) {
            toc = {};
        } else {
            try {
                toc = JSON.parse(sToc);
            } catch (err: any) {
                throw new Error("Cannot parse toc" + err.toString());
            }
        }
        toc[key] = value;
        await localStorage.setItem(tocKey, JSON.stringify(toc));
    }
    async subscribe(url: string | null, callback: (e: Event, a: any) => void): Promise<void> {
        let lastLength = -1;
        const updateState = async (event: Event) => {
            if (url === "toc.json") {
                const strToc: string = (await localStorage.getItem(tocKey) || "");
                let toc: object;
                try {
                    toc = JSON.parse(strToc);
                } catch (err: any) {
                    throw new Error("Cannot parse TOC. Error: " + err.toString());
                }
                callback(event, {
                    type: "toc",
                    toc,
                });
            } else {
                const eventStr = (await localStorage.getItem(eventsPrefix + url) || "");
                let events;
                if (!eventStr) {
                    events = [];
                } else if (eventStr) {
                    try {
                        events = JSON.parse(eventStr);
                    } catch (err: any) {
                        throw new Error("Cannot parse events. Error: " + err.toString());
                    }
                }
                if (lastLength !== events.length) {
                    if (lastLength !== -1) {
                        callback(event, {
                            type: "events",
                            events: events.slice(lastLength),
                        });
                    }
                    lastLength = events.length;
                }
            }
        };
        window.addEventListener("storage", updateState);
        if (url !== tocKey) {
            // if this is not a document, do not try and fetch an initial state
            updateState(new Event('load'));
        }
    }
    async get(url: string): Promise<Graph> {
        let item: string = (await localStorage.getItem(url) || "");
        let obj: Graph;
        if (!item) {
            throw new Error("Resource not found." + url);
        }
        try {
            obj = JSON.parse(item);
        } catch (err: any) {
            throw new Error("Cannot parse resource." + err.toString());
        }
        return obj;
    }
    async set(url: string, value: GraphDiff | NodeArtifact | GraphArtifact): Promise<void> {
        let events: GraphDiff[] = [];
        const state: any = {};
        if ("changes" in value) {
            // load the events
            const eventStr = await localStorage.getItem(eventsPrefix + url);
            if (!eventStr) {
                events = [];
            } else if(eventStr) {
                try {
                    events = JSON.parse(eventStr);
                } catch (err: any) {
                    throw new Error("Cannot parse events. Error: " + err.toString());
                }
            }
            value.time = Date.now();
            events.push(value);
            events.forEach((event) => {
                event.changes.forEach((change: any) => {
                    applyChange(state, true, change);
                });
            });
            const crc = Hashes.CRC32(JSON.stringify(state));
            if (crc !== value.crc) {
                console.log("state", value, JSON.parse(JSON.stringify(state)));
                throw new Error(`CRC Mismatch.  Expected ${crc} got ${value.crc}`);
            }
            await localStorage.setItem(eventsPrefix + url, JSON.stringify(events));
            await localStorage.setItem(url, JSON.stringify(state));
            await this.updateToc(url, {
                id: state.id,
                lastUpdate: Date.now(),
                type: "graph",
                icon: state.properties.icon,
                description: state.properties.description,
                name: state.properties.name,
                version: state.version,
            } as TocItem);
        } else if ("node" in value) {
            const key = artifactsPrefix + url + "." + value.node.version;
            localStorage.setItem(key, JSON.stringify(value.node));
            await this.updateToc(key, {
                id: value.node.id,
                lastUpdate: Date.now(),
                type: "publishedNode",
                description: value.node.properties.description,
                icon: value.node.properties.icon,
                name: value.node.properties.name,
                version: value.node.version,
            } as TocItem);
        } else if ("graph" in value) {
            const key = artifactsPrefix + url + "." + value.graph.version;
            localStorage.setItem(artifactsPrefix + url + "." + value.graph.version, JSON.stringify(value.graph));
            await this.updateToc(key, {
                id: value.graph.id,
                lastUpdate: Date.now(),
                type: "publishedGraph",
                icon: value.graph.properties.icon,
                description: value.graph.properties.description,
                name: value.graph.properties.name,
                version: value.graph.version,
            } as TocItem);
        } else {
            throw new Error("Set called without a recognized type");
        }
    }
    async delete(url: string): Promise<void> {
        // HACK: also do this for event prefix, silently fail if there's nothing there
        const sToc = await localStorage.getItem(tocKey);
        let toc: Toc;
        if (!sToc) {
            throw new Error("Cannot find TOC.");
        } else {
            try {
                toc = JSON.parse(sToc);
            } catch (err: any) {
                throw new Error("Cannot parse toc" + err.toString());
            }
        }
        delete toc[url];
        await localStorage.setItem(tocKey, JSON.stringify(toc));
        if (localStorage.getItem(eventsPrefix + url) !== null) {
            localStorage.removeItem(eventsPrefix + url);
        }
        return await localStorage.removeItem(url);
    }
}
