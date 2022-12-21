import type {App} from "vue";
import type {Router} from "vue-router";
import _GraphProperties from "./GraphProperties.vue";
import EditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
export default class GraphProperties extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('graph-properties', _GraphProperties);
    const graphOrchestratorStore =  useOrchestratorStore();
    const plugin = new Plugin({
      name: 'Graph Properties Panel',
      component: 'graph-properties',
      icon: 'mdi-graph-outline',
      helpTopic: 'graphProperties',
      type: 'nav-panel-top-graph-tabs',
    });
    graphOrchestratorStore.addPlugin(plugin);
  }
};
