// NOTE: This code file is in an experimental state

import { defineStore } from 'pinia';
import type {App} from "vue";
import type Scheduler from "@plastic-io/plastic-io";
import type {Graph, Node} from "@plastic-io/plastic-io";
import {fromJSON} from 'flatted';
import RegistrySettingsPanel from "./RegistrySettings.vue";
import getRandomName from "@plastic-io/graph-editor-names";
import {helpTopics} from "@plastic-io/graph-editor-vue3-help-overlay";
import type DocumentProvider from "@plastic-io/graph-editor-vue3-document-provider";
import GraphEditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useGraphStore, useGraphSnapshotStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
import SchedulerWorker from "./schedulerWorker?worker";
import {useTheme} from 'vuetify';
import {deref, newId} from "@plastic-io/graph-editor-vue3-utils";
import {newUlid} from "@plastic-io/graph-editor-vue3-sync-status/ulid";
import {deepEqual as crdtDeepEqual, shouldRunDelivery, deliveryKey, flattenLinkedGraphs} from "@plastic-io/graph-crdt";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import AuthenticationProvider, {useStore as useAuthenticationStore} from "@plastic-io/graph-editor-vue3-authentication-provider";
import * as mdi from "@mdi/js";
import moment from "moment";
/** Trailing debounce for pushing graph changes into the scheduler worker. */
const SCHEDULER_PUSH_DEBOUNCE = 250;

/**
 * The parts of a graph the scheduling engine actually runs on.
 *
 * Moving a node, renaming it or recolouring it changes the picture, not the
 * program, so rebuilding and re-shipping the whole graph to the worker for
 * those is pure waste.  Under the CRDT pipeline that waste would land on every
 * frame of a drag and every keystroke in the code editor, so the push is
 * debounced and then skipped entirely unless one of these fields moved.
 */
