import type {App} from "vue";
import type {Router} from "vue-router";
import _SharedMouse from "./SharedMouse.vue";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
export default class SharedMouse extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('shared-mouse', _SharedMouse);
  }
};
