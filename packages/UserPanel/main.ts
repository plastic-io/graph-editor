import type {App} from "vue";
import type {Router} from "vue-router";
import _UserPanel from "./UserPanel.vue";
import GraphEditorModule from "@plastic-io/graph-editor-vue3-graph-editor-module";
export default class UserPanel extends GraphEditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('user-panel', _UserPanel);
  }
};
