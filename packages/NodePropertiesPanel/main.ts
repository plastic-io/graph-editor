import type {App} from "vue";
import type {Router} from "vue-router";
import _NodePropertiesPanel from "./NodePropertiesPanel.vue";
import GraphEditorModule from "@plastic-io/graph-editor-vue3-graph-editor-module";
export default class NodePropertiesPanel extends GraphEditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('node-properties-panel', _NodePropertiesPanel);
  }
};
