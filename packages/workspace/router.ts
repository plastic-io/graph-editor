import type {Router} from "vue-router";
import Workspace from "./views/Workspace.vue";
import {loadScripts} from "@plastic-io/graph-editor-vue3-utils";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";

export default (router: Router) => {
  router.beforeEach(async (to, from, next) => {
    const scripts = (usePreferencesStore() as any).preferences.componentScripts.replace('\n', ',').split(',');
    await loadScripts(scripts);
    next();
  });
  router.addRoute('Workspace', {
    path: "/:documentId",
    name: "Workspace",
    component: Workspace,
  });
}
