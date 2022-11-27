import type {App} from "vue";
import type {Router} from "vue-router";
import NodeListPanel from "./NodeListPanel.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('node-list-panel', NodeListPanel);
  }
};
