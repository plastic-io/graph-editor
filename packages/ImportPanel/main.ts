import type {App} from "vue";
import type {Router} from "vue-router";
import ImportPanel from "./ImportPanel.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('import-panel', ImportPanel);
  }
};
