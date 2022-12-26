import type {App} from "vue";
import type {Router} from "vue-router";
import _HistoryPanel from "./HistoryPanel.vue";
import EditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
export default class HistoryPanel extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('history-panel', _HistoryPanel);
    const graphOrchestratorStore =  useOrchestratorStore();
    const historyPanelPlugin = new Plugin({
      name: 'History Panel',
      component: 'history-panel',
      icon: 'mdi-history',
      helpTopic: 'historyPanel',
      type: 'nav-panel-bottom-tabs',
      order: 0,
    });
    graphOrchestratorStore.addPlugin(historyPanelPlugin);
  }
};
