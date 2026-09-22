import type {App} from "vue";
import type {Router} from "vue-router";
import _InsideBar from "./InsideBar.vue";
import EditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
export default class InsideBar extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('inside-bar', _InsideBar);
    useOrchestratorStore().addPlugin(new Plugin({
      name: 'Inside',
      component: 'inside-bar',
      type: 'system-bar-top',
      order: 0,
    }));
  }
};
