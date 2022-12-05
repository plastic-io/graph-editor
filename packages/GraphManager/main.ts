import type {App} from "vue";
import type {Router} from "vue-router";
import _GraphManager from "./GraphManager.vue";
import GraphEditorModule from "@plastic-io/graph-editor-vue3-graph-editor-module";
export {useStore} from "./store";
export default class GraphManager extends GraphEditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('graph-manager', _GraphManager);
  }
};
