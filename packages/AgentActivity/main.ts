import type {App} from "vue";
import type {Router} from "vue-router";
import _AgentActivityMenu from "./AgentActivityMenu.vue";
import EditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
export default class AgentActivity extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('agent-activity-menu', _AgentActivityMenu);
    useOrchestratorStore().addPlugin(new Plugin({
      name: 'AgentActivity',
      title: 'Who has changed this graph',
      component: 'agent-activity-menu',
      helpTopic: 'agentActivity',
      type: 'system-bar-bottom',
      order: 3.9,
    }));
  }
};
