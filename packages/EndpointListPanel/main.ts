import type {App} from "vue";
import type {Router} from "vue-router";
import EndpointListPanel from "./EndpointListPanel.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('endpoint-list-panel', EndpointListPanel);
  }
};
