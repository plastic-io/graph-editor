import type {Router} from "vue-router";
import empty from "./views/workspace.vue";
export default (router: Router) => {
  router.addRoute('/', {
    path: "/",
    name: "workspace",
    component: empty,
  });
}
