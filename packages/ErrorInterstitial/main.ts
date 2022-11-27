import type {App} from "vue";
import type {Router} from "vue-router";
import ErrorInterstitial from "./ErrorInterstitial.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('error-interstitial', ErrorInterstitial);
  }
};
