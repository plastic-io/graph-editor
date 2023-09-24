import type {App} from "vue";
import type {Router} from "vue-router";
import _GraphManager from "./GraphManager.vue";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
export default class GraphManager extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    hostRouter.addRoute('GraphManager', {
      path: "/graphs",
      name: "GraphManager",
      component: _GraphManager,
    });
  }
};
