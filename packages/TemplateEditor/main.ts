import type {App} from "vue";
import type {Router} from "vue-router";
import SystemBar from "./SystemBar.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('system-bar', SystemBar);
  }
};
