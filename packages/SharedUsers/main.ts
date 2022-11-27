import type {App} from "vue";
import type {Router} from "vue-router";
import SharedUsers from "./SharedUsers.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('shared-users', SharedUsers);
  }
};
