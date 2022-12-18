import type {App} from "vue";
import type {Router} from "vue-router";
import _HistoryPanel from "./HistoryPanel.vue";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
export default class HistoryPanel extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('history-panel', _HistoryPanel);
  }
};