const schedulerRelevantShape = (graph: any) => {
    if (!graph) {
        return null;
    }
    const properties = {...(graph.properties || {})};
    delete properties.lastUpdate;
    delete properties.lastUpdatedBy;
    return {
        id: graph.id,
        url: graph.url,
        properties,
        nodes: (graph.nodes || []).map((node: any) => ({
            id: node.id,
            url: node.url,
            graphId: node.graphId,
            artifact: node.artifact,
            data: node.data,
            linkedGraph: node.linkedGraph,
            linkedNode: node.linkedNode,
            edges: node.edges,
            template: node.template,
            properties: {
                inputs: (node.properties || {}).inputs,
                outputs: (node.properties || {}).outputs,
                scripts: (node.properties || {}).scripts,
                // where the node runs, what it may do and how it is contained
                // all change the running program, so a change to any of them
                // has to reach the worker (plan §4.8.1)
                placement: (node.properties || {}).placement,
                capabilities: (node.properties || {}).capabilities,
                containment: (node.properties || {}).containment,
                deliveryTarget: (node.properties || {}).deliveryTarget,
            },
        })),
    };
};

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
    const authenticationStore = useAuthenticationStore();
    const graphOrchestratorStore = useOrchestratorStore();
    const preferencesStore = usePreferencesStore();
    graphOrchestratorStore.addPlugin(new Plugin({
      name: 'Registries',
      title: 'Registries',
      component: 'registry-settings-panel',
      type: 'settings-panel',
      order: 10,
    }));
    hostRouter.beforeEach(async (to: any, from: any, next: any) => {
      await authenticationStore.init();
      if (/auth-callback/.test(self.location.toString())) {
        next();
        return;
      }
      if (to.name === "Workspace" || to.name === "Inside") {
        if (!from || from.params.documentId !== to.params.documentId) {
          await graphOrchestratorStore.init(to.params.documentId);
        }
        // Standing inside a call is a place you can link to and reload into,
        // so the path in the address is what decides, not what was clicked.
        const graphStore = useGraphStore();
        const path = to.name === "Inside"
          ? (Array.isArray(to.params.path) ? to.params.path : [to.params.path]).filter(Boolean)
          : [];
        const standing = graphStore.insideInstance ? graphStore.insideInstance.path.join("/") : "";
        if (standing !== path.join("/")) {
          graphStore.leaveInstance();
          if (path.length) {
            await graphStore.lookInside(path);
          }
        }
      }
      next();
    });
  }
};
export const useStore = defineStore('orchestrator', {
  state: () => ({
    moment,
    webWorkerProxy: {
      state: {} as Record<string, any>,
      /** One entry per node, keyed by node id, holding its current inputs. */
      nodes: {} as Record<string, any>,
    },
    graphComponents: {} as any,
    /** Executions that ran in this browser, newest first (plan §4.5.3). */
    browserExecutions: [] as any[],
    /** This tab, for deliveries addressed to the session that started an execution. */
    sessionId: newUlid(),
    executionReportQueue: [] as any[],
    executionReportInFlight: false,
    executionReportWarned: false,
    executionReportsDropped: 0,
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
    inRewindMode: false,
    startTime:  0,
    redrawConnectorVersion: 0,
    testOutputVersion: 0,
    testsVisible: false,
    mouseTransmitInterval: 1000,
    graphUserMouse: {},
    /** Who else has this graph open, keyed by their session id. */
    graphUsers: {} as Record<string, any>,
    /**
     * Agents that have changed this graph in the last few minutes (plan
     * PB-112).  An agent is not a peer on the socket, so this is what can be
     * said honestly: it acted recently, not that it is here.
     */
    agentsAtWork: [] as any[],
    showConnectorView: false,
    scheduleWorker: null as any,
    helpTopics,
    log: [] as any,
    pathPrefix: "/graph-editor/",
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
    registry: {} as Record<string, any>,
    artifacts: {},
    setMapScale: 1,
    showInfo: false,
    infoMessage: "",
    showHelp: false,
    panelVisibility: true,
    graphSnapshot: null,
    loading: {},
    /** CRDT sync providers (local persistence, network) attached to the open
     * graph document.  Populated by provider modules at startup. */
    syncProviders: [] as any[],
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
    infos: {} as any,
    warnings: {} as any,
    debugs: {} as any,
    scheduler: {
        state: {},
        instance: null as Scheduler | null,
    },
    locked: false,
    nodeZCounter: 0,
    errorConnectors: [],
    watchConnectors: [],
    luts: {},
    keys: {},
    toc: {} as any,
    icons: Object.keys(mdi).map(hyphenateProperty),
  }),
  actions: {
    hyphenateProperty,
    getEvents(url: string) {
      return this.dataProviders!.artifact!.getEvents(url);
    },
    async init(graphUrl: string) {
      return await this.graphStore.open(graphUrl);
    },
    panic() {
      this.scheduleWorker.postMessage({
        method: 'panic',
        args: [],
      });
      (this.dataProviders.graph as any).send({
        action: 'panic',
        graphId: this.graphStore.graph.id,
      });
    },
    copyToClipboard(text: string) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    },
    /**
     * Destroy a graph and everything it is made of, everywhere.
     *
     * Deleting a graph from the interface hides it and keeps it, so this is
     * not wired to anything: it is a debugging tool, meant to be called by
     * hand.  Nothing it removes comes back.
     *
     *   plastic.pinia._s.get('orchestrator').destroyGraph('<graph id>')
     */
    async destroyGraph(graphId: string) {
      if (!graphId) {
        throw new Error('destroyGraph needs a graph id.');
      }
      console.warn(`Destroying ${graphId}.  This cannot be undone.`);
      await this.removeGraphDocument(graphId);
      if (this.dataProviders.graph) {
        await (this.dataProviders.graph as any).delete(graphId, true);
      }
      await this.getToc();
      return { id: graphId, destroyed: true };
    },
    /** Put a graph that was taken off the list back on it. */
    async restoreGraph(graphId: string) {
      const provider: any = this.dataProviders.graph;
      if (!provider || typeof provider.restore !== 'function') {
        throw new Error('This data provider cannot put a graph back.');
      }
      await provider.restore(graphId);
      await this.getToc();
      return { id: graphId, restored: true };
    },
    /** Drop a graph's collaborative document from every attached provider. */
    async removeGraphDocument(graphId: string) {
      for (const provider of this.syncProviders) {
        if (typeof provider.remove !== 'function') {
          continue;
        }
        try {
          await provider.remove(graphId);
        } catch (err) {
          console.error(`Sync provider "${provider.name}" could not delete the document.`, err);
        }
      }
    },
    async getToc() {
      try {
        this.toc = await this.dataProviders.toc!.get("toc.json");
      } catch (err) {
        this.toc = {};
      }
    },
    async publishGraph(label = "") {
        this.infoMessage = 'Publishing';
        this.showInfo = true;
        const graph = this.graphStore.graph;
        try {
            // Publishing names a revision (Versions menu); the version number is the revision's.
            const result = typeof this.graphStore.publishVersion === 'function'
                ? await this.graphStore.publishVersion({ label })
                : null;
            if (result && result.manifest) {
                this.infoMessage = (result.created ? 'Published ' : 'Already published ') + graph.properties.name + ' v' + result.manifest.version;
            } else {
                await this.dataProviders.publish!.set(graph.id, { graph, id: newId() });
                this.infoMessage = 'Published ' + graph.properties.name;
            }
        } catch (err: any) {
            this.infoMessage = 'Cannot publish: ' + (err && err.message);
        }
        setTimeout(() => {
          this.showInfo = false;
        }, 3400);
        this.getToc();
    },
    async publishNode(nodeId: string, label = "") {
        this.infoMessage = 'Publishing node';
        this.showInfo = true;
        try {
            const result = typeof this.graphStore.publishNodeVersion === 'function'
                ? await this.graphStore.publishNodeVersion(nodeId, label)
                : null;
            this.infoMessage = result && result.manifest
                ? (result.created ? 'Published ' : 'Already published ') + result.manifest.name + ' v' + result.manifest.version
                : 'Cannot publish the node without a graph server.';
        } catch (err: any) {
            this.infoMessage = 'Cannot publish: ' + (err && err.message);
        }
        setTimeout(() => {
          this.showInfo = false;
        }, 3400);
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
    info(args: any) {
      const {nodeId, message, type, field, graphId} = args;
      (this.infos[nodeId] ??= []).push({ id: newId(), message, type, field, graphId });
    },
    warning(args: any) {
      const {nodeId, message, type, field, graphId} = args;
      (this.warnings[nodeId] ??= []).push({ id: newId(), message, type, field, graphId });
    },
    debug(args: any) {
      const {nodeId, message, type, field, graphId} = args;
      (this.debugs[nodeId] ??= []).push({ id: newId(), message, type, field, graphId });
    },
    /**
     * One flat graph for the scheduler (plan §4.2, PB-046).  The rules live in
     * the shared package so the server flattens the same arrangement the same
     * way; what a linked graph cannot do — contain itself, or be nested past
     * the limit — is reported here where somebody is looking at it.
     */
    async flattenForScheduler(source: any): Promise<any> {
      const {graph, warnings, instances} = await flattenLinkedGraphs(source, {
        /**
         * The copy the import carries, and — when it carries none — the
         * published component itself.  The server has always been able to
         * resolve a link by fetching it, so a browser that could not flattened
         * a *different* arrangement from the one the server ran: the same
         * import was nodes there and a call here.
         */
        resolve: async (node: any) => {
          const linked = node && node.linkedGraph;
          if (!linked) {
            return null;
          }
          if (linked.graph) {
            return linked.graph;
          }
          if (!linked.id) {
            return null;
          }
          const version = linked.version === undefined ? node.version : linked.version;
          let found: any = null;
          await this.load({
            url: `artifacts/graph/${linked.id}.${version}`,
            setValue: (value: any) => { found = value; },
          }).catch(() => undefined);
          return found;
        },
        // What flattening cannot resolve — a graph that contains itself — stays
        // a link, and the scheduler makes a call of it when a value arrives:
        // one instance per turn, each with its own state (plastic-io 2.3).
        leaveForRuntime: true,
      });
      warnings.forEach((warning: any) => {
        console.warn("linked_graph:", warning.message, warning);
        if (warning.code !== "LINKED_GRAPH_CYCLE") {
          this.raiseError(warning.nodeId, {message: warning.message}, "linked-graph", undefined, source.id);
        }
      });
      if (instances.length) {
        console.log("linked_graph: flattened", instances);
      }
      return graph;
    },
    /**
     * A graph or node the scheduler asks for by path, at the moment a value
     * reaches the node that links it (plastic-io 2.3).  The open graph answers
     * for itself — that is a graph that contains itself.  Anything else is a
     * published component, which comes from the server's artifact route; only
     * where there is no server (local-only) does the document provider answer,
     * which is the one that keeps artifacts under that key.
     */
    async load(e: any): Promise<any> {
      const artifactPrefix = "artifacts/";
      if (!("setValue" in e)) {
        return;
      }
      const pathParts = String(e.url || "").split("/");
      const itemId = (pathParts[2] || "").split(".")[0];
      const itemVersion = (pathParts[2] || "").split(".")[1];
      const itemType = pathParts[1];
      if (itemType === "graph" && this.graphStore.graph && itemId === this.graphStore.graph.id) {
        return e.setValue(this.graphStore.graph);
      }
      const path = artifactPrefix + itemId + "/" + itemVersion;
      const server: any = this.syncProviders.find((p: any) => typeof p.call === "function");
      if (server) {
        // GET /artifacts/{id}/{version}, with this session's token on it
        const item = await server.call(path);
        return e.setValue(item);
      }
      const item = await this.dataProviders.publish!.get(path);
      e.setValue(item);
    },
    /**
     * Keep a finished browser execution and hand it to the server (plan
     * §4.5.3, PB-054).  Reports are queued and sent one at a time: a graph
     * being poked in the editor can finish dozens of executions a second, and
     * none of them is worth a request of its own.  When more arrive than the
     * queue holds, the oldest are dropped and the loss is recorded where the
     * gap is visible rather than hidden.
     */
    recordBrowserExecution(report: any) {
      if (!report || !report.record) {
        return;
      }
      this.browserExecutions.unshift(report.record);
      this.browserExecutions.splice(200);
      if (!report.observations || !report.observations.length) {
        return;
      }
      const provider: any = this.syncProviders.find((p: any) => typeof p.reportExecution === "function");
      if (!provider || !this.graphStore.crdtSession) {
        return;
      }
      if (this.executionReportQueue.length >= 50) {
        this.executionReportQueue.shift();
        this.executionReportsDropped += 1;
      }
      this.executionReportQueue.push(report);
      this.drainExecutionReports(provider);
    },
    async drainExecutionReports(provider: any) {
      if (this.executionReportInFlight) {
        return;
      }
      this.executionReportInFlight = true;
      try {
        while (this.executionReportQueue.length) {
          const report = this.executionReportQueue.shift();
          try {
            await provider.reportExecution(report.record.graphId, { ...report, sessionId: this.sessionId });
          } catch (err) {
            // Reporting is best effort: an execution that cannot be reported
            // is still in browserExecutions, and losing it must never break
            // the graph the user is running.
            if (!this.executionReportWarned) {
              console.warn("Browser executions are not reaching the server.", err);
              this.executionReportWarned = true;
            }
            this.executionReportQueue.length = 0;
            break;
          }
        }
      } finally {
        this.executionReportInFlight = false;
      }
    },
    /**
     * Carry one delivery between the worker and the server, and hand the
     * answer back to the execution that is waiting for it.
     */
    async carryDelivery({id, delivery}: any) {
      const provider: any = this.syncProviders.find((p: any) => typeof p.deliverEdge === "function");
      let answer: any = {outputs: []};
      try {
        if (!provider) {
          throw new Error("this session has no server connection to run a server-placed node");
        }
        const result = await provider.deliverEdge(delivery.graphId, delivery);
        answer = result && result.error ? {outputs: [], error: result.error} : {outputs: (result && result.outputs) || []};
      } catch (err: any) {
        answer = {outputs: [], error: String((err && err.message) || err)};
      }
      this.scheduleWorker.postMessage({method: 'delivery-response', args: [{id, answer}]});
    },
    /**
     * Take a delivery the server handed to the browsers (plan §4.8.2).  Taking
     * is what is reported: a tab that dies half way through leaves the hop
     * undone, and running an effect twice is worse than not running it.
     */
    takeDelivery(delivery: any) {
      this.scheduleWorker.postMessage({method: 'deliver', args: [delivery]});
      const provider: any = this.syncProviders.find((p: any) => typeof p.claimDelivery === "function");
      if (!provider || !delivery || !delivery.executionId) {
        return;
      }
      provider.claimDelivery(delivery.graphId || this.graphStore.graph.id, {
        executionId: delivery.executionId,
        key: deliveryKey(delivery),
        session: this.sessionId,
      }).catch((err: any) => console.warn('Cannot tell the server this delivery was taken.', err));
    },
    /**
     * What this session missed while it was away (plan §4.8.2, PB-073).  The
     * server keeps a delivery until a browser takes it; on connecting, and
     * again after a reconnect, this session asks for the ones it would run.
     * The delivery key keeps it from running again what it already ran.
     */
    async resumeDeliveries(graphId: string) {
      const provider: any = this.syncProviders.find((p: any) => typeof p.pendingDeliveries === "function");
      if (!provider || !graphId) {
        return 0;
      }
      try {
        const answer = await provider.pendingDeliveries(graphId, {session: this.sessionId});
        const deliveries = (answer && answer.deliveries) || [];
        deliveries.forEach((delivery: any) => {
          if (shouldRunDelivery(delivery, this.sessionId)) {
            this.takeDelivery(delivery);
          }
        });
        return deliveries.length;
      } catch (err: any) {
        console.warn('Cannot ask what this session missed.', err);
        return 0;
      }
    },
    async createScheduler() {

        this.scheduleWorker = new SchedulerWorker();

        // performance hack.  Avoid using the store on messages from
        // scheduler to avoid any sort of long term memory leaks/GCing
        const beforeSet = (e: any) => {
          if (!this.preferencesStore.preferences!.showConnectorActivity) {
            return;
          }
        }
        const set = (e: any) => {
          if (!this.preferencesStore.preferences!.showConnectorActivity) {
            return;
          }
        }
        const afterSet = (e: any) => {
          if (!this.preferencesStore.preferences!.showConnectorActivity) {
            return;
          }
        }
        const end = (e: any) => {
          if (!this.preferencesStore.preferences!.showConnectorActivity) {
            return;
          }
        }
        const begin = (e: any) => {
          this.startTime = e.time;
        }
        const log = (e: any) => {
          if (!this.preferencesStore.preferences!.showConnectorActivity) {
            return;
          }
        }
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
        // Who the observations of this session belong to, and which version of
        // the graph they ran (the server stamps the document at every cut).
        const user: any = (useAuthenticationStore().identity || {}).user || {};
        const owner = user.sub
          ? {sub: String(user.sub), kind: "human", tenant: "personal:" + String(user.sub)}
          : {sub: "local", kind: "human", tenant: "local"};
        const stamp: any = this.graphStore.currentVersion ? this.graphStore.currentVersion() : null;
        const activeRevision = (stamp && (stamp.id || stamp.revisionId)) || "live";
        const graph = await this.flattenForScheduler(deref(this.graphStore.graph));
        this.scheduleWorker.postMessage({
          method: 'init',
          args: [
            {
              graph,
              owner,
              revisionId: activeRevision,
            },
          ],
        });
        const remoteEvent = (methodName: string, args: any) => {
          if (methodName === 'state-update') {
            const { path, value } = args;
            let obj: any = this.webWorkerProxy;
            for (let i = 0; i < path.length - 1; i++) {
              obj = obj[path[i]];
            }
            obj[path[path.length - 1]] = value;
            return;
          }
          if (methodName === 'delivery-request') {
            // the worker reached a node placed on the server
            this.carryDelivery(args);
            return;
          }
          if (methodName === 'edge.deliver') {
            // the server reached a node placed here; whether this session is
            // the one to run it is the shared rule (plan §4.8.2)
            if (shouldRunDelivery(args, this.sessionId)) {
              this.takeDelivery(args);
            }
            return;
          }
          if (methodName === 'load-request') {
            // A node reached a graph the worker does not have: a component
            // published somewhere, which only this side can fetch.  `load`
            // already knew how; nothing had ever asked it.
            const {id, url} = args || {};
            let answer: any = null;
            this.load({url, setValue: (value: any) => { answer = value; }})
              .catch((err: any) => {
                console.warn("linked_graph: cannot load " + url, err);
              })
              .then(() => {
                this.scheduleWorker.postMessage({method: 'load-response', args: [{id, graph: answer}]});
              });
            return;
          }
          if (methodName === 'execution-finished') {
            // An execution ended in this browser; keep it for the session and
            // report it so the server's observation store covers both domains.
            this.recordBrowserExecution(args);
            return;
          }
          if (methodName === 'error') {
            this.raiseError(args.nodeId, {
              message: args.message || (args.error ? args.error.message : ''),
            }, 'set', args.field, args.graphId);
            return;
          }
          if (methodName === 'afterSet') {
            return afterSet(args);
          }
          if (methodName === 'log') {
            return log(args);
          }
          if (methodName === 'end') {
            return end(args);
          }
          if (methodName === 'begin') {
            return begin(args);
          }
          if (methodName === 'set') {
            return end(args);
          }
          if (methodName === 'beginconnector') {
            return beginconnector(args);
          }
          if (methodName === 'endconnector') {
            return endconnector(args);
          }
          const method = (this as any)[methodName];
          if (typeof method === 'function') {
            method(args);
            return;
          }
        };
        // messages from server
        this.dataProviders.graph!.subscribe('graph-notify-' + this.graphStore.graph.id, async (e: any) => {
            if (e.eventType === 'log' && e.level === 'error') {
              e.eventType = 'error';
            }
            remoteEvent(e.eventType, e);
        });
        // messages from worker
        (this.scheduleWorker.onmessage as any) = (e: any) => {
          const methodName = e.data.source;
          const args = fromJSON(e.data.event);
          remoteEvent(methodName, args);
        }
        const invoke = sendMessage('invoke');
        (this.scheduler.instance as any) = {
          /**
           * What a node template calls to run a node.  Every run gets its own
           * execution id here, so the observations it produces can be found
           * later by the id the editor already knows (plan §4.5.3).
           */
          url: (url: string, value?: any, field?: string, currentNode?: any) => {
            const executionId = newUlid();
            invoke({url, value, field, currentNode, executionId, revisionId: activeRevision});
            return executionId;
          },
        };
        let lastPushedShape: any = schedulerRelevantShape(this.graphStore.graph);
        let pushTimer: any = null;
        const pushGraphToWorker = async (source: any) => {
          const shape = schedulerRelevantShape(source);
          if (crdtDeepEqual(shape, lastPushedShape)) {
            // Only the layout moved, so the running program is unchanged.
            return;
          }
          lastPushedShape = shape;
          const graph = await this.flattenForScheduler(deref(source));
          this.scheduleWorker.postMessage({
            method: 'change',
            args: [graph],
          });
        };
        useGraphSnapshotStore().$subscribe((mutation: any, state: any) => {
          if (!state.graph) {
            return;
          }
          clearTimeout(pushTimer);
          pushTimer = setTimeout(() => {
            pushGraphToWorker(state.graph).catch((err) => {
              console.error('Cannot send the graph to the scheduler.', err);
            });
          }, SCHEDULER_PUSH_DEBOUNCE);
        });
    },
    showInfoDialog(message: string) {
      this.infoMessage = message;
      this.showInfo = true;
    },
    clearInfo() {},
    setHoveredNode() {},
    setHoveredPort() {},
  },
});
