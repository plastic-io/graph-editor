import { defineStore } from 'pinia';
import type {Graph, Node} from "@plastic-io/plastic-io";
import Scheduler from "@plastic-io/plastic-io";
import getRandomName from "@plastic-io/graph-editor-names";
import {helpTopics} from "@plastic-io/graph-editor-vue3-help-overlay";
import type AuthenticationProvider from "@plastic-io/graph-editor-vue3-authentication-provider";
import type DocumentProvider from "@plastic-io/graph-editor-vue3-document-provider";
import GraphEditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useTheme} from 'vuetify';
export default class GraphManager extends GraphEditorModule {
  constructor(config: Record<string, any>) {
    super();
  }
};
export const useStore = defineStore('orchestrator', {
  state: () => ({
    token: null,
    bgColor: '000',
    selectedPanel: '',
    mapScale: 1,
    plugins: [] as Plugin[],
    authProvider: null as null | AuthenticationProvider,
    identity: {
        user: {
          avatar: '',
          email: '',
        },
        provider: '',
    },
    notFound: null,
    navWidth: 450,
    buttonMap: {
        "0": "lmb",
        "2": "rmb",
        "1": "mmb"
    },
    fortunes: [],
    inRewindMode: false,
    rewindVisible: false,
    testOutputVersion: 0,
    testOutput: [],
    ownEvents: [],
    testsVisible: false,
    mouseMovements: [],
    mouseTransmitInterval: 1000,
    heartBeatInterval: 50000,
    queuedEvent: null,
    resyncRequired: false,
    eventQueue: [],
    pendingEvents: {},
    graphUserMouse: {},
    graphUserChat: {},
    graphUsers: {},
    showConnectorView: false,
    connectionState: "closed",
    createdGraphId: null,
    helpTopics,
    log: [],
    pathPrefix: "/graph-editor-vue-2/",
    ioTypes: [
        "Object",
        "String",
        "Boolean",
        "Number",
        "null",
        "undefined",
    ],
    tags: [
        "any",
        "browser",
        "lambda",
        "cli",
    ],
    graphReferences: {},
    registry: {},
    artifacts: {},
    publicGraphRegistries: [
        "https://unpkg.com/@plastic-io/registry@1.0.0",
        "https://unpkg.com/@plastic-io/registry@1.0.1",
        "https://unpkg.com/@plastic-io/registry@1.0.2",
        "https://unpkg.com/@plastic-io/registry@1.0.3",
    ],
    nodeMimeType: "application/json+plastic-io",
    jsonMimeType: "application/json",
    remoteEvents: [],
    remoteSnapshot: {},
    setMapScale: 1,
    showInfo: false,
    infoMessage: "",
    showHelp: false,
    panelVisibility: true,
    graphSnapshot: null,
    loading: {},
    dataProviders: {
        artifact: null as DocumentProvider | null,
        toc: null as DocumentProvider | null,
        publish: null as DocumentProvider | null,
        notification: null,
        graph: null as DocumentProvider | null,
    },
    error: null,
    showError: false,
    connectorWarn: null,
    scheduler: {
        state: {},
        errors: {},
        instance: null as Scheduler | null,
    },
    presentation: false,
    locked: false,
    historyPosition: 0,
    nodeZCounter: 0,
    errorConnectors: [],
    watchConnectors: [],
    luts: {},
    keys: {},
    toc: null,
  }),
  actions: {
    setTheme(newTheme: string) {
        const isDark = newTheme === "dark";
        const theme = useTheme();
        theme.global.name.value = isDark ? 'dark' : 'light';
        this.bgColor = isDark ? "#000000" : "#FFFFFF";
    },
    togglePresentation() {},
    redo() {},
    undo() {},
    togglePanelVisibility() {},
    clearArtifact() {},
    clearSchedulerErrorItem() {},
    clearSchedulerError() {},
    getPluginsByType(type: string) {
      return this.plugins.filter(p => p.type === type).sort((a, b) => {
          return a.order - b.order;
      });
    },
    addPlugin(plugin: Plugin) {
        this.plugins.push(plugin);
    },
    graphUrl(url: string) {
        
    },
    createScheduler() {
        const graphStore = useGraphStore();
        this.scheduler.instance = new Scheduler(graphStore.graph!, this, this.scheduler.state, console);
    },
    clearInfo() {},
    setHoveredNode() {},
    setHoveredPort() {},
  },
});
