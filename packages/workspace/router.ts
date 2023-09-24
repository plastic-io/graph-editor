import type {Router} from "vue-router";
import Workspace from "./views/Workspace.vue";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";

export default (router: Router) => {
  router.beforeEach(async (to, from, next) => {
    console.log('Route', to, from);
    const scripts = (usePreferencesStore() as any).preferences.componentScripts.replace('\n', ',').split(',');
    const promises = scripts.map((src: string) => {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.async = false;
        script.src = src;
        script.onload = resolve;
        script.onerror = (err) => {
          console.error(`Error loading script (src: ${src}) from preferences: ${err}`);
        };
        document.head.appendChild(script);
      });
    });
    await Promise.all(promises);
    next();
  });
  router.addRoute('Workspace', {
    path: "/:documentId",
    name: "Workspace",
    component: Workspace,
  });
}
