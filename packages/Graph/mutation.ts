import { externalFields, publishedIdOf, pinFor } from "./components";
import {authorizedFetch} from "@plastic-io/graph-editor-vue3-authentication-provider";
import {markRaw} from "vue";
import getName from "@plastic-io/graph-editor-names";
import {template, set} from "@plastic-io/graph-editor-vue3-help-overlay";
import {newId, deref, loadScripts} from "@plastic-io/graph-editor-vue3-utils";
// `updateNodeFields` still needs a structural diff to work out which IO field
// was renamed, so that it can rewrite the connectors that referred to it.
// Everything else compares with the shared deep equality helper.
import {applyChange, observableDiff} from "deep-diff";
import type {Graph, Edge} from "@plastic-io/plastic-io";
import {deepEqual} from "@plastic-io/graph-crdt";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {GraphCrdtSession} from "./crdt";
import patchInto from "./project";
let ioChangeTimer = 0 as any
const CHANGE_TIMEOUT = 1000;

/**
 * `version` and `lastUpdate` are stamped by the act of saving, so comparing
 * them would make every save look like a change and every save would then
 * cause another one.
 */
function withoutVolatileFields(graph: any) {
    if (!graph) {
        return graph;
    }
    const properties = {...(graph.properties || {})};
    delete properties.lastUpdate;
    return {...graph, version: 0, properties};
}
export default {
    updateNodeUrl(e: {nodeId: string, url: string}) {
        const node = this.graphSnapshot.nodes.find((v: any) => v.id === e.nodeId);
        node.url = e.url;
        this.updateGraphFromSnapshot("Change Node URL");
    },
    updateNodeProperties(e: {
        nodeId: string,
        properties: any,
    }) {
        const node = this.graphSnapshot.nodes.find((v:any) => v.id === e.nodeId);
        if (!node) {
            return this.raiseError(new Error("Cannot find node to update."));
        }
        if (deepEqual(node.properties, e.properties)) {
            return;
        }
        node.properties = e.properties;
        this.updateGraphFromSnapshot("Update Node Properties");
    },
    async addItem(e: any) {
        const artifactPrefix = "artifacts/";
        let item, er;
        const server = this.preferencesStore.preferences.graphHTTPServer;
        if (e["artifact-url"] && server) {
            // A server artifact is a published component: fetch it with its manifest so
            // the imported node carries the pin admission checks the copy against.
            try {
                const publishedId = publishedIdOf(e.id) || publishedIdOf(e["artifact-url"]);
                const provider = this.versionsProvider();
                if (provider && publishedId && typeof provider.component === "function") {
                    const { manifest, artifact } = await provider.component(publishedId, e.version || "latest");
                    item = artifact;
                    e.manifest = manifest;
                    e.publishedId = publishedId;
                    if (manifest) {
                        e.version = manifest.version;
                    }
                }
                if (!item) {
                    const artifactUrl = server + e["artifact-url"];
                    item = await authorizedFetch(artifactUrl);
                    item = await item.json();
                    e.url = artifactUrl;
                    item.url = artifactUrl;
                }
            } catch (err) {
                er = err;
            }
        } else if (e.type === 'publishedGraph') {
            item = await this.orchestratorStore.dataProviders.publish.get(e.id);
        } else if (e.type === 'component') {
            item = e;
        } else  if (e.url && /api\.github\.com/.test(e.url)) {
            const data = await fetch(e.url);
            const dataJson = await data.json();
            item = JSON.parse(atob(dataJson.content));
        } else if (e.url) {
            try {
                item = await fetch(e.url);
                item = await item.json();
            } catch (err) {
                er = err;
            }
        } else {
            try {
                // the artifact route is /artifacts/{id}/{version}
                item = await this.orchestratorStore.dataProviders.publish.get(artifactPrefix + publishedIdOf(e.id) + "/" + e.version);
            } catch (err) {
                er = err;
            }
        }
        if (!item || er) {
            this.raiseError(new Error("Cannot open item. " + er));
        } else {
            e.item = item;
            delete e.item.artifact;
            delete e.item.url;
            const method = ({
                publishedNode: "addNodeItem",
                publishedGraph: "addGraphItem",
                component: "addComponentItem"
            } as any)[e.type];
            this[method](e);
        }
    },
    addComponentItem(e: any) {
        const id = newId();
        const pos = {
            x: (e.x - this.view.x) / this.view.k,
            y: (e.y - this.view.y) / this.view.k,
        };
        pos.x = Math.floor(pos.x / 10) * 10;
        pos.y = Math.floor(pos.y / 10) * 10;
        const component = (self as any)
            .plastic.app._instance.appContext.components[e.component];
        const edges = [] as any;
        const inputs = [] as any;
        const outputs = [] as any;
        Object.keys(component.props || {}).forEach((name: any) => {
            inputs.push({
                name,
                type: 'Object',
                external: false,
                visible: false,
            });
        });
        Object.keys(component.emits || {}).forEach((name: any) => {
            outputs.push({
                name,
                type: 'Object',
                external: false,
                visible: false,
            });
            edges.push({
                connectors: [],
                field: name,
            });
        });
        const vue = `<template>
    <${e.component} v-bind="$props" id="node_location_${id}"></${e.component}>
</template>
<script language="typescript">
export default {
    methods: {
        ev(e) {
            this.$emit('set', $event);
        }
    },
}
</script>`;
        const set = 'edges[field] = value;';
        const node = {
            id,
            linkedNode: null,
            edges,
            version: this.graphSnapshot.version,
            graphId: this.graphSnapshot.id,
            artifact: null,
            url: null,
            data: null,
            properties: {
                inputs,
                outputs,
                groups: [],
                name: e.name,
                description: e.description,
                tags: '',
                icon: '',
                positionAbsolute: false,
                appearsInPresentation: false,
                appearsInExport: false,
                x: pos.x,
                y: pos.y,
                z: 0 + this.preferencesStore.preferences.newNodeOffset.z,
                presentation: {
                    x: pos.x,
                    y: pos.y,
                    z: 0 + this.preferencesStore.preferences.newNodeOffset.z,
                },
            },
            template: {
                set,
                vue,
            },
        };
        this.graphSnapshot.nodes.push(node);
        this.updateGraphFromSnapshot("Import New Graph");
    },
    addGraphItem(e: any) {
        const pos = {
            x: (e.x - this.view.x) / this.view.k,
            y: (e.y - this.view.y) / this.view.k,
        };
        pos.x = Math.floor(pos.x / 10) * 10;
        pos.y = Math.floor(pos.y / 10) * 10;
        const graph = e.item;
        const { inputs: linkedGraphInputs, outputs: linkedGraphOutputs } = externalFields(graph);
        const publishedId = e.publishedId || publishedIdOf(e.id) || e.id;
        // create IOs (inputs, outputs/edges) on outter node to support IO of graphs's externals
        const id = newId();
        const node = {
            id,
            edges: [],
            version: this.graphSnapshot.version,
            graphId: this.graphSnapshot.id,
            artifact: e.url || ("artifacts/" + publishedId + "." + e.version),
            url: getName().replace(/ /g, ''),
            data: null,
            linkedGraph: {
                id: publishedId,
                version: e.version,
                revisionId: e.manifest && e.manifest.provenance && e.manifest.provenance.fromGraph ? e.manifest.provenance.fromGraph.revisionId : undefined,
                data: {},
                loaded: true,
                graph,
                properties: {},
                fields: {
                    inputs: linkedGraphInputs,
                    outputs: linkedGraphOutputs
                }
            },
            properties: {
                inputs: [],
                outputs: [],
                groups: [],
                name: e.name,
                description: e.description,
                tags: [],
                icon: "mdi-lan",
                component: pinFor(e.manifest),
                positionAbsolute: false,
                appearsInPresentation: false,
                appearsInExport: false,
                x: pos.x,
                y: pos.y,
                z: 0 + this.preferencesStore.preferences.newNodeOffset.z,
                presentation: {
                    x: pos.x,
                    y: pos.y,
                    z: 0 + this.preferencesStore.preferences.newNodeOffset.z,
                },
            },
            template: {
                // url: string, value: any, field: string, currentNode: Node, graph?: Graph
                set: ``,
                vue: "<template><div></div></template><script>export default {}</script>",
            },
        } as any;
        Object.keys(linkedGraphInputs).forEach((ioKey) => {
            const io: any = linkedGraphInputs[ioKey];
            node.properties.inputs.push({
                name: io.field,
                external: false,
                visible: true,
                type: io.type,
            });
        });
        Object.keys(linkedGraphOutputs).forEach((ioKey) => {
            const io: any = linkedGraphOutputs[ioKey];
            node.properties.outputs.push({
                name: io.field,
                visible: true,
                external: false
            });
            node.edges.push({
                field: io.field,
                connectors: [],
                type: io.type,
            });
        });
        this.graphSnapshot.nodes.push(node);
        this.updateGraphFromSnapshot("Import New Graph");
    },
    async addDroppedItem(e: any) {
        const pos = {
            x: (e.x - this.view.x) / this.view.k,
            y: (e.y - this.view.y) / this.view.k,
        };
        pos.x = Math.floor(pos.x / 10) * 10;
        pos.y = Math.floor(pos.y / 10) * 10;
        const id = newId();
        e.item.id = id;
        e.item.url = getName().replace(/ /g, '');
        e.item.version = this.graphSnapshot.version;
        e.item.graphId = this.graphSnapshot.id;
        e.item.properties.x = pos.x;
        e.item.properties.y = pos.y;
        e.item.properties.z = 0 + this.preferencesStore.preferences.newNodeOffset.z;
        // ensure connectors are not imported
        e.item.edges.forEach((edge: Edge) => {
            edge.connectors = [];
        });
        if (e.item.properties.scripts) {
            await loadScripts(e.item.properties.scripts.replace('\n', ',').split(','));
        }
        this.graphSnapshot.nodes.push(e.item);
        this.updateGraphFromSnapshot("Drop New Item");
    },
    addNodeItem(e: any) {
        const pos = {
            x: (e.x - this.view.x) / this.view.k,
            y: (e.y - this.view.y) / this.view.k,
        };
        pos.x = Math.floor(pos.x / 10) * 10;
        pos.y = Math.floor(pos.y / 10) * 10;
        const id = newId();
        e.item.loaded = true;
        // ensure connectors are not imported
        e.item.edges.forEach((edge: Edge) => {
            edge.connectors = [];
        });
        // make compatablie with pre visiblity artifacts
        ['inputs', 'outputs'].forEach((io) => {
            e.item.properties[io].forEach((i: any) => {
                i.visible = i.visible === undefined ? true : i.visible;
            });
        });
        const publishedId = e.publishedId || publishedIdOf(e.id) || e.id;
        const node = {
            id: id,
            linkedNode: e.item,
            edges: e.item.edges,
            version: this.graphSnapshot.version,
            graphId: this.graphSnapshot.id,
            artifact: e.url || ("artifacts/" + publishedId + "." + e.version),
            url: e.url,
            data: e.item.data,
            properties: {
                inputs: e.item.properties.inputs,
                outputs: e.item.properties.outputs,
                groups: [],
                name: e.name,
                description: e.description,
                scripts: e.scripts || '',
                component: pinFor(e.manifest),
                tags: e.item.properties.tags,
                icon: e.item.properties.icon,
                positionAbsolute: false,
                appearsInPresentation: false,
                appearsInExport: false,
                x: pos.x,
                y: pos.y,
                z: 0 + this.preferencesStore.preferences.newNodeOffset.z,
                presentation: {
                    x: pos.x,
                    y: pos.y,
                    z: 0 + this.preferencesStore.preferences.newNodeOffset.z,
                },
            },
            template: {
                set: e.item.template.set,
                vue: e.item.template.vue,
            },
        };
        this.graphSnapshot.nodes.push(node);
        this.updateGraphFromSnapshot("Import New Node");
    },
    undo() {
        if (!this.crdtSession) { return; }
        this.crdtSession.undo();
    },
    redo() {
        if (!this.crdtSession) { return; }
        this.crdtSession.redo();
    },
    /**
     * Step through the history.  The undo manager only ever rolls back this
     * user's own work, so moving through history cannot disturb anyone else
     * who is editing the same graph.
     */
    moveHistoryPosition(move: number) {
        if (!this.crdtSession) { return; }
        this.crdtSession.move(move);
    },
    createGraph(id: string): Graph {
      const name = getName();
      const now = Date.now();
      return {
        id,
        version: 0,
        url: name.replace(/ /g, ''),
        nodes: [],
        properties: {
          name,
          description: "",
          exportable: false,
          icon: "mdi-graph",
          createdBy: "",
          createdOn: now,
          lastUpdate: now,
          height: 150,
          width: 300,
          timeout: 30000,
          logLevel: 2,
          template: this.preferencesStore.preferences!.defaultNewGraphTemplate,
        } as any
      };
    },
    async transact(description: string, callback: any) {
        await callback(this.graphSnapshot);
        this.updateGraphFromSnapshot(description);
    },
    /**
     * Save the working snapshot into the CRDT document.
     *
     * The reconciler turns "the graph should now look like this" into the
     * smallest set of granular operations that will get there, which is what
     * makes a concurrent edit from someone else merge instead of collide.
     */
    updateGraphFromSnapshot(description: string) {
        if (!this.crdtSession || !this.graphSnapshot) {
            // A panel can outlive the graph it belongs to, for instance while
            // navigating away mid-edit.
            return;
        }
        const current = this.crdtSession.projection();
        if (current && deepEqual(withoutVolatileFields(current), withoutVolatileFields(this.graphSnapshot))) {
            return;
        }
        this.graphSnapshot.version = ((current && current.version) || 0) + 1;
        if (this.graphSnapshot.properties) {
            this.graphSnapshot.properties.lastUpdate = Date.now();
        }
        this.lastChangeName = description;
        this.crdtSession.commit(description, this.graphSnapshot);
    },
    /**
     * Fold a new projection of the document into the three plain-JSON trees
     * the editor reads from, patching in place so untouched nodes keep their
     * object identity and Vue leaves them alone.
     */
    applyProjection(projection: any, info: {local: boolean}) {
        this.graph = patchInto(this.graph, projection);
        if (!info.local) {
            // Undo, redo, browser storage and remote peers all arrive here.
            // The working snapshot has to follow them, because the next local
            // save reconciles the document against it and would otherwise
            // quietly revert whatever just arrived.
            this.graphSnapshot = patchInto(this.graphSnapshot, projection);
        }
        this.updatingSnapshotLocally = true;
        this.graphSnapshotStore.graph = patchInto(this.graphSnapshotStore.graph, projection);
        this.updatingSnapshotLocally = false;
    },
    /** Detach from the open graph, releasing its document and providers. */
    closeGraph() {
        if (!this.crdtSession) {
            // Nothing is open, so there is nothing for the providers to let go
            // of.  Without this guard the first open would disconnect providers
            // that had never connected.
            return;
        }
        const orchestrator = useOrchestratorStore();
        orchestrator.syncProviders.forEach((provider: any) => {
            if (typeof provider.disconnect !== "function") {
                return;
            }
            try {
                provider.disconnect();
            } catch (err) {
                console.error(`Sync provider "${provider.name}" could not disconnect.`, err);
            }
        });
        if (this.crdtSession) {
            this.crdtSession.destroy();
            this.crdtSession = null;
        }
        this.events = [];
        this.historyPosition = 0;
        this.graphLoaded = false;
    },
    /**
     * Drop the local copy of the open graph and load it again from the server.
     * Used after the server rejects a change: the local document holds structs
     * the server refused, and Yjs cannot take them back out.  The browser copy
     * is cleared too, or it would resend the refused change on the next open.
     */
    async reloadFromServer(reason: string) {
        const graphId = this.crdtSession ? this.crdtSession.graphId : null;
        if (!graphId) {
            return;
        }
        console.warn(`Reloading graph ${graphId} from the server: ${reason}`);
        const orchestrator = useOrchestratorStore();
        this.closeGraph();
        for (const provider of orchestrator.syncProviders) {
            if (provider.name === "indexeddb" && typeof provider.remove === "function") {
                try {
                    await provider.remove(graphId);
                } catch (err) {
                    console.error("Cannot clear the browser copy of the graph.", err);
                }
            }
        }
        await this.open(graphId);
    },
    /** Read a pre-CRDT graph out of the legacy event store, if there is one. */
    async loadLegacyGraph(graphId: string) {
        const orchestrator = useOrchestratorStore();
        if (!orchestrator.dataProviders.graph) {
            return null;
        }
        try {
            const graph = await orchestrator.dataProviders.graph.get(graphId);
            return graph && graph.id ? graph : null;
        } catch (err) {
            return null;
        }
    },
    async open(graphId: string) {
        const orchestrator = useOrchestratorStore();
        // Opening a second graph in the same session would otherwise leave the
        // first one's document, undo manager and provider subscriptions alive
        // and still listening.
        this.closeGraph();
        const session = markRaw(new GraphCrdtSession(graphId));
        this.crdtSession = session;
        this.isNewGraph = false;

        for (const provider of orchestrator.syncProviders) {
            try {
                await provider.connect(graphId, session);
            } catch (err) {
                console.error(`Sync provider "${provider.name}" could not connect.`, err);
            }
        }

        if (session.isEmpty) {
            const legacy = await this.loadLegacyGraph(graphId);
            if (legacy) {
                console.info("Importing a pre-CRDT graph into a Yjs document.", graphId);
                session.seed(legacy);
            } else {
                this.isNewGraph = true;
                session.seed(this.createGraph(graphId));
            }
        }

        const projection = session.projection();
        this.graphSnapshot = deref(projection);
        this.graph = deref(projection);
        this.graphSnapshotStore.graph = deref(projection);

        session.onProjection((next: any, info: any) => {
            this.applyProjection(next, info);
        });
        session.onHistory((historyEvents: any[], position: number) => {
            this.events = historyEvents;
            this.historyPosition = position;
        });
        session.refresh();

        await this.loadAllScripts(this.graphSnapshot);

        console.groupCollapsed("%cPlastic-IO: %cGraph (CRDT)",
            "color: blue",
            "color: lightblue");
        console.log(deref(this.graphSnapshot));
        console.groupEnd();

        this.graphLoaded = true;
        orchestrator.createScheduler();
    },
    async loadAllScripts(graphSnapshot: any) {
      // Extracting the root-level scripts
      const rootScripts = (graphSnapshot.properties.scripts || '')
        .replace('\n', ',')
        .split(',')
        .filter((script: any) => script); // Filter out empty strings
      // Extracting node-level scripts
      const getGraphScripts = (graph: Graph, arr: string[]) => {
        graph.nodes.forEach((node) => {
            if (node.properties.scripts) {
                arr.push(...node.properties.scripts.replace('\n', ',').split(','));
            }
            if (node.linkedGraph) {
                // recursively fetch all scripts in embedded graphs
                getGraphScripts(node.linkedGraph.graph, arr);
            }
        });
      }
      const nodeScripts: string[] = [];
      getGraphScripts(graphSnapshot, nodeScripts);
      // Combine and load all scripts
      await loadScripts([...rootScripts, ...nodeScripts]);
    },
    updateNodeTemplate(e: {type: string, value: string, nodeId: string}) {
        const node = this.getNodeById(e.nodeId);
        node.template[e.type] = e.value;
        this.updateGraphFromSnapshot(`Update ${e.type} value`);
    },
    updateNodeFields(e: {
        node: any,
    }) {
        const node = this.graphSnapshot.nodes.find((v: any) => v.id === e.node.id);
        let hasChanges = false;
        if (!node) {
            return this.orchestratorStore.raiseError(new Error("Cannot find node to update."));
        }
        observableDiff(node, e.node, (d: any) => {
            hasChanges = true;
            // output changes
            if (d.path[0] === "properties" && d.path[1] === "outputs"
                    && !isNaN(d.path[2])
                    && (d.path[3] === "name" || d.path[3] === "external" || d.path[3] === "type" || d.path[3] === "visible")) {
                applyChange(node, true, d);
                if (d.path[3] === "name") {
                    // also apply the change to local edge names
                    const edge = node.edges.find((ed: {field: string}) => {
                        return ed.field === d.lhs;
                    });
                    edge.field = d.rhs;
                }
            }
            // input changes
            if (d.path[0] === "properties" && d.path[1] === "inputs"
                    && !isNaN(d.path[2])
                    && (d.path[3] === "name" || d.path[3] === "external" || d.path[3] === "type" || d.path[3] === "visible")) {
                applyChange(node, true, d);
                if (d.path[3] === "name") {
                    // also apply the change to the edge connectors that interact with it
                    this.graphSnapshot.nodes.forEach((v: any) => {
                        v.edges.forEach((edge: Edge) => {
                            edge.connectors.forEach((con: {nodeId: string, field: string}) => {
                                if (con.field === d.lhs && con.nodeId === e.node.id) {
                                    con.field = d.rhs;
                                }
                            });
                        });
                    });
                }
            }
        });
        if (hasChanges) {
            clearTimeout(ioChangeTimer);
            ioChangeTimer = setTimeout(() => {
                this.updateGraphFromSnapshot("Rename IO");
            }, CHANGE_TIMEOUT);

        }
    },
    deleteNodeById(id: string) {
        this.graphSnapshot.nodes.forEach((v: any) => {
            // surely if you delete a node, you must delete any connectors that are going to it as well
            v.edges.forEach((edge: {connectors: any[]}) => {
                edge.connectors.forEach((connector: {nodeId: string}, index) => {
                    if (connector.nodeId === id) {
                        edge.connectors.splice(index, 1);
                    }
                });
            });
        });
        // trying to do this in the previous loop causes things to go wrong.  Getter/setters?
        this.graphSnapshot.nodes.forEach((v: any, index: number) => {
            if (id === v.id) {
                this.graphSnapshot.nodes.splice(index, 1);
            }
        });
    },
    deleteConnectorById(id: string) {
        let targetNode: any;
        this.graphSnapshot.nodes.forEach((v: any) => {
            v.edges.forEach((edge: {connectors: any[]}) => {
                edge.connectors.forEach((connector: {id: string}, index) => {
                    if (id === connector.id) {
                        edge.connectors.splice(index, 1);
                        targetNode = v;
                    }
                });
            });
            // remove top level connectors that match
            if (targetNode && v.linkedGraph && targetNode.id === v.id && v.linkedGraph.graph) {
                v.linkedGraph.graph.nodes.forEach((v: any) => {
                    v.edges.forEach((edge: {connectors: any[]}) => {
                        edge.connectors.forEach((connector: {id: string}, index) => {
                            if (id === connector.id) {
                                edge.connectors.splice(index, 1);
                            }
                        });
                    });
                });
            }
        });
    },
    deleteSelected() {
      const selectedNodeIds = this.selectedNodes.map((v: any) => v.id);
      const selectedConnectorIds = this.selectedConnectors.map((v: {id: string}) => v.id);
      this.selectedNodes = [];
      this.selectedConnectors = [];
      this.selectedGroups = [];
      this.groupNodes = [];
      this.hoveredConnector = null;
      this.hoveredNode = null;
      selectedNodeIds.forEach(this.deleteNodeById);
      selectedConnectorIds.forEach(this.deleteConnectorById);
      this.updateGraphFromSnapshot("Delete");
    },
    ungroupSelected() {
      const selectedNodeIds = this.selectedNodes.map((v: any) => v.id);
      this.graphSnapshot.nodes.forEach((v: any) => {
          if (selectedNodeIds.indexOf(v.id) !== -1) {
              v.properties.groups.splice(v.properties.groups.indexOf(this.primaryGroup), 1);
          }
      });
      this.updateGraphFromSnapshot("Ungroup");
    },
    groupSelected() {
      const newGroupID = newId();
      const selectedNodeIds = this.selectedNodes.map((v: any) => v.id);
      this.graphSnapshot.nodes.forEach((v: any) => {
          if (selectedNodeIds.indexOf(v.id) !== -1) {
              if (v.properties.groups.indexOf(newGroupID) === -1) {
                  v.properties.groups.push(newGroupID);
              }
          }
      });
      this.updateGraphFromSnapshot("Group");
    },
    duplicateSelection() {
      if (this.selectedNodes.length > 0) {
          this.pasteNodes(deref(this.selectedNodes), "Duplicate");
      }
    },
    updateNodeData(e: {nodeId: string, data: any}) {
      const node = this.getNodeById(e.nodeId);
      node.data = e.data;
      this.updateGraphFromSnapshot("Update Node Data");
    },
    toggleSelectedNodePresentationMode() {
      this.selectedNodes.forEach((selectedNode: any) => {
          const node = this.graphSnapshot.nodes.find((n: any) => selectedNode.id === n.id);
          node.properties.appearsInPresentation = !node.properties.appearsInPresentation;
      });
      this.updateGraphFromSnapshot("Toggle Node Presentation");
    },
    createNewNode(e: {x: number, y: number}) {
      const pos = {
          x: (e.x - this.view.x) / this.view.k,
          y: (e.y - this.view.y) / this.view.k,
      };
      pos.x = Math.floor(pos.x / 10) * 10;
      pos.y = Math.floor(pos.y / 10) * 10;
      const id = newId();
      const name = getName();
      const node = {
          id,
          edges: [],
          version: this.graphSnapshot!.version,
          graphId: this.graphSnapshot!.id,
          artifact: null,
          url: name.replace(/ /g, ''),
          data: null,
          properties: {
              inputs: [],
              outputs: [],
              groups: [],
              name,
              description: "",
              createdOn: Date.now(),
              lastUpdate: Date.now(),
              tags: [],
              icon: "mdi-node-rectangle",
              positionAbsolute: false,
              appearsInPresentation: false,
              appearsInExport: false,
              x: pos.x,
              y: pos.y,
              z: 0 + this.preferencesStore.preferences!.newNodeOffset.z,
              presentation: {
                  x: pos.x,
                  y: pos.y,
                  z: 0 + this.preferencesStore.preferences!.newNodeOffset.z,
                  order: this.graphSnapshot.nodes.length,
              },
          },
          template: {
              set: this.preferencesStore.preferences!.newNodeHelp ? set : this.preferencesStore.preferences!.defaultNewSetTemplate,
              vue: this.preferencesStore.preferences!.newNodeHelp ? template : this.preferencesStore.preferences!.defaultNewVueTemplate,
          },
      };
      this.graphSnapshot!.nodes.push(deref(node) as any);
      this.updateGraphFromSnapshot('Create New Node');
    }
} as ThisType<any>;
