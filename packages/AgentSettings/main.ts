import type {App} from "vue";
import type {Router} from "vue-router";
import _AgentSettings from "./AgentSettings.vue";
import EditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
export default class AgentSettings extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('agent-settings', _AgentSettings);
    useOrchestratorStore().addPlugin(new Plugin({
      name: 'Agents',
      title: 'Agents',
      component: 'agent-settings',
      helpTopic: 'agentSettings',
      type: 'settings-panel',
      order: 9,
      divider: false,
    }));
  }
};
