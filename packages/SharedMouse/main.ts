import type {App} from "vue";
import type {Router} from "vue-router";
import SharedMouse from "./SharedMouse.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('shared-mouse', SharedMouse);
  }
};
