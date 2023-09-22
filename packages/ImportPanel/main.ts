import type {App} from "vue";
import type {Router} from "vue-router";
import _ImportPanel from "./ImportPanel.vue";
import ImportPanelMenu from "./ImportPanelMenu.vue";
import EditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
export default class ImportPanel extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('import-panel', _ImportPanel);
    app.component('import-panel-menu', ImportPanelMenu);
    const graphOrchestratorStore = useOrchestratorStore();

    const importPanelPluginIcon = new Plugin({
      name: 'Import',
      component: 'import-panel-menu',
      helpTopic: 'importPanel',
      type: 'system-bar-bottom',
      order: 5,
      divider: true,
    });

    graphOrchestratorStore.addPlugin(importPanelPluginIcon);

  }
};
