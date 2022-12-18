import type {App} from "vue";
import type {Router} from "vue-router";
import _AppBar from "./AppBar.vue";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
export default class AppBar extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('app-bar', _AppBar);
  }
};
