import type {App} from "vue";
import type {Router} from "vue-router";
import ConnectorInfo from "./ConnectorInfo.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('connetor-info', ConnectorInfo);
  }
};
