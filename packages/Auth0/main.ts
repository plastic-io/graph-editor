import type {App} from "vue";
import type {Router} from "vue-router";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
export default class Auth0 extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
  }
};
