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
        const r = /no-graph-target/;
        // HACK: cheap hack, just check one node up for no-target
        return !(r.test(e.target.className) || (e.target.parentNode && r.test(e.target.parentNode.className)));
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
      const graphOrchestrator = useOrchestratorStore();
      if (!graphOrchestrator.dataProviders.graph) {
        throw new Error('No data providers to open a graph with.');
        return;
      }
      let graph: Graph | null = null;
      try {
        this.graphSnapshot = await graphOrchestrator.dataProviders.graph.get(graphId);
        this.updateGraphFromSnapshot("Open");
      } catch (err: any) {
        const url = self.location.pathname.split('/')[1];
        this.graphSnapshot = this.createGraph(url, "");
        this.updateGraphFromSnapshot("Created");
      }
      this.graphLoaded = true;
      graphOrchestrator.createScheduler();
    },
} as ThisType<any>;
