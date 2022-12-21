import type {App} from "vue";
import type {Router} from "vue-router";
import GraphCanvas from "./GraphCanvas.vue";
export {useStore} from "./store";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
export default class Graph extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('graph-canvas', GraphCanvas);
  }
};

export class GraphNode extends Node {
  
}


