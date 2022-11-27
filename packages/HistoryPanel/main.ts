import type {App} from "vue";
import type {Router} from "vue-router";
import HistoryPanel from "./HistoryPanel.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('history-panel', HistoryPanel);
  }
};
