import { defineStore } from 'pinia';
import type {Graph, Node} from "@plastic-io/plastic-io";
import {fromJSON} from 'flatted';
import RegistrySettingsPanel from "./RegistrySettings.vue";
import {createDeepProxy, type Path} from "./proxy";
import getRandomName from "@plastic-io/graph-editor-names";
import {helpTopics} from "@plastic-io/graph-editor-vue3-help-overlay";
import type AuthenticationProvider from "@plastic-io/graph-editor-vue3-authentication-provider";
import type DocumentProvider from "@plastic-io/graph-editor-vue3-document-provider";
import GraphEditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useGraphStore, useGraphSnapshotStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
import SchedulerWorker from "./schedulerWorker?worker";
import {useTheme} from 'vuetify';
import {deref, newId} from "@plastic-io/graph-editor-vue3-utils";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import * as mdi from "@mdi/js";
import moment from "moment";
const hyphenateProperty = (prop: any) => {
    var p = "";
    Array.prototype.forEach.call(prop, function (char) {
        if (char === char.toUpperCase()) {
            p += "-" + char.toLowerCase();
            return;
        }
        p += char;
    });
    return p;
};
export default class GraphManager extends GraphEditorModule {
  constructor(config: Record<string, any>, app: App<Element>, hostRouter: any) {
    super();
    app.component('registry-settings-panel', RegistrySettingsPanel);
    const graphOrchestratorStore = useOrchestratorStore();
    const preferencesStore = usePreferencesStore();
    graphOrchestratorStore.addPlugin(new Plugin({
      name: 'Remotes',
      title: 'Remotes',
      component: 'registry-settings-panel',
      type: 'settings-panel',
      order: 10,
    }));
    hostRouter.beforeEach(async (to: any, from: any, next: any) => {
      await graphOrchestratorStore.init(to.params.documentId);
      next();
    });
  }
};
export const useStore = defineStore('orchestrator', {
  state: () => ({
    moment,
    webWorkerProxy: {
      state: {},
      nodes: {},
    },
    graphComponents: {} as any,
    graphStore: useGraphStore(),
    preferencesStore: usePreferencesStore(),
    token: null,
    bgColor: '000',
    selectedPanel: '',
    selectedTabSet: '',
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
    notFound: false,
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
    scheduleWorker: null as any,
    helpTopics,
    log: [] as any,
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
    showError: false,
    connectorWarn: null,
    errors: {} as any,
    scheduler: {
        state: {},
        errors: [] as any,
        warnings: [] as any,
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
    icons: Object.keys(mdi).map(hyphenateProperty),
  }),
  actions: {
    hyphenateProperty,
    async init(graphUrl: string) {
      // application startup

      // 1 authenticate

      // now load the selected graph
      this.graphStore.open(graphUrl);

    },
    panic() {
      this.scheduleWorker.postMessage({
        method: 'panic',
        args: [],
      });
    },
    async getToc() {
      this.toc = await this.dataProviders.toc!.get("toc.json");
    },
    async publishGraph() {
        const graph = this.graphStore.graph;
        await this.dataProviders.publish!.set(graph.id, {
            graph,
            id: newId(),
        });
        this.getToc();
    },
    async getPublicRegistry(e: any) {
        const relPath = /^\.\//;
        let url = e.url;
        if (e.parent.url && relPath.test(e.url)) {
            url = e.url.replace(relPath, e.parent.url + "/");
        }
        const data = await fetch(url);
        const responseJson = await data.json();
        if (responseJson.items) {
            responseJson.url = url;
            this.$patch({
              registry: {
                [e.url]: {
                    parent: e.parent,
                    toc: responseJson,
                    url: e.url,
                }
              }
            });
            responseJson.items.forEach((item: any) => {
                if (item.type === "toc") {
                    item.url = url;
                    this.getPublicRegistry({
                        url: item.artifact,
                        parent: item,
                    });
                }
                if (item.items) {
                    item.items.forEach((subItem: any) => {
                        if (subItem.type === "publishedNode" || subItem.type === "publishedGraph") {
                            if (url && relPath.test(subItem.artifact)) {
                                subItem.url = subItem.artifact.replace(relPath, url.substring(0, url.lastIndexOf("/")) + "/");
                            }
                        }
                    });
                }
            });
        }
    },
    setTheme(newTheme: string) {
        const isDark = newTheme === "dark";
        const theme = useTheme();
        theme.global.name.value = isDark ? 'dark' : 'light';
        this.bgColor = isDark ? "#000000" : "#FFFFFF";
    },
    clearArtifact(key: string) {

    },
    clearError(key: string, item: Error) {
      const arr = (this.errors[key] || []);
      const i = arr.indexOf(item);
      if (i !== -1) {
        arr.splice(i, 1);
      }
    },
    clearErrors(key: string, type?: string) {
      if (!type) {
        this.errors[key] = [];
        return;
      }
      this.errors[key] = this.errors[key].filter((error: any) => {
        return error.type !== type;
      });
    },
    getPluginsByType(type: string) {
      return this.plugins.filter(p => p.type === type).sort((a, b) => {
          return a.order - b.order;
      });
    },
    addPlugin(plugin: Plugin) {
        this.plugins.push(plugin);
    },
    graphUrl(url: string) {},
    raiseError(nodeId: string, error: {message: string},
      type: string, field?: string, graphId?: string) {
      (this.errors[nodeId] ??= [])
        .push({ id: newId(), error, type, field, graphId });
    },
    error(e: any) {
      this.scheduler.errors.push(e);
    },
    warning(e: any) {},
    async load(e: any): Promise<any> {
      const artifactPrefix = "artifacts/";
      if ("setValue" in e) {
          const pathParts = e.url.split("/");
          const itemId = pathParts[2].split(".")[0];
          const itemVersion = pathParts[2].split(".")[1];
          const itemType = pathParts[1];
          if (itemType === "graph" && itemId === this.graphStore.graph.id) {
              return e.setValue(this.graphStore.graph);
          }
          const item = await this.dataProviders.publish!.get(artifactPrefix + itemId + "." + itemVersion);
          e.setValue(item);
      }
    },
    createScheduler() {

        this.scheduleWorker = new SchedulerWorker();

        const sendUpdateToWorker = (path: Path, value: any): void => {
          this.scheduleWorker.postMessage({ path, value });
        };
        const mainObjProxy = createDeepProxy(this.webWorkerProxy, [], sendUpdateToWorker);

        // performance hack.  Avoid using the store on messages from
        // scheduler to avoid any sort of long term memory leaks/GCing
        const beginconnector = (e: any) => {
          if (!this.preferencesStore.preferences!.showConnectorActivity) {
            return;
          }
          const arr = this.graphStore.activityConnectors[e.connector.id] || []
          this.graphStore.$patch({
            activityConnectors: {
              [e.connector.id]: [
              ...arr,
              {
                activityType: "start",
                key: e.connector.id,
                event: e,
              }],
            },
          });
          if (this.preferencesStore.preferences!.debug) {
            this.$patch({
              loading: {
                connector: {
                  [e.connector.id]: {
                    loading: true,
                    time: Date.now(),
                    event: e,
                  },
                }
              },
            });
            this.log.push({
              eventName: 'connector',
              event: e,
            });
          }
        };
        const endconnector = (e: any) => {
          if (!this.preferencesStore.preferences!.showConnectorActivity) {
            return;
          }
          const arr = this.graphStore.activityConnectors[e.connector.id] || [];
          this.graphStore.$patch({
            activityConnectors: {
              [e.connector.id]: [
                ...arr,
                {
                  activityType: "end",
                  key: e.connector.id,
                  end: Date.now(),
                  event: e,
                }
              ]
            },
          });
          if (this.preferencesStore.preferences!.debug) {
            this.$patch({
              loading: {
                connector: {
                  [e.connector.id]: {
                    loading: false,
                    time: Date.now(),
                    event: e,
                  },
                }
              },
            });
            this.log.push({
              eventName: 'connector',
              event: e,
            });
          }
        };
        const sendMessage = (method: string) => {
          return (...args: any) => {
            this.scheduleWorker.postMessage({
              method,
              args,
            });
          };
        }
        this.scheduleWorker.postMessage({
          method: 'init',
          args: [
            {
              graph: deref(this.graphStore.graph),
            },
          ],
        });
        (this.scheduleWorker.onmessage as any) = (e: any) => {
          const methodName = e.data.source;
          const args = fromJSON(e.data.event);
          if (methodName === 'state-update') {
            const { path, value } = args;
            let obj: any = this.webWorkerProxy;
            for (let i = 0; i < path.length - 1; i++) {
              obj = obj[path[i]];
            }
            obj[path[path.length - 1]] = value;
            return;
          }
          if (methodName === 'beginconnector') {
            return beginconnector(args);
          }
          if (methodName === 'endconnector') {
            return endconnector(args);
          }
          if (methodName === 'error') {
            this.raiseError(args.nodeId, {
              message: args.message,
            }, 'set', args.field, args.graphId);
            return;
          }
          const method = (this as any)[methodName];
          if (method) {
            method(args);
            return;
          }
        };
        (this.scheduler.instance as any) = {
          url: sendMessage('url'),
        };
        useGraphSnapshotStore().$subscribe((mutation: any, state: any) => {
          if (!state.graph) {
            return;
          }
          this.scheduleWorker.postMessage({
            method: 'change',
            args: [deref(state.graph)],
          });
        });
    },
    clearInfo() {},
    setHoveredNode() {},
    setHoveredPort() {},
  },
});
