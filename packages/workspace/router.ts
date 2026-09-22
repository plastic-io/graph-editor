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
  /**
   * Inside a call (PB-115): the document you are in, and the chain of host
   * nodes you are standing inside — the same path an instance is named by
   * everywhere else, so a link to `…/inside/left/call` names exactly the call
   * an observation or a hop would name.
   */
  router.addRoute('Workspace', {
    path: "/:documentId/inside/:path+",
    name: "Inside",
    component: Workspace,
  });
}
