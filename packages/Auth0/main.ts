import type {App} from "vue";
import type {Router} from "vue-router";
import GraphEditorModule from "@plastic-io/graph-editor-vue3-graph-editor-module";
export default class Auth0 extends GraphEditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
  }
};
