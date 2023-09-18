import type {App} from "vue";
import type {Router} from "vue-router";
import _WorkspaceControlPanel from "./WorkspaceControlPanel.vue";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
export default class WorkspaceControlPanel extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('workspace-control-panel', _WorkspaceControlPanel);
  }
};
