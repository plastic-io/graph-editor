import type {App} from "vue";
import type {Router} from "vue-router";
import _NodeEdgeConnector from "./NodeEdgeConnector.vue";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
export default class NodeEdgeConnector extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('node-edge-connector', _NodeEdgeConnector);
  }
};
