import type {App} from "vue";
import type {Router} from "vue-router";
export { useStore } from './store';
import _InputInfo from "./InputInfo.vue";
import GraphEditorModule from "@plastic-io/graph-editor-vue3-graph-editor-module";
export default class InputInfo extends GraphEditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('input-info', _InputInfo);
  }
};
