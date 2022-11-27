import type {App} from "vue";
import type {Router} from "vue-router";
import GraphPresentation from "./GraphPresentation.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('graph-presentation', GraphPresentation);
  }
};
