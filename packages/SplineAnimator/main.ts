import type {App} from "vue";
import type {Router} from "vue-router";
import SplineAnimator from "./SplineAnimator.vue";
export default {
  install(app: App<Element>, hostRouter: Router) {
    app.component('spline-animator', SplineAnimator);
  }
};
