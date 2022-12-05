import type {App} from "vue";
import type {Router} from "vue-router";
import _HistoryPanel from "./HistoryPanel.vue";
import GraphEditorModule from "@plastic-io/graph-editor-vue3-graph-editor-module";
export default class HistoryPanel extends GraphEditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('history-panel', _HistoryPanel);
  }
};
