// core files
import { createApp } from "vue";
import { createPinia, defineStore } from "pinia";
import App from "./App.vue";
import router from "./router";
import "./assets/main.css";
// plugins
import AppBar from "@plastic-io/graph-editor-vue3-app-bar"
import Auth0 from "@plastic-io/graph-editor-vue3-auth0";
import ConnectorInfo from "@plastic-io/graph-editor-vue3-connector-info";
import EndpointListPanel from "@plastic-io/graph-editor-vue3-endpoint-list-panel";
import ErrorInterstitial from "@plastic-io/graph-editor-vue3-error-interstitial";
import EventLoggerPanel from "@plastic-io/graph-editor-vue3-event-logger-panel";
import GraphCanvas from "@plastic-io/graph-editor-vue3-graph-canvas";
import GraphManager from "@plastic-io/graph-editor-vue3-graph-manager";
import GraphPresentation from "@plastic-io/graph-editor-vue3-graph-presentation";
import GraphPresentationPanel from "@plastic-io/graph-editor-vue3-graph-presentation-panel";
import GraphPropertiesPanel from "@plastic-io/graph-editor-vue3-graph-properties";
import GraphRewind from "@plastic-io/graph-editor-vue3-graph-rewind";
import HelpOverlay from "@plastic-io/graph-editor-vue3-help-overlay";
import HistoryPanel from "@plastic-io/graph-editor-vue3-history-panel";
import ImportPanel from "@plastic-io/graph-editor-vue3-import-panel";
import Input from "@plastic-io/graph-editor-vue3-input";
import LocalStorageDocumentProvider from "@plastic-io/graph-editor-vue3-local-storage-document-provider";
import MiniMapInfo from "@plastic-io/graph-editor-vue3-mini-map-info";
import NavigationDrawer from "@plastic-io/graph-editor-vue3-navigation-drawer";
import Node from "@plastic-io/graph-editor-vue3-node";
import NodeEdgeConnector from "@plastic-io/graph-editor-vue3-node-edge-connector";
import NodeEdgePropertiesPanel from "@plastic-io/graph-editor-vue3-node-edge-properties-panel";
import NodeListPanel from "@plastic-io/graph-editor-vue3-node-list-panel";
import NodePropertiesPanel from "@plastic-io/graph-editor-vue3-node-properties-panel";
import ProviderSettings from "@plastic-io/graph-editor-vue3-provider-settings";
import SetEditor from "@plastic-io/graph-editor-vue3-set-editor";
import SharedMouse from "@plastic-io/graph-editor-vue3-shared-mouse";
import SharedUsers from "@plastic-io/graph-editor-vue3-shared-users";
import SplineAnimator from "@plastic-io/graph-editor-vue3-spline-animator";
import SystemBar from "@plastic-io/graph-editor-vue3-system-bar";
import TemplateEditor from "@plastic-io/graph-editor-vue3-template-editor";
import UserPanel from "@plastic-io/graph-editor-vue3-user-panel";
import Workspace from "@plastic-io/graph-editor-vue3-workspace";
import WorkspaceControlPanel from "@plastic-io/graph-editor-vue3-workspace-control-panel";
import WssDocumentProvider from "@plastic-io/graph-editor-vue3-wss-document-provider-info";

// must come before plugin install
const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

// install plugins
const plugins = [
  AppBar, 
  Auth0, 
  ConnectorInfo, 
  EndpointListPanel, 
  ErrorInterstitial, 
  EventLoggerPanel, 
  GraphCanvas, 
  GraphManager, 
  GraphPresentation, 
  GraphPresentationPanel, 
  GraphPropertiesPanel, 
  GraphRewind, 
  HelpOverlay, 
  HistoryPanel, 
  ImportPanel, 
  Input, 
  LocalStorageDocumentProvider, 
  MiniMapInfo, 
  NavigationDrawer, 
  Node, 
  NodeEdgeConnector, 
  NodeEdgePropertiesPanel, 
  NodeListPanel, 
  NodePropertiesPanel, 
  ProviderSettings, 
  SetEditor, 
  SharedMouse, 
  SharedUsers, 
  SplineAnimator, 
  SystemBar, 
  TemplateEditor, 
  UserPanel, 
  Workspace, 
  WorkspaceControlPanel, 
  WssDocumentProvider, 
];
plugins.forEach((plugin: Record<string, any>) => {
  plugin.install(app, router, pinia);
});

app.use(router);

app.mount("#app");
