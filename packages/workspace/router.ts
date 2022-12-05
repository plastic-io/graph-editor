import type {Router} from "vue-router";
import Workspace from "./views/Workspace.vue";
export default (router: Router) => {
  router.addRoute('Workspace', {
    path: "/:documentId",
    name: "Workspace",
    component: Workspace,
  });
}
