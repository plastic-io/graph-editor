import type {App} from "vue";
import type {Router} from "vue-router";
import _WorkspaceControlPanel from "./WorkspaceControlPanel.vue";
import GraphEditorModule from "@plastic-io/graph-editor-vue3-graph-editor-module";
export default class WorkspaceControlPanel extends GraphEditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('workspace-control-panel', _WorkspaceControlPanel);
  }
};
