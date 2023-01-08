import type {App} from "vue";
import type {Router} from "vue-router";
import type Pinia from "pinia";
export default abstract class GraphEditorModule {
  name: string;
  constructor(config?: Record<string, any>, app?: App, router?: Router, pinia?: Pinia.Store) {
    this.name = typeof this;
  }
}
export class Plugin {
  name: string;
  component: string;
  icon: string;
  helpTopic: string;
  type: string;
  order: number;
  title: string;
  alt: string;
  divider: boolean;
  props: Record<string, any>;
  constructor(args: {
    name?: string,
    title?: string,
    alt?: string,
    component?: string,
    icon?: string,
    helpTopic?: string,
    type?: string,
    order?: number,
    divider?: boolean,
    props?: Record<string, any>,
  }) {
    this.name = args.name || args.component || '';
    this.component = args.component || args.component || '';
    this.icon = args.icon || '';
    this.helpTopic = args.helpTopic || '';
    this.type = args.type || '';
    this.title = args.title || '';
    this.alt = args.alt || '';
    this.order = args.order || 0;
    this.props = args.props || {};
    this.divider = args.divider || false;
    if (this.type == '') {
      throw new Error('Plugin must define type property: ' + args);
    }
    if (this.component == '') {
      throw new Error('Plugin must define component property: ' + args);
    }
  }
}
