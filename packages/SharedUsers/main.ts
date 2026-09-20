import type {App} from "vue";
import type {Router} from "vue-router";
import _SharedUsers from "./SharedUsers.vue";
import EditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
export default class SharedUsers extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('shared-users', _SharedUsers);
    useOrchestratorStore().addPlugin(new Plugin({
      name: 'SharedUsers',
      title: 'People editing this graph',
      component: 'shared-users',
      helpTopic: 'sharedUsers',
      type: 'system-bar-top',
      order: 1.5,
      divider: true,
    }));
  }
};
