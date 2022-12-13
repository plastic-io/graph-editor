import type {App} from "vue";
import type {Router} from "vue-router";
import type Pinia from "pinia";
export default abstract class GraphEditorModule {
  name: string;
  constructor(config?: Record<string, any>, app?: App, router?: Router, pinia?: Pinia.Store) {
    this.name = '';
  }
}
export class Plugin {
  name: string;
  component: string;
  icon: string;
  helpTopic: string;
  type: string;
  order: number;
  constructor(args: {name?: string, component?: string, icon?: string, helpTopic?: string, type?: string, order?: number}) {
    this.name = args.name || args.component || '';
    this.component = args.component || args.component || '';
    this.icon = args.icon || '';
    this.helpTopic = args.helpTopic || '';
    this.type = args.type || '';
    this.order = 0;
    if (this.type == '') {
      throw new Error('Plugin must define type property: ' + args);
    }
    if (this.component == '') {
      throw new Error('Plugin must define component property: ' + args);
    }
  }
}
