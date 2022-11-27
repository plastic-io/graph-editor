import type {App} from "vue";
import type {Router} from "vue-router";
import TemplateEditor from "./TemplateEditor.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('template-editor', TemplateEditor);
  }
};
