import type {App} from "vue";
import type {Router} from "vue-router";
import _NodeEdgePropertiesPanel from "./NodeEdgePropertiesPanel.vue";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
export default class NodeEdgePropertiesPanel extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('node-edge-properties-panel', _NodeEdgePropertiesPanel);
  }
};

