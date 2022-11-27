import type {App} from "vue";
import type {Router} from "vue-router";
import HelpOverlay from "./HelpOverlay.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('help-overlay', HelpOverlay);
  }
};
