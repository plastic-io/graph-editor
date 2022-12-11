import type {App} from "vue";
import type {Router} from "vue-router";
import _HelpOverlay from "./HelpOverlay.vue";
export * as helpTopics from "./helpTopics";
export {template, set} from "./helpTopics";
import GraphEditorModule from "@plastic-io/graph-editor-vue3-graph-editor-module";
export default class HelpOverlay extends GraphEditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('help-overlay', _HelpOverlay);
  }
};
