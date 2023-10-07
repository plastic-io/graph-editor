import type {App} from "vue";
import type {Router} from "vue-router";
import _ProviderSettings from "./ProviderSettings.vue";
import EditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";

import type { Store } from 'pinia';
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";

export default class ProviderSettings extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('provider-settings', _ProviderSettings);

    const graphOrchestratorStore = useOrchestratorStore();

    const settings = new Plugin({
      name: 'Providersettings',
      title: 'Provider Settings',
      component: 'provider-settings',
      divider: true,
      helpTopic: 'provider-settings',
      type: 'manager-top-bar-title',
      order: 1,
    });

    graphOrchestratorStore.addPlugin(settings);

  }
};
