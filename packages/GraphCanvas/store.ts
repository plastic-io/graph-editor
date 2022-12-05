import { defineStore } from 'pinia';
import {newId} from "@plastic-io/graph-editor-vue3-utils";
import type {Graph, Node} from "@plastic-io/plastic-io";
import {useStore as useGraphManagerStore} from "@plastic-io/graph-editor-vue3-graph-manager";
import {useStore as useGraphOrchestratorStore} from "@plastic-io/graph-editor-vue3-graph-orchestrator";
export const useStore = defineStore('graph-canvas', {
  state: () => ({
    hoveredNode: null,
    hoveredPort: null,
    view: {x: 0, y: 0, k: 1},
    selectionRect: {x: 0, y: 0, h: 0, w: 0},
    graph: null as Graph | null,
  }),
  actions: {
    async open(graphId: string) {
      const graphManager = useGraphManagerStore();
      const graphOrchestrator = useGraphOrchestratorStore();
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
    },
    setView(e: {x: number, y: number, k: number}) {
      this.view = e;
    },
    createNewNode(e: {x: number, y: number}) {
      const graphOrchestrator = useGraphOrchestratorStore();
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
              z: 0 + graphOrchestrator.preferences!.newNodeOffset.z,
              presentation: {
                  x: pos.x,
                  y: pos.y,
                  z: 0 + graphOrchestrator.preferences!.newNodeOffset.z,
              },
          },
          template: {
              set: graphOrchestrator.preferences!.newNodeHelp ? helpTemplate.set : state.preferences.defaultNewSetTemplate,
              vue: graphOrchestrator.preferences!.newNodeHelp ? helpTemplate.template : state.preferences.defaultNewVueTemplate,
          },
      };
      state.graphSnapshot.nodes.push(node);
    }
  },
});
