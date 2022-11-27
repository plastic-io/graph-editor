import type {App} from "vue";
import type {Router} from "vue-router";
import GraphCanvas from "./GraphCanvas.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('graph-canvas', GraphCanvas);
  }
};
