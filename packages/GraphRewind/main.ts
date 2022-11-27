import type {App} from "vue";
import type {Router} from "vue-router";
import GraphRewind from "./GraphRewind.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('graph-rewind', GraphRewind);
  }
};
