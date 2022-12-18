import type {App} from "vue";
import type {Router} from "vue-router";
export { useStore } from './store';
import _InputInfo from "./InputInfo.vue";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
export default class InputInfo extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('input-info', _InputInfo);
  }
};
