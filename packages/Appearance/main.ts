import type {App} from "vue";
import type {Router} from "vue-router";
import EditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import CanvasAppearance from "./CanvasAppearance.vue";
import ConnectorAppearancePanel from "./ConnectorAppearance.vue";
import GeneralAppearance from "./GeneralAppearance.vue";
import GraphAppearance from "./GraphAppearance.vue";
export default class AppearancePanels extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: Router) {
    super();
    app.component('canvas-appearance', CanvasAppearance);
    app.component('connector-appearance', ConnectorAppearancePanel);
    app.component('general-appearance', GeneralAppearance);
    app.component('graph-appearance', GraphAppearance);
    const graphOrchestratorStore =  useOrchestratorStore();
    graphOrchestratorStore.addPlugin(new Plugin({
      name: 'General Appearance',
      title: 'General Appearance',
      component: 'general-appearance',
      type: 'settings-panel',
      order: 0,
    }));
    graphOrchestratorStore.addPlugin(new Plugin({
      name: 'Canvas Appearance',
      title: 'Canvas Appearance',
      component: 'canvas-appearance',
      type: 'settings-panel',
      order: 0,
    }));
    graphOrchestratorStore.addPlugin(new Plugin({
      name: 'Connector Appearance',
      title: 'Connector Appearance',
      component: 'connector-appearance',
      type: 'settings-panel',
      order: 0,
    }));
    graphOrchestratorStore.addPlugin(new Plugin({
      name: 'Graph Appearance',
      title: 'Graph Appearance',
      component: 'graph-appearance',
      type: 'settings-panel',
      order: 0,
    }));
  }
};

export class ConnectorAppearance {
  dragDeadZone: number;
  controlFillStyle: string;
  strokeStyle: string;
  selectedStrokeStyle: string;
  hoverStrokeStyle: string;
  watchStrokeStyle: string;
  activityStrokeStyle: string;
  errorStrokeStyle: string;
  lineWidth: number;
  constructor() {
    this.dragDeadZone = 10;
    this.controlFillStyle = "blue";
    this.strokeStyle = "pink";
    this.selectedStrokeStyle = "amber";
    this.hoverStrokeStyle = "deepPurple";
    this.watchStrokeStyle = "orange";
    this.activityStrokeStyle = "indigo";
    this.errorStrokeStyle = "red";
    this.lineWidth = 1;
  }
}
export class Appearance {
  theme: string;
  helpColor: string;
  showGrid: boolean;
  selectionRectColor: string;
  boundingRectColor: string;
  connectors: ConnectorAppearance;
  constructor() {
    this.theme = "dark";
    this.helpColor = "blue";
    this.showGrid = true;
    this.selectionRectColor = "lightBlue";
    this.boundingRectColor = "shades";
    this.connectors = new ConnectorAppearance();
  }
}
