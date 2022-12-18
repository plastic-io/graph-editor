// core files
import { createApp } from "vue";
import { createPinia, defineStore } from "pinia";
import App from "./App.vue";
import router from "./router";
import "./assets/main.css";

// Vuetify
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

// plugins
import type GraphEditorModule from "@plastic-io/graph-editor-vue3-editor-module";
import AppBar from "@plastic-io/graph-editor-vue3-app-bar"
import Auth0 from "@plastic-io/graph-editor-vue3-auth0";
import ConnectorInfo from "@plastic-io/graph-editor-vue3-connector-info";
import EndpointListPanel from "@plastic-io/graph-editor-vue3-endpoint-list-panel";
import ErrorInterstitial from "@plastic-io/graph-editor-vue3-error-interstitial";
import EventLoggerPanel from "@plastic-io/graph-editor-vue3-event-logger-panel";
import GraphCanvas from "@plastic-io/graph-editor-vue3-canvas";
import GraphManager from "@plastic-io/graph-editor-vue3-manager";
import GraphOrchestrator from "@plastic-io/graph-editor-vue3-orchestrator";
import GraphPresentation from "@plastic-io/graph-editor-vue3-presentation";
import GraphPresentationPanel from "@plastic-io/graph-editor-vue3-presentation-panel";
import GraphPropertiesPanel from "@plastic-io/graph-editor-vue3-properties";
import GraphRewind from "@plastic-io/graph-editor-vue3-rewind";
import GraphShortcutIcons from "@plastic-io/graph-editor-vue3-shortcut-icons";
import HelpOverlay from "@plastic-io/graph-editor-vue3-help-overlay";
import HistoryPanel from "@plastic-io/graph-editor-vue3-history-panel";
import ImportPanel from "@plastic-io/graph-editor-vue3-import-panel";
import Input from "@plastic-io/graph-editor-vue3-input";
import LocalStorageDocumentProvider from "@plastic-io/graph-editor-vue3-local-storage-document-provider";
import LocalUserPreferences from "@plastic-io/graph-editor-vue3-local-user-preferences";
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
const pinia = createPinia();

const vuetify = createVuetify({
  components,
  directives,
});

const app = createApp(App);
(window as any).plastic_app = app;
app.use(pinia);
app.use(vuetify);

// install plugins
const plugins = [
  // GraphOrchestrator needs to come before a lot of the other
  // modules because it provides a common store to share state
  GraphOrchestrator,
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
  GraphShortcutIcons,
  HelpOverlay,
  HistoryPanel,
  ImportPanel,
  Input,
  LocalStorageDocumentProvider,
  LocalUserPreferences,
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
  WorkspaceControlPanel,
  WssDocumentProvider,
  Workspace,
] as GraphEditorModule[];
const pluginInstances = {} as Record<string, GraphEditorModule>;
plugins.forEach((_Plugin: GraphEditorModule) => {
  const plugin = new _Plugin({}, app, router, pinia);
  pluginInstances[plugin.name] = plugin;
});


app.use(router);

app.mount("#app");
