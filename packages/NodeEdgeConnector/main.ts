import type {App} from "vue";
import type {Router} from "vue-router";
import NodeEdgeConnector from "./NodeEdgeConnector.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('node-edge-connector', NodeEdgeConnector);
  }
};
