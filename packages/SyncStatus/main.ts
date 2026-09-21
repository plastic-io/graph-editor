import type {App} from "vue";
import type {Router} from "vue-router";
import _SyncStatus from "./SyncStatus.vue";
import EditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
export { useStore } from "./store";
export { newUlid } from "./ulid";
export default class SyncStatus extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('sync-status', _SyncStatus);
    useOrchestratorStore().addPlugin(new Plugin({
      name: 'SyncStatus',
      title: 'What the graph server has accepted',
      component: 'sync-status',
      helpTopic: 'syncStatus',
      type: 'system-bar-top',
      order: 1.6,
      divider: false,
    }));
  }
};
