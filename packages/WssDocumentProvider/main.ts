import type {App} from "vue";
import type {Router} from "vue-router";
import WssDocumentProviderInfo from "./WssDocumentProviderInfo.vue";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
export default class WssDocumentProvider extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('wss-document-provider-info', WssDocumentProviderInfo);
  }
};
