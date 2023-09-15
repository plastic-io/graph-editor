import {template, set} from "@plastic-io/graph-editor-vue3-help-overlay";
import {newId, deref} from "@plastic-io/graph-editor-vue3-utils";
import {diff, applyChange, revertChange, observableDiff} from "deep-diff";
import type {Graph} from "@plastic-io/plastic-io";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
const events = [];
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
        if (!diff(node.properties, e.properties)) {
            return;
        }
        node.properties = e.properties;
        this.updateGraphFromSnapshot("Update Node Properties");
    },
    async addItem(e: any) {
        const artifactPrefix = "artifacts/";
        let item, er;
        if (e.type === 'component') {
            item = e;
        } else if (e["artifact-url"] && this.preferencesStore.preferences.graphHTTPServer) {
            try {
                const artifactUrl = this.preferencesStore.preferences.graphHTTPServer + e["artifact-url"];
                item = await fetch(artifactUrl);
                item = await item.json();
                e.url = artifactUrl;
                item.url = artifactUrl;
            } catch (err) {
                er = err;
            }
        } else if (e.url) {
            try {
                item = await fetch(e.url);
                item = await item.json();
            } catch (err) {
                er = err;
            }
        } else {
            try {
                item = await this.orchestratorStore.dataProviders.publish.get(artifactPrefix + e.id + "." + e.version);
            } catch (err) {
                er = err;
            }
        }
        if (!item || er) {
            this.raiseError(new Error("Cannot open item. " + er));
        } else {
            e.item = item;
            const method = ({
                publishedNode: "addNodeItem",
                publishedGraph: "addGraphItem",
                component: "addComponentItem"
            } as any)[e.type];
            this[method](e);
        }
    },
    addComponentItem(e: any) {
        console.log('addComponentItem', e);
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
        console.log('addGraphItem');
        const pos = {
            x: (e.x - this.view.x) / this.view.k,
            y: (e.y - this.view.y) / this.view.k,
        };
        pos.x = Math.floor(pos.x / 10) * 10;
        pos.y = Math.floor(pos.y / 10) * 10;
        const linkedGraphInputs: {[key: string]: any} = {};
        const linkedGraphOutputs: {[key: string]: any} = {};
        const graph = e.item;
        graph.nodes.forEach((v: any) => {
            v.properties.inputs.forEach((i: any) => {
                if (i.external) {
                    linkedGraphInputs[i.name] = {
                        id: v.id,
                        field: i.name,
                        type: i.type,
                        visible: i.visible === undefined ? true : i.visible,
                        external: false,
                    } as any;
                }
            });
            v.properties.outputs.forEach((i: any) => {
                if (i.external) {
                    linkedGraphOutputs[i.name] = {
                        id: v.id,
                        field: i.name,
                        type: i.type,
                        visible: i.visible === undefined ? true : i.visible,
                        external: false,
                    } as any;
                }
            });
        });
        // create IOs (inputs, outputs/edges) on outter node to support IO of graphs's externals
        const id = newId();
        const node = {
            id,
            edges: [],
            version: this.graphSnapshot.version,
            graphId: this.graphSnapshot.id,
            artifact: e.url || ("artifacts/" + e.id + "." + e.version),
            url: id,
            data: null,
            linkedGraph: {
                id: e.id,
                version: e.version,
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
                set: `const hostNode = value.context.getters.getNodeById(value.hostNode.id);
    const vect = hostNode.linkedGraph.graph.nodes.find(v => v.id === value.node.id);
    scheduler.url.call(scheduler,
        vect.url,
        value.event,
        '$url',
        hostNode,
        hostNode.linkedGraph.graph);`,
                vue: "",
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
    addDroppedItem(e: any) {
        console.log('addDroppedItem');
        const pos = {
            x: (e.x - this.view.x) / this.view.k,
            y: (e.y - this.view.y) / this.view.k,
        };
        pos.x = Math.floor(pos.x / 10) * 10;
        pos.y = Math.floor(pos.y / 10) * 10;
        const id = newId();
        e.item.id = id;
        e.item.url = id;
        e.item.version = this.graphSnapshot.version;
        e.item.graphId = this.graphSnapshot.id;
        e.item.properties.x = pos.x;
        e.item.properties.y = pos.y;
        e.item.properties.z = 0 + this.preferencesStore.preferences.newNodeOffset.z;
        // ensure connectors are not imported
        e.item.edges.forEach((edge: Edge) => {
            edge.connectors = [];
        });
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
        const node = {
            id: id,
            linkedNode: e.item,
            edges: e.item.edges,
            version: this.graphSnapshot.version,
            graphId: this.graphSnapshot.id,
            artifact: e.url || ("artifacts/" + e.id + "." + e.version),
            url: id,
            data: e.item.data,
            properties: {
                inputs: e.item.properties.inputs,
                outputs: e.item.properties.outputs,
                groups: [],
                name: e.name,
                description: e.description,
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
        this.moveHistoryPosition(-1);
    },
    redo(state: any) {
        this.moveHistoryPosition(1);
    },
    moveHistoryPosition(move: number) {
        const target = this.historyPosition + move;
        if (target > this.events.length || target < 0) {
            return;
        }
        while (this.historyPosition !== target) {
            if (this.historyPosition > target) {
                this.historyPosition -= 1;
                const changes = this.events[this.historyPosition].changes;
                changes.forEach((change: any) => {
                    revertChange(this.graphSnapshot, true, change);
                });
            } else if (this.historyPosition < target) {
                const changes = this.events[this.historyPosition].changes;
                changes.forEach((change: any) => {
                    applyChange(this.graphSnapshot, true, change);
                });
                this.historyPosition += 1;
            }
        }
        this.graph = deref(this.graphSnapshot);
    },
    createGraph(url: string, createdBy: string): Graph {
      const id = newId();
      const now = new Date();
      return {
        id,
        version: 0,
        url,
        nodes: [],
        properties: {
          name: "",
          description: "",
          exportable: false,
          icon: "mdi-graph",
          createdBy: createdBy,
          createdOn: now,
          lastUpdate: now,
          height: 150,
          width: 300,
        }
      };
    },
    updateGraphFromSnapshot(description: string) {
        if (!diff(this.graph, this.graphSnapshot)) {
            console.warn('Graph: updateGraphFromSnapshot called with no updates found.');
            return;
        }
        // there was an actual change detected
        // tick the version number by 1
        this.graphSnapshot.version += 1;
        const changes = diff(this.graph, this.graphSnapshot);
        // gather the difference and store it in an event list for undo/redo
        const graphDiff = {
            id: newId(),
            description,
            changes,
        };
        this.events.push(deref(graphDiff));
        // write to the graph in the graph store
        this.$patch((state: any) => {
          state.description = description;
          graphDiff.changes.forEach((change: any) => {
              applyChange(state.graph, true, change);
          });
        });
        this.historyPosition += 1;
        // make a copy of the change in the snapshot store for data providers
        this.graphSnapshotStore.$patch({
            graph: deref(this.graph),
        });
    },
    async open(graphId: string) {
      const graphOrchestrator = useOrchestratorStore();
      if (!graphOrchestrator.dataProviders.graph) {
        throw new Error('No data providers to open a graph with.');
        return;
      }
      let graph: Graph | null = null;
      try {
        this.graphSnapshot = await graphOrchestrator.dataProviders.graph.get(graphId);
      } catch (err: any) {
        const url = this.getCalculatedGraphUrl();
        this.graphSnapshot = this.createGraph(url, "");
      }
      // don't allow an opening graph to count as a history change
      this.graph = deref(this.graphSnapshot);
      console.groupCollapsed('%cPlastic-IO: %cGraph',
        "color: blue",
        "color: lightblue");
      console.log(deref(this.graphSnapshot));
      console.groupEnd()
      this.graphLoaded = true;
      graphOrchestrator.createScheduler();
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
                applyChange(node, e.node, d);
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
                applyChange(node, e.node, d);
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
            this.updateGraphFromSnapshot("Rename IO");
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
      const node = {
          id,
          edges: [],
          version: this.graph!.version,
          graphId: this.graph!.id,
          artifact: null,
          url: id,
          data: null,
          properties: {
              inputs: [],
              outputs: [],
              groups: [],
              name: "",
              description: "",
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
              },
          },
          template: {
              set: this.preferencesStore.preferences!.newNodeHelp ? set : this.preferencesStore.preferences!.defaultNewSetTemplate,
              vue: this.preferencesStore.preferences!.newNodeHelp ? template : this.preferencesStore.preferences!.defaultNewVueTemplate,
          },
      };
      this.graphSnapshot!.nodes.push(node as any);
      this.updateGraphFromSnapshot('Create New Node');
    }
} as ThisType<any>;
