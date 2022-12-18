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
