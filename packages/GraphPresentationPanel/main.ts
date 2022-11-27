import type {App} from "vue";
import type {Router} from "vue-router";
import GraphPresentationPanel from "./GraphPresentationPanel.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('graph-presentation-panel', GraphPresentationPanel);
  }
};
