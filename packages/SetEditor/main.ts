import type {App} from "vue";
import type {Router} from "vue-router";
import SetEditor from "./SetEditor.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('set-editor', SetEditor);
  }
};
