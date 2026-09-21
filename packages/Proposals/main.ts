import type {App} from "vue";
import type {Router} from "vue-router";
import _ProposalsMenu from "./ProposalsMenu.vue";
import EditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
export default class Proposals extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('proposals-menu', _ProposalsMenu);
    useOrchestratorStore().addPlugin(new Plugin({
      name: 'Proposals',
      title: 'Proposals and agent activity',
      component: 'proposals-menu',
      helpTopic: 'proposals',
      type: 'system-bar-bottom',
      order: 3.7,
      divider: true,
    }));
  }
};
