import type {App} from "vue";
import type {Router} from "vue-router";
import UserPanel from "./UserPanel.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('user-panel', UserPanel);
  }
};
