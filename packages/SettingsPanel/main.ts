import type {App} from "vue";
import type {Router} from "vue-router";
import _SettingsPanel from "./SettingsPanel.vue";
import EditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
export default class UserPanel extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('settings-panel', _SettingsPanel);
    const graphOrchestratorStore = useOrchestratorStore();
    graphOrchestratorStore.addPlugin(new Plugin({
      name: 'Settings Gutter Icon',
      component: 'settings-panel',
      icon: 'mdi-cog',
      helpTopic: 'userPanel',
      type: 'nav-panel-bottom-gutter-icons',
      props: {
        tabSet: 'nav-panel-settings-tabs',
      },
      order: 0,
    }));
    graphOrchestratorStore.addPlugin(new Plugin({
      name: 'Settings',
      component: 'settings-panel',
      icon: 'mdi-cog',
      helpTopic: 'userPanel',
      type: 'nav-panel-settings-tabs',
      order: 0,
    }));
  }
};



