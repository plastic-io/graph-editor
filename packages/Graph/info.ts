import {useStore as useManagerStore} from "@plastic-io/graph-editor-vue3-manager";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import type {Graph, Node} from "@plastic-io/plastic-io";
export default {
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
    getNodeById(nodeId: string): any {
      return this.graphSnapshot.nodes.find((n: Node) => n.id === nodeId);
    },
    async open(graphId: string) {
      const graphManager = useManagerStore();
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
} as ThisType<any>;
