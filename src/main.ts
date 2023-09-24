// core files
import { createApp, getCurrentInstance } from "vue";
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
import Orchestrator from "@plastic-io/graph-editor-vue3-orchestrator";
import MonacoCodeEditor from '@plastic-io/graph-editor-vue3-monaco-code-editor';
import Appearance from '@plastic-io/graph-editor-vue3-appearance';
import Auth0AuthenticationProvider from "@plastic-io/graph-editor-vue3-auth0-authentication-provider";
import ConnectorInfo from "@plastic-io/graph-editor-vue3-connector-info";
import EndpointListPanel from "@plastic-io/graph-editor-vue3-endpoint-list-panel";
import ErrorInterstitial from "@plastic-io/graph-editor-vue3-error-interstitial";
import EventLoggerPanel from "@plastic-io/graph-editor-vue3-event-logger-panel";
import Graph from "@plastic-io/graph-editor-vue3-graph";
import Manager from "@plastic-io/graph-editor-vue3-graph-manager";
import Presentation from "@plastic-io/graph-editor-vue3-presentation";
import PresentationPanel from "@plastic-io/graph-editor-vue3-presentation-panel";
import GraphPropertiesPanel from "@plastic-io/graph-editor-vue3-graph-properties-panel";
import Rewind from "@plastic-io/graph-editor-vue3-rewind";
import ShortcutIcons from "@plastic-io/graph-editor-vue3-shortcut-icons";
import HelpOverlay from "@plastic-io/graph-editor-vue3-help-overlay";
import HistoryPanel from "@plastic-io/graph-editor-vue3-history-panel";
import ImportPanel from "@plastic-io/graph-editor-vue3-import-panel";
import Input from "@plastic-io/graph-editor-vue3-input";
import LocalStorageDocumentProvider from "@plastic-io/graph-editor-vue3-local-storage-document-provider";
import LocalUserPreferences from "@plastic-io/graph-editor-vue3-local-user-preferences";
import MiniMapInfo from "@plastic-io/graph-editor-vue3-mini-map-info";
import Node from "@plastic-io/graph-editor-vue3-node";
import NodeEdgeConnector from "@plastic-io/graph-editor-vue3-node-edge-connector";
import NodeEdgePropertiesPanel from "@plastic-io/graph-editor-vue3-node-edge-properties-panel";
import NodeListPanel from "@plastic-io/graph-editor-vue3-node-list-panel";
import NodePropertiesPanel from "@plastic-io/graph-editor-vue3-node-properties-panel";
import ProviderSettings from "@plastic-io/graph-editor-vue3-provider-settings";
import SharedMouse from "@plastic-io/graph-editor-vue3-shared-mouse";
import SharedUsers from "@plastic-io/graph-editor-vue3-shared-users";
import SettingsPanel from "@plastic-io/graph-editor-vue3-settings-panel";
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
  Orchestrator,
  // local user prefs needs to load before any modules that use
  // data stored in it (e.g.: Auth0)
  LocalUserPreferences,
  Appearance,
  ConnectorInfo,
  EndpointListPanel,
  ErrorInterstitial,
  EventLoggerPanel,
  Graph,
  MonacoCodeEditor,
  Manager,
  Presentation,
  PresentationPanel,
  GraphPropertiesPanel,
  Rewind,
  ShortcutIcons,
  HelpOverlay,
  HistoryPanel,
  ImportPanel,
  Input,
  LocalStorageDocumentProvider,
  MiniMapInfo,
  Node,
  NodeEdgeConnector,
  NodeEdgePropertiesPanel,
  NodeListPanel,
  NodePropertiesPanel,
  ProviderSettings,
  SharedMouse,
  SharedUsers,
  SettingsPanel,
  WorkspaceControlPanel,
  WssDocumentProvider,
  Workspace,
  Auth0AuthenticationProvider,
] as any;
(async () => {
  const pluginInstances = {} as any;
  console.groupCollapsed('%cPlastic-IO: %cGraph Editor Plugins',
    "color: blue",
    "color: lightblue");
  for (const _Plugin of plugins) {
     const plugin = new _Plugin({}, app, router, pinia);
     if (plugin instanceof Promise) {
       await plugin;
     }
     console.log(plugin);
  }
  console.groupEnd();
  (self as any).plastic = {
    app,
    router,
    pinia,
    plugins: pluginInstances,
  }

  app.use(router);

  app.mount("#app");
})();
