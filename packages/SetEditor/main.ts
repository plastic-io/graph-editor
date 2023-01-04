import type {App} from "vue";
import type {Router} from "vue-router";
import EditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
export default class SetEditor extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    const graphOrchestratorStore =  useOrchestratorStore();
    const plugin = new Plugin({
      name: 'Set',
      component: 'monaco-code-editor',
      icon: 'mdi-lambda',
      helpTopic: 'edge',
      type: 'nav-panel-tabs',
      props: {
        templateType: 'set',
        language: 'javascript',
      },
      order: 3,
    });
    graphOrchestratorStore.addPlugin(plugin);
  }
};
