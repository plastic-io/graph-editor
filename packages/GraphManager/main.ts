import type {App} from "vue";
import type {Router} from "vue-router";
import GraphManager from "./GraphManager.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('graph-manager', GraphManager);
  }
};
