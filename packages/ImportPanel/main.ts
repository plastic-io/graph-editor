import type {App} from "vue";
import type {Router} from "vue-router";
import _ImportPanel from "./ImportPanel.vue";
import EditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
export default class ImportPanel extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('import-panel', _ImportPanel);
    const graphOrchestratorStore = useOrchestratorStore();
    graphOrchestratorStore.addPlugin(new Plugin({
      name: 'Import',
      component: 'import-panel',
      icon: 'mdi-bookshelf',
      helpTopic: 'importPanel',
      type: 'nav-panel-bottom-gutter-icons',
      props: {
        tabSet: 'nav-panel-import-tabs',
      },
      order: 1,
    }));

    graphOrchestratorStore.addPlugin(new Plugin({
      name: 'Import',
      component: 'import-panel',
      icon: 'mdi-bookshelf',
      helpTopic: 'importPanel',
      type: 'nav-panel-import-tabs',
      order: 1,
    }));

  }
};
