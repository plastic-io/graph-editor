import { defineStore } from 'pinia';
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as useInputStore} from "@plastic-io/graph-editor-vue3-input";
import {useStore as useGraphStore, useGraphSnapshotStore} from "@plastic-io/graph-editor-vue3-graph";
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
    inputStore: useInputStore(),
    graphSnapshotStore: useGraphSnapshotStore(),
    touches: [] as any[],
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
    ontouchstart(e: TouchEvent) {
        console.log('ontouchstart', e);

    },
    ontouchend(e: TouchEvent) {
        console.log('ontouchend', e);
    },
    ontouchcancel(e: TouchEvent) {
        console.log('ontouchcancel', e);
    },
    ontouchmove(e: TouchEvent) {
        this.graphStore.view.x = this.touches[0].clientX - e.touches[0].clientX;
        this.graphStore.view.y = this.touches[0].clientY - e.touches[0].clientY;
    },
    onwheel(e: WheelEvent) {
        if (this.graphStore.presentation) {
            return;
        }
        if (!this.graphStore.isGraphTarget(e)) {
            return;
        }
        if (Math.floor(e.deltaY) === e.deltaY) {
            this.graphStore.view.y -= e.deltaY;
            this.graphStore.view.x -= e.deltaX;
        } else {
            this.graphStore.scale(e);
        }
        e.preventDefault();
    },
    mousemove(e: MouseEvent) {
        if (this.graphStore.presentation) {
            return;
        }
        if (this.orchistratorStore.showHelp || this.graphStore.inRewindMode) {
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
        if (!this.graphStore.graph || this.orchistratorStore.showHelp || this.graphStore.inRewindMode) {
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
