import type {App} from "vue";
import type {Router} from "vue-router";
import ProviderSettings from "./ProviderSettings.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('provider-settings', ProviderSettings);
  }
};
