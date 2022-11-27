import type {App} from "vue";
import type {Router} from "vue-router";
import LocalStorageDocumentProviderInfo from "./LocalStorageDocumentProviderInfo.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('local-storage-document-provider-info', LocalStorageDocumentProviderInfo);
  }
};
