import type {App} from "vue";
import type {Router} from "vue-router";
import _GraphProperties from "./GraphProperties.vue";
import GraphEditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-graph-editor-module";
import {useStore as useGraphOrchestratorStore} from "@plastic-io/graph-editor-vue3-graph-orchestrator";
export default class GraphProperties extends GraphEditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('graph-properties', _GraphProperties);
    const graphOrchestratorStore =  useGraphOrchestratorStore();
    const plugin = new Plugin({
      name: 'Graph Properties Panel',
      component: 'graph-properties',
      icon: 'mdi-graph-outline',
      helpTopic: 'graphProperties',
      type: 'nav-panel-top-tabs',
    });
    graphOrchestratorStore.addPlugin(plugin);
  }
};
