import {toJSON, fromJSON} from 'flatted';
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
                this.updateToc(url, 'update');
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
    async set(url: string, value: any, type: string): Promise<void> {
        const db = await this.open();
        let artifact = (value as any);
        if (type === 'update') {
            const tx = db.transaction("events", "readwrite");
            tx.oncomplete = () => {
                this.updateToc(url, type);
            }
            artifact.documentId = url;
            tx.objectStore("events").add(artifact);
        } else if (type === 'artifact') {
            const tx = db.transaction("documents", "readwrite");
            tx.oncomplete = () => {
                this.updateToc(artifact.id, type);
            }
            artifact = artifact.graph;
            artifact.id = `${artifact.id}.${artifact.version}`;
            tx.objectStore("documents").add(artifact);
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
    async updateToc(url: string, type: string) {
        let item: any;
        try {
            item = await this.get(url, type) as any;
        } catch (_) {}
        const db = await this.open();
        const toc = await this.getToc();
        const tx = db.transaction("documents", "readwrite");
        item = item.graph ? item.graph : item;
        if (item) {
            type = type === 'update' ? 'graph' : 'publishedGraph';
            toc[url] = {
                description: item.properties.description,
                icon: item.properties.icon,
                id: item.id,
                url: item.url,
                lastUpdate: item.properties.lastUpdate,
                name: item.properties.name,
                type,
                version: item.version,
            };
        } else {
            delete toc[url];
        }
        tx.oncomplete = () => {
          postMessage({
            source: 'toc-update',
            event: toJSON({toc, graph: item}),
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
        console.debug(`Projected graph from ${events.length} events in ${performance.now() - start}ms`);
        return state;
    }
    async get(url: string, type: string): Promise<Graph | any> {
        if (url === 'toc.json') {
            return await this.getToc();
        }
        if (type === 'artifact') {
            return await this.fetchItem('documents', url);
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
  const args = fromJSON(e.data.args);
  const method = e.data.method;

  const response = await provider[method].apply(provider, args);

  postMessage({
    source: id,
    event: toJSON(response),
  });

}