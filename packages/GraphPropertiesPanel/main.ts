import type {App} from "vue";
import type {Router} from "vue-router";
import _GraphProperties from "./GraphProperties.vue";
import GraphPropertiesMenu from "./GraphPropertiesMenu.vue";
import GraphCodeMenu from "./GraphCodeMenu.vue";
import EditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
export default class GraphProperties extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('graph-properties', _GraphProperties);
    app.component('graph-properties-menu', GraphPropertiesMenu);
    app.component('graph-code-menu', GraphCodeMenu);
    const graphOrchestratorStore =  useOrchestratorStore();
    
    graphOrchestratorStore.addPlugin({
      name: 'GraphPropertiesMenu',
      title: 'Graph Properties',
      component: 'graph-properties-menu',
      divider: true,
      helpTopic: 'graphProperties',
      type: 'system-bar-bottom',
      order: -1,
    });

    graphOrchestratorStore.addPlugin({
      name: 'GraphCodeMenu',
      title: 'Graph Code',
      component: 'graph-code-menu',
      divider: true,
      helpTopic: 'graphCode',
      type: 'system-bar-bottom',
      order: 0,
    });

  }
};
