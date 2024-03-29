import type {App} from "vue";
import type {Router} from "vue-router";
import _NodePropertiesPanel from "./NodePropertiesPanel.vue";
import EditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
export default class NodePropertiesPanel extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('node-properties-panel', _NodePropertiesPanel);
  }
};
