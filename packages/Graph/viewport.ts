import type {Graph, Node} from "@plastic-io/plastic-io";
export default {
    remapNodes() {
        return this.graph.nodes.filter((v: Vector) => {
            return this.selectedNodes.find((vi: any) => v.id === vi.id);
        });
    },
    updateBoundingRect() {
        // calculate bounding box
        // this probably doesn't have to run as frequently as it does, lots of calls to getElementById here, might be slow
        if (this.selectedNodes.length > 0) {
            /// map to updated graph, but filter for bound nodes
            const bound = this.remapNodes();
            const minX = Math.min.apply(null, bound
                .map((v: Node) => v.properties.x));
            const maxX = Math.max.apply(null, bound
                .map((v: Node) => {
                    const el = document.getElementById("node-" + v.id);
                    if (!el) {
                        return v.properties.x;
                    }
                    return v.properties.x + el.offsetWidth;
                }));
            const minY = Math.min.apply(null, bound
                .map((v: Node) => v.properties.y));
            const maxY = Math.max.apply(null, bound
                .map((v: Node) => {
                    const el = document.getElementById("node-" + v.id);
                    if (!el) {
                        return v.properties.y;
                    }
                    return v.properties.y + el.offsetHeight;
                }));
            this.groupBounds = {
                minX,
                maxX,
                minY,
                maxY,
            };
            // update bounding box
            this.boundingRect = {
                x: this.groupBounds.minX,
                y: this.groupBounds.minY,
                width: this.groupBounds.maxX - this.groupBounds.minX,
                height: this.groupBounds.maxY - this.groupBounds.minY,
                right: this.groupBounds.minX + this.groupBounds.maxX - this.groupBounds.minX,
                bottom: this.groupBounds.minY + this.groupBounds.maxY - this.groupBounds.minY,
            };
        } else {
            this.boundingRect = {x: 0, y: 0, height: 0, width: 0, bottom: 0, right: 0, visible: false};
        }
    },
    scale(e: WheelEvent) {
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
    setView(e: {x: number, y: number, k: number}) {
      this.view = e;
    },
    zoom(zoom: number) {
        this.view = {
          ...this.view,
          k: Math.max(zoom),
        };
    },
} as ThisType<any>;
