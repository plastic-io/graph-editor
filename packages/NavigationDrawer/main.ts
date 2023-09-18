import type {App} from "vue";
import type {Router} from "vue-router";
import _NavigationDrawer from "./NavigationDrawer.vue";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
export default class NavigationDrawer extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('navigation-drawer', _NavigationDrawer);
  }
};
