import type {App} from "vue";
import type {Router} from "vue-router";
import InputInfo from "./InputInfo.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('input-info', InputInfo);
  }
};
