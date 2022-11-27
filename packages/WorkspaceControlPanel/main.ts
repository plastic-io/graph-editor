import type {App} from "vue";
import type {Router} from "vue-router";
import WorkspaceControlPanel from "./WorkspaceControlPanel.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('workspace-control-panel', WorkspaceControlPanel);
  }
};
