import type {App} from "vue";
import type {Router} from "vue-router";
import _UserPanel from "./UserPanel.vue";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
export default class UserPanel extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('user-panel', _UserPanel);
  }
};
