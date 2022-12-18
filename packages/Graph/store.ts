import { defineStore } from 'pinia';
import type Pinia from 'pinia';
import {newId} from "@plastic-io/graph-editor-vue3-utils";
import type {Graph, Node} from "@plastic-io/plastic-io";
import {useStore as useGraphManagerStore} from "@plastic-io/graph-editor-vue3-manager";
import {useStore as useInputStore} from "@plastic-io/graph-editor-vue3-input";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {template, set} from "@plastic-io/graph-editor-vue3-help-overlay";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
export const useStore: any = defineStore('graph', {
  state: () => ({
    mapScale: 1,
    hoveredNode: null as Node | null,
    hoveredPort: null,
    locked: null,
    groupNodes: [],
    movingNodes: [],
    inputStore: useInputStore(),
    managerStore: useGraphManagerStore(),
    graphOrchestratorStore: useOrchestratorStore(),
    preferencesStore: usePreferencesStore(),
    keys: {} as Record<string, string>,
    buttonMap: {
      "0": "lmb",
      "2": "rmb",
      "1": "mmb"
    },
    workspaceElement: null as null | Element,
    selectedNodes: [] as Node[],
    selectedNode: null,
    view: {x: 0, y: 0, k: 1},
    boundingRect: {
        visible: false,
        x: 0,
        y: 0,
        height: 0,
        width: 0
    },
    selectionRect: {
        visible: false,
        x: 0,
        y: 0,
        height: 0,
        width: 0
    },
    presentation: false,
    graph: null as Graph | null,
    graphSnapshot: null as Graph | null,
    showHelp: false,
    inRewindMode: false,
    translating: {} as any,
  }),
  actions: {
    updateGraphFromSnapshot(description: string) {
        this.graph = JSON.parse(JSON.stringify(this.graphSnapshot));
    },
    isGraphTarget(e): boolean {
        let parentNode = e.target;
        const navEl = document.getElementsByClassName('graph-nav-drawer')[0];
        if (this.locked) {
            while (parentNode) {
                if (parentNode.className === "node") {
                    return false;
                }
                parentNode = parentNode.parentNode;
            }
        }
        if (navEl && navEl.contains(e.target)) {
            return false;
        }
        return (!/^(no-graph-target|v-list|v-menu)/.test(e.target.className));
    },
    getItemAt(e) {
        while (e.parentNode) {
            if (e.className === "node-inputs" || e.className === "node-outputs") {
                return {port: true};
            }
            if (e.className === "node") {
                const nodeId = e.getAttribute("x-node-id");
                return {
                    node: this.graph!.nodes.find((v) => {
                        return v.id === nodeId;
                    }),
                };
            }
            e = e.parentNode;
        }
        return {};
    },
    scale(e: WheelEvent) {
        console.log('scale');
        // do not track control panel inputs
        if (!this.isGraphTarget(e) || this.showHelp || this.presentation) {
            return;
        }
        const mouse = this.inputStore.getMousePosFromEvent(e);
        const ok = this.view.k;
        const delta =
            ((e as any).wheelDelta ? (e as any).wheelDelta / 120 : -e.deltaY / 3) * 0.01;
        let x = this.view.x;
        let y = this.view.y;
        let k = this.view.k;
        k += delta || 1;
        k = Math.min(Math.max(k, 0.1), 4);
        const target = {
            x: (mouse.x - x) / ok,
            y: (mouse.y - y) / ok
        };
        x = -target.x * k + mouse.x;
        y = -target.y * k + mouse.y;
        const view = {
            k,
            x: Math.floor(x),
            y: Math.floor(y),
        };
        this.view = view;
    },
    copyNodes(nodes: Node[]) {
        nodes = JSON.parse(JSON.stringify(nodes));
        const nodeIds = nodes.map(v => v.id);
        // get rid of connectors that point to nodes not in this array
        nodes.forEach((node) => {
            node.edges.forEach((edge) => {
                const dropConnectors = [] as any[];
                edge.connectors.forEach((connector) => {
                    if (nodeIds.indexOf(connector.nodeId) === -1) {
                        dropConnectors.push(connector);
                    }
                });
                dropConnectors.forEach((connector) => {
                    edge.connectors.splice(edge.connectors.indexOf(connector), 1);
                });
            });
        });
        return nodes;
    },
    evCut(e) {
        if (!this.isGraphTarget(e)
            || /dont-propagate-copy/.test(e.target.className)
            || this.selectedNodes.length === 0
            || /input|textarea/i.test(e.target.tagName)) {
            return;
        }
        console.warn("Clipboard cut captured by graph editor");
        e.clipboardData.setData(this.nodeMimeType, JSON.stringify(this.copyNodes(this.selectedNodes), null, "\t"));
        this.deleteSelected();
        e.preventDefault();
    },
    evCopy(e) {
        if (!this.isGraphTarget(e)
                || /dont-propagate-copy/.test(e.target.className)
                || this.selectedNodes.length === 0
                || /input|textarea/i.test(e.target.tagName)) {
            return;
        }
        console.warn("Clipboard copy captured by graph editor");
        e.clipboardData.setData(this.nodeMimeType, JSON.stringify(this.copyNodes(this.selectedNodes), null, "\t"));
        e.preventDefault();
    },
    evPaste(e) {
        if (!this.isGraphTarget(e)
            || /dont-propagate-copy/.test(e.target.className)
            || /input|textarea/i.test(e.target.tagName)) {
            return;
        }
        console.warn("Clipboard paste captured by graph editor");
        const data = e.clipboardData.getData(this.nodeMimeType);
        this.tryPasteNodeString(data);
        e.preventDefault();
    },
    tryPasteNodeString(data) {
        const msg = "The text pasted onto the graph does not appear to be node data.";
        let nodes;
        const er = () => {
            this.raiseError(msg);
            console.warn(msg);
        };
        try {
            nodes = JSON.parse(data);
        } catch(err) {
            console.error(err);
            return er();
        }
        if (!Array.isArray(nodes)) {
            return er();
        }
        for (var x = 0; x < nodes.length; x += 1) {
            if(!this.validateNode(nodes[x])){
                return er();
            }
        }
        this.pasteNodes(nodes);
    },
    validateNode(node) {
        if (
            !node.id ||
            !node.edges ||
            !Array.isArray(node.edges) ||
            typeof node.properties !== "object" ||
            node.properties.x === undefined ||
            node.properties.y === undefined ||
            node.properties.z === undefined ||
            typeof node.template !== "object" ||
            node.template.set === undefined ||
            node.template.vue === undefined
        ) {
            return false;
        }
        return true;
    },
    zoomOut() {
        this.view = {
          ...this.view,
          k: Math.max(this.view.k - .10, .10),
        };
    },
    zoomIn() {
        this.view = {
          ...this.view,
          k: Math.min(this.view.k + .10, 4),
        };
    },
    resetView() {
        this.view = {
          ...this.view,
          x: 0,
          y: 0,
        };
    },
    resetZoom() {
        this.view = {
            ...this.view,
            k: 1,
        };
    },
    togglePresentation() {},
    zoom() {},
    toggleSelectedNodePresentationMode() {},
    nudgeUp() {},
    nudgeDown() {},
    nudgeLeft() {},
    nudgeRight() {},
    bringToFront() {},
    bringForward() {},
    sendToBack() {},
    sendBackward() {},
    deleteSelected() {},
    ungroupSelected() {},
    groupSelected() {},
    redo() {},
    undo() {},
    duplicateSelection() {},
    togglePanelVisibility() {},
    clearSchedulerErrorItem() {},
    clearSchedulerError() {},
    setArtifact() {},
    updateNodeData() {},
    clearArtifact() {},
    getNodeById(nodeId: string): any {},
    async open(graphId: string) {
      const graphManager = useGraphManagerStore();
      const graphOrchestrator = useOrchestratorStore();
      if (!graphOrchestrator.dataProviders.graph) {
        throw new Error('No data providers to open a graph with.');
        return;
      }
      let graph: Graph | null = null;
      try {
        graph = await graphOrchestrator.dataProviders.graph.get(graphId);
      } catch (err: any) {
        graph = graphManager.createGraph("");
      }
      this.graph = graph;
      this.graphSnapshot = JSON.parse(JSON.stringify(graph));
      graphOrchestrator.createScheduler();
    },
    setView(e: {x: number, y: number, k: number}) {
      this.view = e;
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
  },
});
