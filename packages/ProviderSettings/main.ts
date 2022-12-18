import type {App} from "vue";
import type {Router} from "vue-router";
import _ProviderSettings from "./ProviderSettings.vue";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
export default class ProviderSettings extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('provider-settings', _ProviderSettings);
  }
};
