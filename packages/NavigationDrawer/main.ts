import type {App} from "vue";
import type {Router} from "vue-router";
import NavigationDrawer from "./NavigationDrawer.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('navigation-drawer', NavigationDrawer);
  }
};
