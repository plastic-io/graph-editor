<template>
  <v-menu v-if="serverMode" v-model="open" :close-on-content-click="false" location="top">
    <template v-slot:activator="{props}">
      <v-badge :content="running" :model-value="running > 0" color="info" overlap>
        <v-icon help-topic="executions" icon="mdi-pulse" v-bind="props" class="ma-2" title="What this graph did"/>
      </v-badge>
    </template>
    <v-card width="560" @click.stop @mousemove.stop>
      <v-card-title class="d-flex align-center">
        Executions
        <v-spacer/>
        <v-btn size="x-small" variant="text" icon="mdi-refresh" title="Refresh" :loading="busy" @click="refresh"/>
      </v-card-title>
      <v-card-text>
        <v-alert v-if="message" density="compact" type="warning" variant="tonal" class="mb-2" closable @click:close="message = ''">{{ message }}</v-alert>
        <v-list density="compact" max-height="45vh" style="overflow-y: auto">
          <v-list-item
            v-for="e in executions"
            :key="e.executionId"
            :title="titleFor(e)"
            :subtitle="subtitleFor(e)"
            :active="selected === e.executionId"
            @click="select(e)">
            <template v-slot:prepend>
              <v-icon :color="colorFor(e)" :title="e.domain === 'browser' ? 'ran in a browser' : 'ran on the server'">
                {{ e.domain === 'browser' ? 'mdi-monitor' : 'mdi-server' }}
              </v-icon>
            </template>
            <template v-slot:append>
              <small>{{ e.hops }} hop{{ e.hops === 1 ? '' : 's' }}</small>
            </template>
          </v-list-item>
          <v-list-item v-if="!executions.length && !busy" title="Nothing has run yet" subtitle="Executions started here, from the server, or by an agent all appear in this list"/>
        </v-list>
        <template v-if="selected">
          <v-divider class="my-2"/>
          <div class="d-flex align-center mb-1">
            <span class="text-subtitle-2">What it did</span>
            <v-spacer/>
            <small v-if="crossDomain" class="text-info">crossed between browser and server</small>
          </div>
          <v-list density="compact" max-height="35vh" style="overflow-y: auto">
            <v-list-item v-for="o in observations" :key="o.id" :title="lineFor(o)" :subtitle="detailFor(o)">
              <template v-slot:prepend>
                <v-icon size="x-small" :color="kindColor(o.kind)">{{ kindIcon(o.kind) }}</v-icon>
              </template>
              <template v-slot:append>
                <small class="text-disabled">{{ o.domain }}</small>
              </template>
            </v-list-item>
            <v-list-item v-if="!observations.length" title="No observations were kept for this execution"/>
          </v-list>
        </template>
      </v-card-text>
    </v-card>
  </v-menu>
</template>
<script lang="ts">
import {mapState} from "pinia";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";

/**
 * What this graph did (plan §4.5.3, PB-114).
 *
 * A graph runs in two places, so "what happened" is only answerable by asking
 * the server, which holds both halves: what it ran itself and what browsers
 * reported.  The list is that answer, newest first; opening one shows the hops
 * in order, and says where each of them happened.
 */
