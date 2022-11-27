import type {App} from "vue";
import type {Router} from "vue-router";
import Node from "./Node.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('node', Node);
  }
};
