import type {App} from "vue";
import type {Router} from "vue-router";
import _ErrorInterstitial from "./ErrorInterstitial.vue";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
export default class ErrorInterstitial extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('error-interstitial', _ErrorInterstitial);
  }
};
