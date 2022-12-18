import type {App} from "vue";
import type {Router} from "vue-router";
import _SetEditor from "./SetEditor.vue";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
export default class SetEditor extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('set-editor', _SetEditor);
  }
};
