import type {App} from "vue";
import type {Router} from "vue-router";
import _TemplateEditor from "./TemplateEditor.vue";
import GraphEditorModule from "@plastic-io/graph-editor-vue3-graph-editor-module";
export default class TemplateEditor extends GraphEditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('template-editor', _TemplateEditor);
  }
};
