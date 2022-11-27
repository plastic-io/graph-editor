import type {App} from "vue";
import type {Router} from "vue-router";
import MiniMapInfo from "./MiniMapInfo.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('mini-map-info', MiniMapInfo);
  }
};
