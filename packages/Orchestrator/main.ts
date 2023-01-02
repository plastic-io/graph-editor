import { defineStore } from 'pinia';
import type {Graph, Node} from "@plastic-io/plastic-io";
import {fromJSON} from 'flatted';
import getRandomName from "@plastic-io/graph-editor-names";
import {helpTopics} from "@plastic-io/graph-editor-vue3-help-overlay";
import type AuthenticationProvider from "@plastic-io/graph-editor-vue3-authentication-provider";
import type DocumentProvider from "@plastic-io/graph-editor-vue3-document-provider";
import GraphEditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
import SchedulerWorker from "./schedulerWorker?worker";
import {useTheme} from 'vuetify';
import {deref} from "@plastic-io/graph-editor-vue3-utils";
export default class GraphManager extends GraphEditorModule {
  constructor(config: Record<string, any>) {
    super();
  }
};
export const useStore = defineStore('orchestrator', {
  state: () => ({
    graphStore: useGraphStore(),
    preferencesStore: usePreferencesStore(),
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
  }),
  actions: {
    setTheme(newTheme: string) {
        const isDark = newTheme === "dark";
        const theme = useTheme();
        theme.global.name.value = isDark ? 'dark' : 'light';
        this.bgColor = isDark ? "#000000" : "#FFFFFF";
    },
    togglePresentation() {},
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
    graphUrl(url: string) {},
    beginconnector(e: any) {
      if (!this.preferencesStore.preferences!.showConnectorActivity) {
        return;
      }
      const existingConnectors = this.graphStore.activityConnectors[e.connector.id];
      const connectorEvent = {
        activityType: "start",
        key: e.connector.id,
        event: e,
      };
      if (existingConnectors) {
        existingConnectors.push(connectorEvent);
      } else {
        this.graphStore.$patch({
          activityConnectors: {
            [e.connector.id]: [connectorEvent],
          },
        });
      }
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
      }
      this.log.push({
        eventName: 'connector',
        event: e,
      });
    },
    endconnector(e: any) {
      if (!this.preferencesStore.preferences!.showConnectorActivity) {
        return;
      }
      const existingConnectors = this.graphStore.activityConnectors[e.connector.id];
      const connectorEvent = {
        activityType: "end",
        key: e.connector.id,
        end: Date.now(),
        event: e,
      };
      if (existingConnectors) {
        existingConnectors.push(connectorEvent);
      } else {
        this.graphStore.$patch({
          activityConnectors: {
            [e.connector.id]: [connectorEvent]
          },
        });
      }
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
      }
      this.log.push({
        eventName: 'connector',
        event: e,
      });
    },
    set(e: any) {},
    afterSet(e: any) {},
    error(e: any) {
      this.scheduler.errors.push(e);
    },
    warning(e: any) {},
    begin(e: any) {},
    end(e: any) {},
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
          const method = (this as any)[e.data.source];
          const args = fromJSON(e.data.event);
          if (!method) {
            return console.error('Method not found', method);
          }
          method(args);
        };
        (this.scheduler.instance as any) = {
          url: sendMessage('url'),
        };
    },
    clearInfo() {},
    setHoveredNode() {},
    setHoveredPort() {},
  },
});
