import type {App} from "vue";
import type {Router} from "vue-router";
import type Pinia from "pinia";
export default abstract class GraphEditorModule {
  name: string;
  constructor(config?: Record<string, any>, app?: App, router?: Router, pinia?: Pinia.Store) {
    this.name = '';
  }
}
