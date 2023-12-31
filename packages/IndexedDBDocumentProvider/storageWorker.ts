import {toJSON} from 'flatted';
import type {Node, Graph} from "@plastic-io/plastic-io";
import type {Toc, TocItem, GraphDiff, NodeArtifact, GraphArtifact} from "@plastic-io/graph-editor-vue3-document-provider";
const DBNAME = "plastic-io-document-provider";
import {applyChange, diff} from "deep-diff";
class IndexDBDataProvider {
    open(): any {
        return new Promise((success) => {
            // Open the indexedDB.
            const request = self.indexedDB.open(DBNAME, 1);
            request.onupgradeneeded = (event: any) => {
                const db = event.target.result;
                const eventStore = db.createObjectStore("events", { keyPath: "id" });
                eventStore.createIndex("documentId", "documentId", { unique: false });
                const documentStore = db.createObjectStore("documents", { keyPath: "id" });
            }
            request.onerror = (err) => {
                throw new Error(`Error opening/creating IndexedDB` + err);
            };
            request.onsuccess = (event: any) => {
                success(event.target.result);
            }
        });
    }
    deleteEvents(url: string) {
        return new Promise(async (success, fail) => {
            const events = [] as any;
            const db = await this.open();
            const tx = db.transaction("events", "readwrite");
            const objectStore = tx.objectStore("events");
            const index = objectStore.index("documentId");
            index.openCursor(IDBKeyRange.only(url)).onsuccess = (event: any) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    success(null);
                }
            }
            tx.oncomplete = () => {
                this.updateToc(url);
            }
        });
    }
    getEvents(url: string): Promise<GraphDiff[] | any> {
        return new Promise(async (success, fail) => {
            const events = [] as any;
            const db = await this.open();
            const tx = db.transaction("events", "readonly");
            const objectStore = tx.objectStore("events");
            const index = objectStore.index("documentId");
            index.openCursor(IDBKeyRange.only(url)).onsuccess = (event: any) => {
                const cursor = event.target.result;
                if (cursor) {
                    events.push(cursor.value);
                    cursor.continue();
                } else {
                    success(events);
                }
            }
        });
    }
    async set(url: string, value: GraphDiff | NodeArtifact | GraphArtifact): Promise<void> {
        const db = await this.open();
        if ("changes" in value) {
            // update a graph
            const tx = db.transaction("events", "readwrite");
            tx.oncomplete = () => {
                this.updateToc(url);
            }
            (value as any).documentId = url;
            tx.objectStore("events").add(value);
        } else if ("node" in value) {
            // publish a node
        } else if ("graph" in value) {
            // publish a graph
        } else {
            throw new Error("Set called without a recognized type");
        }
    }
    async fetchItem(storeName: string, id: any) {
        return new Promise(async (resolve, reject) => {
            const db = await this.open();
            const transaction = db.transaction(storeName, "readonly");
            const store = transaction.objectStore(storeName);
            const request = store.get(id);
            request.onsuccess = () => {
                if (request.result) {
                    resolve(request.result);
                } else {
                    resolve(null); // No matching record found
                }
            };
            request.onerror = () => {
                reject(request.error);
            };
        });
    }
    async getToc(): Promise<any> {
        const toc = await this.fetchItem('documents', 'toc');
        return toc || {id: 'toc'};
    }
    async updateToc(url: string) {
        let graph;
        try {
            graph = await this.get(url) as any;
        } catch (_) {}
        const db = await this.open();
        const toc = await this.getToc();
        const tx = db.transaction("documents", "readwrite");
        if (graph) {
            toc[url] = {
                description: graph.properties.description,
                icon: graph.properties.icon,
                id: graph.id,
                url: graph.url,
                lastUpdate: graph.properties.lastUpdate,
                name: graph.properties.name,
                type: 'graph',
                version: graph.version,
            };
        } else {
            toc[url] = null;
        }
        tx.oncomplete = () => {
          postMessage({
            source: 'toc-update',
            event: toJSON(toc),
          });
        }
        tx.objectStore("documents").put(toc);
    }
    async projectGraphEvents(url: string) {
        const start = performance.now();
        const events = await this.getEvents(url);
        if (events.length === 0) {
            return null;
        }
        const state = {};
        events.sort((a: any, b: any) => {
            return a.version - b.version;
        }).forEach((event: any) => {
            event.changes.forEach((change: any) => {
                applyChange(state, true, change);
            });
        });
        console.debug(`projectGraphEvents`, performance.now() - start);
        return state;
    }
    async get(url: string): Promise<Graph | any> {
        if (url === 'toc.json') {
            return await this.getToc();
        }
        const graph = await this.projectGraphEvents(url);
        return JSON.parse(JSON.stringify(graph));
    }
    async delete(url: string): Promise<void> {
        await this.deleteEvents(url);
    }
}

const provider = new IndexDBDataProvider() as any;

onmessage = async (e: any) => {
  const id = e.data.id;
  const args = e.data.args;
  const method = e.data.method;

  const response = await provider[method].apply(provider, args);

  postMessage({
    source: id,
    event: toJSON(response),
  });

}