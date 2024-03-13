import type {App} from "vue";
import type {Router} from "vue-router";
import _GraphRewind from "./GraphRewind.vue";
import _GraphRewindIcon from "./GraphRewindIcon.vue";
import EditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
export default class GraphRewind extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('graph-rewind', _GraphRewind);
    app.component('graph-rewind-icon', _GraphRewindIcon);
    const graphOrchestratorStore = useOrchestratorStore();

    const rewindPluginIcon = new Plugin({
      name: 'Rewind',
      component: 'graph-rewind-icon',
      helpTopic: 'rewind',
      type: 'system-bar-bottom',
      order: 3.5,
      divider: true,
    });
    // this really isn't working well
    // graphOrchestratorStore.addPlugin(rewindPluginIcon);
  }
};
