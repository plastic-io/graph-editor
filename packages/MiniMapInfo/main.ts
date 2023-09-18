import type {App} from "vue";
import type {Router} from "vue-router";
import _MiniMapInfo from "./MiniMapInfo.vue";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
export default class MiniMapInfo extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('mini-map-info', _MiniMapInfo);
  }
};
