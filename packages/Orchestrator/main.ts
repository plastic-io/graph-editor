import { defineStore } from 'pinia';
import type {Graph, Node} from "@plastic-io/plastic-io";
import {fromJSON} from 'flatted';
import RegistrySettingsPanel from "./RegistrySettings.vue";
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
  constructor(config: Record<string, any>, app: App<Element>) {
    super();
    app.component('registry-settings-panel', RegistrySettingsPanel);
    const graphOrchestratorStore = useOrchestratorStore();
    graphOrchestratorStore.addPlugin(new Plugin({
      name: 'Registry',
      title: 'Registry',
      component: 'registry-settings-panel',
      type: 'settings-panel',
      order: 10,
    }));
  }
};
export const useStore = defineStore('orchestrator', {
  state: () => ({
    moment,
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
    async getToc() {
      this.toc = await this.dataProviders.toc!.get("toc.json");
    },
    async publishGraph() {
      console.log('publishGraph');
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
    graphUrl(url: string) {},
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
        // performance hack.  Avoid using the store on messages from
        // scheduler to avoid any sort of long term memory leaks/GCing
        const beginconnector = (e: any) => {
          if (!this.preferencesStore.preferences!.showConnectorActivity) {
            return;
          }
          const connectorEvent = {
            activityType: "start",
            key: e.connector.id,
            event: e,
          };
          this.graphStore.$patch({
            activityConnectors: {
              [e.connector.id]: [connectorEvent],
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
          const connectorEvent = {
            activityType: "end",
            key: e.connector.id,
            end: Date.now(),
            event: e,
          };
          this.graphStore.$patch({
            activityConnectors: {
              [e.connector.id]: [connectorEvent]
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
            scheduleWorker.postMessage({
              method,
              args,
            });
          };
        }
        const scheduleWorker = new SchedulerWorker();
        scheduleWorker.postMessage({
          method: 'init',
          args: [
            {
              graph: deref(this.graphStore.graph),
            },
          ],
        });
        (scheduleWorker.onmessage as any) = (e: any) => {
          const methodName = (this as any)[e.data.source];
          const args = fromJSON(e.data.event);
          if (methodName === 'beginconnector') {
            return beginconnector(args);
          }
          if (methodName === 'endconnector') {
            return endconnector(args);
          }
          const method = (this as any)[methodName];
          if (!method) {
            return;
          }
          console.log('onmessage', e.data.source);
          method(args);
        };
        (this.scheduler.instance as any) = {
          url: sendMessage('url'),
        };
        useGraphSnapshotStore().$subscribe((mutation: any, state: any) => {
          if (!state.graph) {
            return;
          }
          scheduleWorker.postMessage({
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
