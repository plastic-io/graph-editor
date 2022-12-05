import type {App} from "vue";
import type {Router} from "vue-router";
import _SharedMouse from "./SharedMouse.vue";
import GraphEditorModule from "@plastic-io/graph-editor-vue3-graph-editor-module";
export default class SharedMouse extends GraphEditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('shared-mouse', _SharedMouse);
  }
};
