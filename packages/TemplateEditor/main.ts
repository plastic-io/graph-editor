import type {App} from "vue";
import type {Router} from "vue-router";
import Editor from '@plastic-io/graph-editor-vue3-code-editor';
import EditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";

export default class TemplateEditor extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('vue-code-editor', Editor);
    const graphOrchestratorStore =  useOrchestratorStore();
    const plugin = new Plugin({
      name: 'View',
      component: 'vue-code-editor',
      icon: 'mdi-vuejs',
      helpTopic: 'template',
      type: 'nav-panel-node-tabs',
      props: {
        templateType: 'vue',
        language: 'html',
      },
      order: 2,
    });
    graphOrchestratorStore.addPlugin(plugin);
    
  }
};
