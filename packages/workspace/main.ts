import type {App} from "vue";
import type {Router} from "vue-router";
import router from "./router";
export { useStore } from './store';
export default {
  install(app: App<Element>, hostRouter: Router) {
    router(hostRouter);
  }
};
