import type {App} from "vue";
import type {Router} from "vue-router";
import Auth0 from "./Auth0.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('auth0', Auth0);
  }
};
