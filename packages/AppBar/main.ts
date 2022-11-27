import type {App} from "vue";
import type {Router} from "vue-router";
import AppBar from "./AppBar.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('app-bar', AppBar);
  }
};
