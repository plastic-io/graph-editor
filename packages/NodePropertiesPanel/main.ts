import type {App} from "vue";
import type {Router} from "vue-router";
import NodePropertiesPanel from "./NodePropertiesPanel.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('node-properties-panel', NodePropertiesPanel);
  }
};
