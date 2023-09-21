import type {App} from "vue";
import type {Router} from "vue-router";
import _SettingsPanel from "./SettingsPanel.vue";
import SettingsPanelMenu from "./SettingsPanelMenu.vue";
import EditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
export default class UserPanel extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('settings-panel', _SettingsPanel);
    app.component('settings-panel-menu', SettingsPanelMenu);

    const settingsPanelPluginIcon = new Plugin({
      name: 'Settings',
      component: 'settings-panel-menu',
      helpTopic: 'settingsPanel',
      type: 'system-bar-bottom',
      order: 0,
      divider: true,
    });

    const graphOrchestratorStore = useOrchestratorStore();

    graphOrchestratorStore.addPlugin(settingsPanelPluginIcon);
  }
};



