import type {App} from "vue";
import type {Router} from "vue-router";
import _ConnectorInfo from "./ConnectorInfo.vue";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
export default class ConnectorInfo extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('connector-info', _ConnectorInfo);
  }
};
