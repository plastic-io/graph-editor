import type {App} from "vue";
import type {Router} from "vue-router";
import _EventLoggerPanel from "./EventLoggerPanel.vue";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
export default class EventLoggerPanel extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('event-logger-panel', _EventLoggerPanel);
  }
};
