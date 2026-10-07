import type {App} from 'vue';
import EditorModule, {Plugin} from '@plastic-io/graph-editor-vue3-editor-module';
import {useStore as useOrchestratorStore} from '@plastic-io/graph-editor-vue3-orchestrator';
import ChatPanel from './ChatPanel.vue';
export default class Chat extends EditorModule {
  constructor(_config: Record<string, any>, app: App<Element>) {
    super();
    app.component('graph-chat', ChatPanel);
    for (const type of ['manager-top-bar-right', 'system-bar-top']) useOrchestratorStore().addPlugin(new Plugin({
      name: 'Chat', title: 'Chat', component: 'graph-chat', type, order: 1.4, props: {inGraph: type === 'system-bar-top'},
    }));
  }
}
