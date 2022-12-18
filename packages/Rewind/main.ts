import type {App} from "vue";
import type {Router} from "vue-router";
import _GraphRewind from "./GraphRewind.vue";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
export default class GraphRewind extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('graph-rewind', _GraphRewind);
  }
};
