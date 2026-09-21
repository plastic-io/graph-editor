import type {App} from "vue";
import type {Router} from "vue-router";
import _ExecutionsMenu from "./ExecutionsMenu.vue";
import EditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
export default class Executions extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('executions-menu', _ExecutionsMenu);
    useOrchestratorStore().addPlugin(new Plugin({
      name: 'Executions',
      title: 'What this graph did',
      component: 'executions-menu',
      helpTopic: 'executions',
      type: 'system-bar-bottom',
      order: 3.8,
    }));
  }
};