export default {
  name: "executions-menu",
  data() {
    return {
      open: false,
      busy: false,
      message: "",
      executions: [] as any[],
      observations: [] as any[],
      selected: "",
      listener: null as any,
      subscribedTo: "",
    };
  },
  watch: {
    open(isOpen: boolean) {
      if (isOpen) {
        this.refresh();
      }
    },
    graphLoaded(loaded: boolean) {
      if (loaded) {
        this.subscribe();
      }
    },
  },
  mounted() {
    if ((this as any).graphLoaded) {
      this.subscribe();
    }
  },
  unmounted() {
    this.unsubscribe();
  },
  computed: {
    ...mapState(useGraphStore, ["graphLoaded", "graph"]),
    serverMode(): boolean {
      const prefs = (usePreferencesStore() as any).preferences;
      return !!prefs && !prefs.useLocalStorage;
    },
    running(): number {
      const orchestrator = useOrchestratorStore() as any;
      return (orchestrator.executionReportQueue || []).length;
    },
    crossDomain(): boolean {
      const domains = new Set((this as any).observations.map((o: any) => o.domain));
      return domains.size > 1;
    },
  },
  methods: {
    provider(): any {
      const orchestrator = useOrchestratorStore() as any;
      return (orchestrator.syncProviders || []).find((p: any) => typeof p.listExecutions === "function");
    },
    subscribe() {
      const orchestrator = useOrchestratorStore() as any;
      const graphId = (this as any).graph && (this as any).graph.id;
      const provider = orchestrator.dataProviders && orchestrator.dataProviders.graph;
      if (!graphId || !provider || typeof provider.subscribe !== "function" || this.subscribedTo === graphId) {
        return;
      }
      this.unsubscribe();
      // An execution that ends anywhere shows up here without asking again.
      this.listener = (e: any) => {
        if (e && (e.eventType === "info" || e.eventType === "edge.deliver") && this.open) {
          this.refresh();
        }
      };
      provider.subscribe("graph-notify-" + graphId, this.listener);
      this.subscribedTo = graphId;
    },
    unsubscribe() {
      const orchestrator = useOrchestratorStore() as any;
      const provider = orchestrator.dataProviders && orchestrator.dataProviders.graph;
      if (this.listener && provider && typeof provider.unsubscribe === "function") {
        provider.unsubscribe("graph-notify-" + this.subscribedTo, this.listener);
      }
      this.listener = null;
      this.subscribedTo = "";
    },
    async refresh() {
      const provider = this.provider();
      const graphId = (this as any).graph && (this as any).graph.id;
      if (!provider || !graphId) {
        return;
      }
      this.busy = true;
      try {
        const result = await provider.listExecutions(graphId);
        this.executions = (result && result.executions) || [];
        if (this.selected) {
          await this.load(this.selected);
        }
      } catch (err: any) {
        this.message = String((err && err.message) || err);
      } finally {
        this.busy = false;
      }
    },
    async select(execution: any) {
      if (this.selected === execution.executionId) {
        this.selected = "";
        this.observations = [];
        return;
      }
      await this.load(execution.executionId);
    },
    async load(executionId: string) {
      const provider = this.provider();
      const graphId = (this as any).graph && (this as any).graph.id;
      if (!provider || !graphId) {
        return;
      }
      try {
        const result = await provider.execution(graphId, executionId);
        this.selected = executionId;
        this.observations = (result && result.observations) || [];
      } catch (err: any) {
        this.message = String((err && err.message) || err);
      }
    },
    nameOf(nodeId: string): string {
      const graph: any = (this as any).graph;
      const node = graph && (graph.nodes || []).find((n: any) => n.id === nodeId);
      return (node && node.properties && node.properties.name) || (node && node.url) || (nodeId || "").slice(0, 8);
    },
    titleFor(e: any): string {
      const when = new Date(e.startedAt).toLocaleTimeString();
      return `${e.entry && e.entry.nodeUrl ? e.entry.nodeUrl : "execution"} · ${when}`;
    },
    subtitleFor(e: any): string {
      const parts = [e.state, `${e.observations ? e.observations.count : 0} observations`];
      if (e.errors) {
        parts.push(`${e.errors} error${e.errors === 1 ? "" : "s"}`);
      }
      if (e.effects && (e.effects.allowed || e.effects.denied)) {
        parts.push(`${e.effects.allowed} effect${e.effects.allowed === 1 ? "" : "s"}${e.effects.denied ? `, ${e.effects.denied} refused` : ""}`);
      }
      parts.push(`${e.duration}ms`);
      return parts.join(" · ");
    },
    colorFor(e: any): string {
      if (e.errors) {
        return "error";
      }
      return e.state === "completed" ? "success" : "warning";
    },
    lineFor(o: any): string {
      const node = o.nodeId ? this.nameOf(o.nodeId) : "";
      if (o.kind === "effect" || o.kind === "effect.denied") {
        const c = o.capability || {};
        return `${o.kind === "effect" ? "did" : "was refused"} ${c.kind} ${(c.scope || []).join(", ")}${node ? ` · ${node}` : ""}`;
      }
      if (o.kind === "route" && o.payload && o.payload.deferred) {
        return `handed ${node} to the ${o.payload.deferred}`;
      }
      if (o.kind === "custom") {
        return `${node} said ${(o.payload && o.payload.kind) || "something"}`;
      }
      if (o.kind === "exec.begin") {
        return `started at ${(o.payload && o.payload.url) || ""}`;
      }
      if (o.kind === "exec.end") {
        return `finished ${(o.payload && o.payload.state) || ""}`;
      }
      if (o.kind === "exec.error") {
        return `error in ${node || "the execution"}`;
      }
      if (o.kind === "budget.exhausted") {
        return `ran out of ${(o.budget && o.budget.dimension) || "budget"}${node ? ` · ${node}` : ""}`;
      }
      if (o.kind === "contract.violation") {
        return `contract violation at ${node}`;
      }
      return `${o.kind}${node ? ` · ${node}` : ""}`;
    },
    detailFor(o: any): string {
      if (o.payload && o.payload.message) {
        return String(o.payload.message).slice(0, 160);
      }
      if (o.payload && o.payload.value !== undefined) {
        try {
          return JSON.stringify(o.payload.value).slice(0, 160);
        } catch (err) {
          return "";
        }
      }
      if (o.payload && o.payload.redacted) {
        return `payload not shown (${o.payload.redacted})`;
      }
      if (o.payload && o.payload.meta) {
        return `${o.payload.meta.type}, ${o.payload.meta.bytes} bytes`;
      }
      return "";
    },
    kindIcon(kind: string): string {
      if (kind === "effect") return "mdi-check-circle-outline";
      if (kind === "effect.denied") return "mdi-cancel";
      if (kind === "exec.error") return "mdi-alert-circle-outline";
      if (kind === "budget.exhausted") return "mdi-timer-alert-outline";
      if (kind === "contract.violation") return "mdi-format-list-checks";
      if (kind === "custom") return "mdi-message-outline";
      if (kind === "route") return "mdi-arrow-right-bold-outline";
      if (kind === "exec.begin") return "mdi-play-circle-outline";
      if (kind === "exec.end") return "mdi-flag-checkered";
      return "mdi-circle-small";
    },
    kindColor(kind: string): string {
      if (kind === "effect.denied" || kind === "exec.error" || kind === "budget.exhausted") return "error";
      if (kind === "contract.violation") return "warning";
      if (kind === "effect") return "success";
      return "";
    },
  },
};
</script>
