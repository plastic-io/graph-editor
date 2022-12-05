import type {App} from "vue";
import type {Router} from "vue-router";
import WssDocumentProviderInfo from "./WssDocumentProviderInfo.vue";
import GraphEditorModule from "@plastic-io/graph-editor-vue3-graph-editor-module";
export default class WssDocumentProvider extends GraphEditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('wss-document-provider-info', WssDocumentProviderInfo);
  }
};
