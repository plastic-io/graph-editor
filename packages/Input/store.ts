import { defineStore } from 'pinia';
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {newId} from "@plastic-io/graph-editor-vue3-utils";
import {keys} from "./keys";
import MouseAction from "./mouse";
export const useStore = defineStore('input', {
  state: () => ({
    mouseAction: new MouseAction(),
    name: 'input',
    keys: {} as Record<string, boolean>,
    orchistratorStore: useOrchestratorStore(),
    graphStore: useGraphStore(),
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
    keyup(e: UIEvent) {
        this.keys[e.keyCode] = false;
        keys(this, e);
    },
    keydown(e: UIEvent) {
        this.keys[e.keyCode] = true;
        keys(this, e);
    },
    updateMouse(mouse: any) {
        this.mouseAction.mouse(mouse);
    },
    onwheel(e: MouseEvent) {
        if (!this.graphStore.isGraphTarget(e)) {
            return;
        }
        this.graphStore.scale(e);
    },
    mousemove(e: MouseEvent) {
        if (this.orchistratorStore.showHelp || this.orchistratorStore.inRewindMode) {
            return;
        }
        // do not track control panel inputs
        if (!this.graphStore.isGraphTarget(e)) {
            return;
        }
        const mouse = this.getMousePosFromEvent(e);
        const item = this.graphStore.getItemAt(e.target);
        if (item.node) {
            this.graphStore.hoveredNode = item.node;
        } else {
            this.graphStore.hoveredNode = null;
        }
        if (!item.port) {
            this.graphStore.hoveredPort = null;
        }
        this.updateMouse({
            ...this.mouse,
            x: mouse.x,
            y: mouse.y,
            event: e,
        });
    },
    dblclick(e: MouseEvent) {
        if (!/graph-canvas-container/.test(e.target.className)) {
            return;
        }
        this.graphStore.createNewNode({
            x: this.mouse.x,
            y: this.mouse.y,
        });
    },
    mousedown(e: MouseEvent) {
        let isMap = false;
        if (!this.graphStore.graph || this.orchistratorStore.showHelp || this.orchistratorStore.inRewindMode) {
            return;
        }
        // do not track control panel inputs
        if (!this.graphStore.isGraphTarget(e)) {
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
                y: this.graphStore.view.y,
                x: this.graphStore.view.x,
            },
            nodes: this.graphStore.graph.nodes.map((v) => {
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
        this.graphStore.translating = translating;
        this.updateMouse({
            ...this.mouse,
            event: e,
            [this.buttonMap[e.button]]: true,
        });
    },
    mouseup(e) {
        this.updateMouse({
            ...this.mouse,
            event: e,
            [this.buttonMap[e.button]]: false,
        });
    },
    getMousePosFromEvent(e: MouseEvent) {
        if (!this.graphStore.workspaceElement) {
            return {
                x: 0,
                y: 0
            };
        }
        const rect = this.graphStore.workspaceElement.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    },
  },
});
