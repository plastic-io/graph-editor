import {template, set} from "@plastic-io/graph-editor-vue3-help-overlay";
import {newId} from "@plastic-io/graph-editor-vue3-utils";
import {diff, applyChange, revertChange, observableDiff} from "deep-diff";
export default {
    updateNodeTemplate(e: {type: string, value: string, nodeId: string}) {
        const node = this.getNodeById(e.nodeId);
        node.template[e.type] = e.value;
        this.updateGraphFromSnapshot(`Update ${e.type} value`);
    },
    updateNodeFields(e: {
        node: any,
    }) {
        const node = this.graphSnapshot.nodes.find((v: any) => v.id === e.node.id);
        if (!node) {
            return this.orchestratorStore.raiseError(new Error("Cannot find node to update."));
        }
        observableDiff(node, e.node, (d: any) => {
            // output changes
            if (d.path[0] === "properties" && d.path[1] === "outputs"
                    && !isNaN(d.path[2]) && (d.path[3] === "name" || d.path[3] === "external" || d.path[3] === "type")) {
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
                    && !isNaN(d.path[2]) && (d.path[3] === "name" || d.path[3] === "external" || d.path[3] === "type")) {
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
        this.updateGraphFromSnapshot("Rename IO");
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
      selectedNodeIds.forEach(this.deleteNodeById());
      selectedConnectorIds.forEach(this.deleteConnectorById());
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
          this.pasteNodes(JSON.parse(JSON.stringify(this.selectedNodes)), "Duplicate");
      }
    },
    updateNodeData(e: {nodeId: string, data: any}) {
      const node = this.getNodeById(e.nodeId);
      node.data = e.data;
      this.updateGraphFromSnapshot("Update Node Data");
    },
    setArtifact(e: any) {
      this.$patch({
        artifacts: {
          [e.key]: e.value
        },
      });
    },
    toggleSelectedNodePresentationMode() {
      this.selectedNodes.forEach((selectedNode: any) => {
          const node = this.graphSnapshot.nodes.find((n: any) => selectedNode.id === n.id);
          node.properties.appearsInPresentation = !node.properties.appearsInPresentation;
      });
      this.updateGraphFromSnapshot("Toggle Node Presentation");
    },
    updateGraphFromSnapshot(description: string) {
        this.$patch({
          graph: JSON.parse(JSON.stringify(this.graphSnapshot)),
        });
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
