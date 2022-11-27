import type {App} from "vue";
import type {Router} from "vue-router";
import WssDocumentProviderInfo from "./WssDocumentProviderInfo.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('wss-document-provider-info', WssDocumentProviderInfo);
  }
};
