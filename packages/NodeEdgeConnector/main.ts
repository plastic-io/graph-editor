import type {App} from "vue";
import type {Router} from "vue-router";
import _NodeEdgeConnector from "./NodeEdgeConnector.vue";
import GraphEditorModule from "@plastic-io/graph-editor-vue3-graph-editor-module";
export default class NodeEdgeConnector extends GraphEditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('node-edge-connector', _NodeEdgeConnector);
  }
};
