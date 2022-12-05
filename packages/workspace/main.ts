import type {App} from "vue";
import type {Router} from "vue-router";
import router from "./router";
import WorkspaceComponent from "./components/Workspace.vue";
import type {Graph, Node} from "@plastic-io/plastic-io";
import GraphEditorModule from "@plastic-io/graph-editor-vue3-graph-editor-module";
export default class Workspace extends GraphEditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    router(hostRouter);
    app.component('workspace', WorkspaceComponent);
  }
};
