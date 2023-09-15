import type {Graph, Node} from "@plastic-io/plastic-io";
export default {
    externalIO() {
        const info = {
            inputs: [],
            outputs: [],
        } as any;
        this.graphSnapshot.nodes.forEach((v) => {
            ["inputs", "outputs"].forEach((io) => {
                v.properties[io].forEach((i) => {
                    if (i.external) {
                        info[io].push({
                            node: v,
                            field: i,
                        });
                    }
                });
            });
        });
        return info;
    },
    selectNodes(ids: string[]) {
        const selectedNodes = [] as any;
        ids.forEach((id: string) => {
            selectedNodes.push(this.graphSnapshot.nodes.find((n: any) => {
                return n.id === id;
            }));
        });
        const selectedNode = selectedNodes[0];
        this.$patch({
            selectedNode,
            selectedNodes,
        });
    },
    raiseError(err: Error) {
        throw err;
    },
    getCalculatedGraphUrl(): string {
        return self.location.pathname.split('/')[1];
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
} as ThisType<any>;
