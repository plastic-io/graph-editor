import type {App} from "vue";
import type {Router} from "vue-router";
import _EndpointListPanel from "./EndpointListPanel.vue";
import GraphEditorModule from "@plastic-io/graph-editor-vue3-graph-editor-module";
export default class EndpointListPanel extends GraphEditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('endpoint-list-panel', _EndpointListPanel);
  }
};
