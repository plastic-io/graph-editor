import { defineStore } from 'pinia';
import type {Graph, Node} from "@plastic-io/plastic-io";
import Scheduler from "@plastic-io/plastic-io";
import getRandomName from "@plastic-io/graph-editor-names";
import {helpTopics} from "@plastic-io/graph-editor-vue3-help-overlay";
import type DocumentProvider from "@plastic-io/graph-editor-vue3-document-provider";
import type PreferencesProvider from "@plastic-io/graph-editor-vue3-preferences-provider";
import type {UserPreferences} from "@plastic-io/graph-editor-vue3-preferences-provider";
import GraphEditorModule from "@plastic-io/graph-editor-vue3-graph-editor-module";
import {useStore as useGraphCanvasStore} from "@plastic-io/graph-editor-vue3-graph-canvas";
export default class GraphManager extends GraphEditorModule {
  constructor(config: Record<string, any>) {
    super();
  }
};
export const useStore = defineStore('graph-orchestrator', {
  state: () => ({
    token: null,
    plugins: {
        graphProperties: [],
        nodeProperties: [],
    },
    authProvider: null,
    identity: {},
    notFound: null,
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
        preferences: null as PreferencesProvider | null,
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
    selectedGroups: [],
    boundingRect: {
        visible: false,
        x: 0,
        y: 0,
        height: 0,
        width: 0
    },
    selectionRect: {
        visible: false,
        x: 0,
        y: 0,
        height: 0,
        width: 0
    },
    groupBounds: {
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0,
    },
    addingConnector: null,
    movingConnector: null,
    primaryGroup: null,
    movingVectors: [],
    selectedConnectors: [],
    groupVectors: [],
    selectedVector: null,
    selectedVectors: [],
    errorConnectors: [],
    watchConnectors: [],
    activityConnectors: {},
    hoveredConnector: null,
    hoveredVector: null,
    hoveredPort: null,
    mouse: {
        lmb: false,
        rmb: false,
        mmb: false,
        x: 0,
        y: 0
    },
    luts: {},
    translating: {},
    keys: {},
    view: {
        x: 0,
        y: 0,
        k: 1
    },
    toc: null,
    events: [],
    preferences: null as null | UserPreferences,
    originalPreferences: null as null | UserPreferences,
    selectedNodes: [] as Node[],
  }),
  actions: {
    createScheduler() {
        const graphCanvasStore = useGraphCanvasStore();
        this.scheduler.instance = new Scheduler(graphCanvasStore.graph!, this, this.scheduler.state, console);
    },
    clearInfo() {},
    undo() {},
    redo() {},
    duplicateSelection() {},
    groupSelected() {},
    ungroupSelected() {},
    bringForward() {},
    bringToFront() {},
    sendBackward() {},
    sendToBack() {},
    deleteSelected() {},
    setHoveredNode() {},
    setHoveredPort() {},
  },
});
