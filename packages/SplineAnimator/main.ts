import type {App} from "vue";
import type {Router} from "vue-router";
import _SplineAnimator from "./SplineAnimator.vue";
import EditorModule from "@plastic-io/graph-editor-vue3-editor-module";
export default class SplineAnimator extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('spline-animator', _SplineAnimator);
  }
};
