import type {App} from "vue";
import type {Router} from "vue-router";
import _EventLoggerPanel from "./EventLoggerPanel.vue";
import GraphEditorModule from "@plastic-io/graph-editor-vue3-graph-editor-module";
export default class EventLoggerPanel extends GraphEditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('event-logger-panel', _EventLoggerPanel);
  }
};
