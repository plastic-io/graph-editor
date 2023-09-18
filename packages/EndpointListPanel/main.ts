import type {App} from "vue";
import type {Router} from "vue-router";
import _EndpointListPanel from "./EndpointListPanel.vue";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
export default class EndpointListPanel extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('endpoint-list-panel', _EndpointListPanel);
  }
};
