import type {App} from "vue";
import type {Router} from "vue-router";
import _HistoryPanel from "./HistoryPanel.vue";
import HistoryPanelMenu from "./HistoryPanelMenu.vue";
import EditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
export default class HistoryPanel extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('history-panel', _HistoryPanel);
    app.component('history-panel-menu', HistoryPanelMenu);
    const graphOrchestratorStore =  useOrchestratorStore();

    const historyPanelPluginIcon = new Plugin({
      name: 'History',
      component: 'history-panel-menu',
      helpTopic: 'historyPanel',
      type: 'system-bar-bottom',
      order: 0,
      divider: true,
    });

    graphOrchestratorStore.addPlugin(historyPanelPluginIcon);

  }
};
