import type {App} from "vue";
import type {Router} from "vue-router";
import type {Graph, Node} from "@plastic-io/plastic-io";
import GitHubRegistryPanel from "./GitHubRegistryPanel.vue";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import EditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";

export default class GitHubProvider extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('github-registry-panel', GitHubRegistryPanel);
    const graphOrchestratorStore =  useOrchestratorStore();

    const RegistryPanel = new Plugin({
      name: 'GitHub',
      component: 'github-registry-panel',
      helpTopic: 'githubPublishingPanel',
      type: 'library-registry-panel',
      icon: 'mdi-github',
      order: 4,
      divider: true,
    });
    // disabled github provider because of low API call count
    // graphOrchestratorStore.addPlugin(RegistryPanel);
  }
};

