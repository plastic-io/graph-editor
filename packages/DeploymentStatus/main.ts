import type {App} from "vue";
import type {Router} from "vue-router";
import _DeploymentStatus from "./DeploymentStatus.vue";
import EditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
export default class DeploymentStatus extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('deployment-status', _DeploymentStatus);
    useOrchestratorStore().addPlugin(new Plugin({
      name: 'DeploymentStatus',
      title: 'What this graph deploys',
      component: 'deployment-status',
      helpTopic: 'deployment-status',
      type: 'system-bar-bottom',
      order: 3.9,
    }));
  }
};
