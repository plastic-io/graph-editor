import type {App} from "vue";
import type {Router} from "vue-router";
import NodeEdgePropertiesPanel from "./NodeEdgePropertiesPanel.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('node-edge-properties-panel', NodeEdgePropertiesPanel);
  }
};

