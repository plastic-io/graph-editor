import type {App} from "vue";
import type {Router} from "vue-router";
import _NodePropertiesPanel from "./NodePropertiesPanel.vue";
import GraphEditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-graph-editor-module";
import {useStore as useGraphOrchestratorStore} from "@plastic-io/graph-editor-vue3-graph-orchestrator";
export default class NodePropertiesPanel extends GraphEditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('node-properties-panel', _NodePropertiesPanel);
    const graphOrchestratorStore =  useGraphOrchestratorStore();
    const plugin = new Plugin({
      name: 'Node Properties Panel',
      component: 'node-properties-panel',
      icon: 'mdi-vector-point',
      helpTopic: 'nodeProperties',
      type: 'nav-panel-top-tabs',
      order: 0,
    });
    graphOrchestratorStore.addPlugin(plugin);
  }
};
