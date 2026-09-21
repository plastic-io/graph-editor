import type {App} from "vue";
import type {Router} from "vue-router";
import _VersionsMenu from "./VersionsMenu.vue";
import EditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
export default class Versions extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('versions-menu', _VersionsMenu);
    useOrchestratorStore().addPlugin(new Plugin({
      name: 'Versions',
      title: 'Named versions of this graph',
      component: 'versions-menu',
      helpTopic: 'versions',
      type: 'system-bar-bottom',
      order: 3.6,
      divider: true,
    }));
  }
};
