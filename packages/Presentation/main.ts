import type {App} from "vue";
import type {Router} from "vue-router";
import _GraphPresentation from "./GraphPresentation.vue";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
export default class GraphPresentation extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('graph-presentation', _GraphPresentation);
  }
};
