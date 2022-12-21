import type {Graph, Node} from "@plastic-io/plastic-io";
import {useStore as useManagerStore} from "@plastic-io/graph-editor-vue3-manager";
import {useStore as useInputStore} from "@plastic-io/graph-editor-vue3-input";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
export default () => ({
    selectedGroups: [],
    primaryGroup: null,
    selectedConnectors: [],
    activityConnectors: {},
    hoveredConnector: null,
    systemBarOffset: 25,
    mapScale: 1,
    hoveredNode: null as Node | null,
    hoveredPort: null,
    addingConnector: null,
    movingConnector: null,
    locked: null,
    groupNodes: [],
    movingNodes: [],
    inputStore: useInputStore(),
    managerStore: useManagerStore(),
    orchestratorStore: useOrchestratorStore(),
    preferencesStore: usePreferencesStore(),
    keys: {} as Record<string, string>,
    artifacts: {} as Record<string, any>,
    buttonMap: {
      "0": "lmb",
      "2": "rmb",
      "1": "mmb"
    },
    workspaceElement: null as null | Element,
    selectedNodes: [] as Node[],
    selectedNode: null,
    view: {x: 0, y: 0, k: 1},
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
    presentation: false,
    graph: null as Graph | null,
    graphSnapshot: null as Graph | null,
    showHelp: false,
    inRewindMode: false,
    translating: {} as any,
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
});
