import type {App} from "vue";
import type {Router} from "vue-router";
import _GraphPresentationPanel from "./GraphPresentationPanel.vue";
import GraphEditorModule from "@plastic-io/graph-editor-vue3-graph-editor-module";
export default class GraphPresentationPanel extends GraphEditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('graph-presentation-panel', _GraphPresentationPanel);
  }
};
