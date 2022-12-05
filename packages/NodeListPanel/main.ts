import type {App} from "vue";
import type {Router} from "vue-router";
import _NodeListPanel from "./NodeListPanel.vue";
import GraphEditorModule from "@plastic-io/graph-editor-vue3-graph-editor-module";
export default class NodeListPanel extends GraphEditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('node-list-panel', _NodeListPanel);
  }
};
