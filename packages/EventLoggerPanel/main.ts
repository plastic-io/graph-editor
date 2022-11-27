import type {App} from "vue";
import type {Router} from "vue-router";
import EventLoggerPanel from "./EventLoggerPanel.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('event-logger-panel', EventLoggerPanel);
  }
};
