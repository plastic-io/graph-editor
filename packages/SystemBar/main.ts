import type {App} from "vue";
import type {Router} from "vue-router";
import _SystemBar from "./SystemBar.vue";
import GraphEditorModule from "@plastic-io/graph-editor-vue3-graph-editor-module";
export default class SystemBar extends GraphEditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('system-bar', _SystemBar);
  }
};
