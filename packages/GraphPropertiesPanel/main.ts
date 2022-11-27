import type {App} from "vue";
import type {Router} from "vue-router";
import GraphProperties from "./GraphProperties.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('graph-properties', GraphProperties);
  }
};
