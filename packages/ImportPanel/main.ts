import type {App} from "vue";
import type {Router} from "vue-router";
import _ImportPanel from "./ImportPanel.vue";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
export default class ImportPanel extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('import-panel', _ImportPanel);
  }
};
