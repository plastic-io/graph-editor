import type {App} from "vue";
import type {Router} from "vue-router";
import _NodeEdgePropertiesPanel from "./NodeEdgePropertiesPanel.vue";
import EditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
export default class NodeEdgePropertiesPanel extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('node-edge-properties-panel', _NodeEdgePropertiesPanel);
    const graphOrchestratorStore =  useOrchestratorStore();
    const plugin = new Plugin({
      name: 'Edges',
      component: 'node-edge-properties-panel',
      icon: 'mdi-video-input-component',
      helpTopic: 'edge',
      type: 'nav-panel-node-tabs',
      order: 1,
    });
    graphOrchestratorStore.addPlugin(plugin);
  }
};

