import type {App} from "vue";
import type {Router} from "vue-router";
import Editor from '@plastic-io/graph-editor-vue3-code-editor';
import EditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";

export default class SetEditor extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('set-code-editor', Editor);
    const graphOrchestratorStore =  useOrchestratorStore();
    const plugin = new Plugin({
      name: 'Set',
      component: 'set-code-editor',
      icon: 'mdi-lambda',
      helpTopic: 'edge',
      type: 'nav-panel-node-tabs',
      props: {
        templateType: 'set',
        language: 'javascript',
      },
      order: 3,
    });
    graphOrchestratorStore.addPlugin(plugin);
  }
};
