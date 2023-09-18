import type {App} from "vue";
import type {Router} from "vue-router";
import _NodeListPanel from "./NodeListPanel.vue";
import EditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
export default class NodeListPanel extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('node-list-panel', _NodeListPanel);
    const graphOrchestratorStore =  useOrchestratorStore();
    const plugin = new Plugin({
      name: 'Nodes',
      component: 'node-list-panel',
      icon: 'mdi-format-list-bulleted',
      helpTopic: 'nodeList',
      type: 'nav-panel-graph-tabs',
      order: 1,
    });
    graphOrchestratorStore.addPlugin(plugin);
  }
};
