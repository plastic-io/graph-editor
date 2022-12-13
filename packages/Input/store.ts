import { defineStore } from 'pinia';
import {useStore as useGraphManagerStore} from "@plastic-io/graph-editor-vue3-graph-manager";
import {useStore as useGraphOrchestratorStore} from "@plastic-io/graph-editor-vue3-graph-orchestrator";
import {useStore as useGraphCanvasStore} from "@plastic-io/graph-editor-vue3-graph-canvas";
export const useStore = defineStore('input', {
  state: () => ({
    name: 'input',
    keys: {} as Record<string, string>,
    orchistratorStore: useGraphOrchestratorStore(),
    graphManagerStore: useGraphManagerStore(),
    graphCanvasStore: useGraphCanvasStore(),
    mouse: {
      lmb: false,
      rmb: false,
      mmb: false,
      x: 0,
      y: 0,
      event: null as null | MouseEvent,
    },
    buttonMap: {
      "0": "lmb",
      "2": "rmb",
      "1": "mmb"
    },
  }),
  actions: {
    mousemove(e: MouseEvent) {
        console.log('mousemove');
        if (this.orchistratorStore.showHelp || this.orchistratorStore.inRewindMode) {
            return;
        }
        const mouse = this.getMousePosFromEvent(e);
        const item = this.graphCanvasStore.getItemAt(e.target);
        if (item.node) {
            this.graphCanvasStore.hoveredNode = item.node;
        } else {
            this.graphCanvasStore.hoveredNode = null;
        }
        if (!item.port) {
            this.graphCanvasStore.hoveredPort = null;
        }
        this.mouse.event = e;
        this.mouse.x = mouse.x;
        this.mouse.y = mouse.y;
    },
    dblclick(e: MouseEvent) {
        if (!/graph-canvas-container/.test(e.target.className)) {
            return;
        }
        this.graphCanvasStore.createNewNode({
            x: e.clientX,
            y: e.clientY,
        });
    },
    mousedown(e: MouseEvent) {
        let isMap = false;
        if (!this.graphCanvasStore.graph || this.orchistratorStore.showHelp || this.orchistratorStore.inRewindMode) {
            return;
        }
        // do not track control panel inputs
        if (!this.graphCanvasStore.isGraphTarget(e)) {
            return;
        }
        if (/graph-map-view-port|graph-map/.test(e.target.className)) {
            isMap = true;
        }
        const translating = {
            isMap,
            mouse: {
                x: this.mouse.x,
                y: this.mouse.y,
                event: e,
            },
            view: {
                y: this.graphCanvasStore.view.y,
                x: this.graphCanvasStore.view.x,
            },
            nodes: this.graphCanvasStore.graph.nodes.map((v) => {
                return {
                    id: v.id,
                    properties: {
                        x: v.properties.x,
                        y: v.properties.y,
                        presentation: {
                            x: v.properties.presentation.x,
                            y: v.properties.presentation.y,
                        },
                        newX: 0,
                        newY: 0,
                    },
                };
            }),
        };
        this.graphCanvasStore.translating = translating;
        this.mouse = {
            ...this.mouse,
            event: e,
            [this.buttonMap[e.button]]: true,
        };
    },
    mouseup(e) {
        this.mouse = {
            ...this.mouse,
            event: e,
            [this.buttonMap[e.button]]: false,
        };
    },
    getMousePosFromEvent(e: MouseEvent) {
        if (!this.graphCanvasStore.el) {
            return {
                x: 0,
                y: 0
            };
        }
        const rect = this.graphCanvasStore.el.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    },
    setMouse(e: any) {
      this.mouse = e;
    },
  },
});
