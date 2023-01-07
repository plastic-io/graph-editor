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

    const historyPanelPluginIcon = new Plugin({
      name: 'History',
      component: 'v-icon',
      helpTopic: 'historyPanel',
      type: 'system-bar-top',
      order: 0,
      divider: true,
      props: {
        icon: 'mdi-history',
        onclick() {
          graphOrchestratorStore.selectedPanel = 'History';
        },
      }
    });

    const historyPanelPluginTab = new Plugin({
      name: 'History',
      component: 'history-panel',
      icon: 'mdi-history',
      helpTopic: 'historyPanel',
      type: 'nav-panel-bottom-gutter-icons',
      props: {
        tabSet: 'nav-panel-history-tabs',
      },
      order: 0,
    });

    const historyPanelPlugn = new Plugin({
      name: 'History',
      component: 'history-panel',
      icon: 'mdi-history',
      helpTopic: 'historyPanel',
      type: 'nav-panel-history-tabs',
      order: 0,
    });

    graphOrchestratorStore.addPlugin(historyPanelPluginIcon);
    graphOrchestratorStore.addPlugin(historyPanelPlugn);
    graphOrchestratorStore.addPlugin(historyPanelPluginTab);

  }
};
