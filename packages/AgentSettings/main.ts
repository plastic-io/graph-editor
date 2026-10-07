import type {App} from "vue";
import type {Router} from "vue-router";
import _AgentSettings from "./AgentSettings.vue";
import McpConnection from "./McpConnection.vue";
import EditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
export default class AgentSettings extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('agent-settings', _AgentSettings);
    app.component('mcp-connection', McpConnection);
    for (const type of ['manager-top-bar-right', 'system-bar-top']) {
      useOrchestratorStore().addPlugin(new Plugin({
        name: 'McpConnection', title: 'Connect MCP', component: 'mcp-connection',
        type, order: 1.5, props: {compact: type === 'system-bar-top'},
      }));
    }
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
