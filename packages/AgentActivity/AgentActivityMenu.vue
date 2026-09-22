<template>
  <v-menu v-if="serverMode" v-model="open" :close-on-content-click="false" location="top">
    <template v-slot:activator="{props}">
      <v-badge :content="atWork.length" :model-value="atWork.length > 0" color="warning" overlap>
        <v-icon
          help-topic="agentActivity"
          icon="mdi-history"
          v-bind="props"
          class="ma-2"
          :color="atWork.length ? 'warning' : ''"
          :title="atWork.length ? agentsTitle : 'Who has changed this graph'"/>
      </v-badge>
    </template>
    <v-card width="560" @click.stop @mousemove.stop>
      <v-card-title class="d-flex align-center">
        Who has changed this graph
        <v-spacer/>
        <v-btn size="x-small" variant="text" icon="mdi-refresh" title="Refresh" :loading="busy" @click="refresh"/>
      </v-card-title>
      <v-card-text>
        <v-alert v-if="message" density="compact" type="warning" variant="tonal" class="mb-2" closable @click:close="message = ''">{{ message }}</v-alert>
        <v-alert v-if="atWork.length" density="compact" type="info" variant="tonal" class="mb-2">
          <small>{{ agentsTitle }}</small>
        </v-alert>
        <v-list density="compact" max-height="50vh" style="overflow-y: auto">
          <v-list-item
            v-for="record in records"
            :key="record.id"
            :title="titleFor(record)"
            :subtitle="subtitleFor(record)">
            <template v-slot:prepend>
              <v-icon :color="colorFor(record)" :title="whoIs(record)">{{ iconFor(record) }}</v-icon>
            </template>
            <div v-if="record.reason" class="text-error"><small>{{ record.reason }}</small></div>
            <div v-if="record.warnings && record.warnings.length" class="text-warning">
              <small>{{ record.warnings.join('; ') }}</small>
            </div>
          </v-list-item>
          <v-list-item v-if="!records.length && !busy" title="Nothing has changed this graph yet"
            subtitle="Every admitted change and every refusal is listed here, whoever made it"/>
        </v-list>
      </v-card-text>
    </v-card>
  </v-menu>
</template>
<script lang="ts">
import {mapState} from "pinia";
import moment from "moment";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";

/**
 * What has been done to this graph, and by whom (plan §8.1, PB-112).
 *
 * A graph with agents working on it changes while nobody is looking at the
 * canvas.  The audit chain already knows every admitted change and every
 * refusal, with who made it; this is that list, newest first, in the words a
 * person would use.
 *
 * An agent is not a peer on the socket, so it cannot appear among the people
 * watching — what this can honestly say is that one **acted recently**, which
 * is what the badge and the line at the top mean.  Nothing here claims
 * presence it cannot see.
 */
const AT_WORK_MS = 180000;
const POLL_MS = 30000;

export default {
  name: "agent-activity-menu",
  data() {
    return {
      open: false,
      busy: false,
      message: "",
      records: [] as any[],
      listener: null as any,
      subscribedTo: "",
      timer: 0 as any,
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
        this.refresh();
      }
    },
  },
  mounted() {
    if ((this as any).graphLoaded) {
      this.subscribe();
      this.refresh();
    }
    this.timer = setInterval(() => {
      if ((this as any).graphLoaded) {
        this.refresh();
      }
    }, POLL_MS);
  },
  unmounted() {
    clearInterval(this.timer);
    this.unsubscribe();
  },
  computed: {
    ...mapState(useGraphStore, ["graphLoaded", "graph"]),
    serverMode(): boolean {
      const prefs = (usePreferencesStore() as any).preferences;
      return !!prefs && !prefs.useLocalStorage;
    },
    /** Agents whose newest change is recent enough to call it work in progress. */
    atWork(): any[] {
      const since = Date.now() - AT_WORK_MS;
      const seen = new Map<string, any>();
      (this as any).records.forEach((record: any) => {
        const principal = record.principal || {};
        if (principal.kind !== "agent" || Date.parse(record.at) < since) {
          return;
        }
        if (!seen.has(principal.sub)) {
          seen.set(principal.sub, { sub: principal.sub, at: record.at, what: record.description || record.kind });
        }
      });
      return [...seen.values()];
    },
    agentsTitle(): string {
      const agents = (this as any).atWork;
      if (!agents.length) {
        return "";
      }
      const names = agents.map((a: any) => shortName(a.sub));
      return names.length === 1
        ? `${names[0]} has been working on this graph in the last few minutes`
        : `${names.join(", ")} have been working on this graph in the last few minutes`;
    },
  },
  methods: {
    subscribe() {
      const orchestrator = useOrchestratorStore() as any;
      const graphId = (this as any).graph && (this as any).graph.id;
      const provider = orchestrator.dataProviders && orchestrator.dataProviders.graph;
      if (!graphId || !provider || typeof provider.subscribe !== "function" || this.subscribedTo === graphId) {
        return;
      }
      this.unsubscribe();
      // Anything the server admits, refuses or publishes says so on this
      // channel, so the list does not wait for the next poll.
      this.listener = (e: any) => {
        if (e && ["proposal", "revision", "component", "mutation"].indexOf(e.eventType) !== -1) {
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
      const graphStore = useGraphStore() as any;
      if (typeof graphStore.agentActivity !== "function" || !(this as any).graphLoaded) {
        return;
      }
      this.busy = true;
      try {
        const answer = await graphStore.agentActivity(50);
        this.records = (answer && answer.records) || [];
        // Whoever else is looking at this graph should see that an agent is
        // working on it, without opening this panel.
        (useOrchestratorStore() as any).agentsAtWork = this.atWork;
      } catch (err: any) {
        this.message = String((err && err.message) || err);
      } finally {
        this.busy = false;
      }
    },
    whoIs(record: any): string {
      const principal = record.principal || {};
      if (principal.kind === "agent") {
        return `${shortName(principal.sub)}, an agent${principal.delegatedBy ? ` acting for ${shortName(principal.delegatedBy)}` : ""}`;
      }
      if (principal.kind === "system") {
        return "the server itself";
      }
      return shortName(principal.sub) || "somebody";
    },
    titleFor(record: any): string {
      const what = record.description || humanKind(record.kind) || "a change";
      return record.decision === "rejected" ? `Refused: ${what}` : what;
    },
    subtitleFor(record: any): string {
      const parts = [this.whoIs(record), moment(record.at).fromNow()];
      if (record.namespaces && record.namespaces.length) {
        parts.push(record.namespaces.join(", "));
      }
      if (record.code) {
        parts.push(record.code);
      }
      return parts.join(" · ");
    },
    colorFor(record: any): string {
      if (record.decision === "rejected") {
        return "error";
      }
      return (record.principal || {}).kind === "agent" ? "warning" : "";
    },
    iconFor(record: any): string {
      if (record.decision === "rejected") return "mdi-cancel";
      if (/revision/.test(record.kind || "")) return "mdi-source-branch";
      if (/component/.test(record.kind || "")) return "mdi-package-variant-closed";
      if (/proposal/.test(record.kind || "")) return "mdi-file-document-edit-outline";
      return (record.principal || {}).kind === "agent" ? "mdi-robot-outline" : "mdi-pencil";
    },
  },
};

/** A record kind in the words a person would use for it. */
function humanKind(kind: string): string {
  if (!kind) {
    return "";
  }
  const tool = /^mcp\.tool\.(.+)$/.exec(kind);
  if (tool) {
    return `${tool[1]}, through the protocol`;
  }
  return kind
    .replace(/^proposal\./, "proposal ")
    .replace(/^revision\./, "revision ")
    .replace(/^component\./, "component ")
    .replace(/\./g, " ");
}

/** An identity in the shortest form that still names somebody. */
function shortName(sub: string): string {
  if (!sub) {
    return "";
  }
  const tail = String(sub).split("|").pop() || String(sub);
  return tail.length > 12 ? `${tail.slice(0, 6)}…${tail.slice(-4)}` : tail;
}
</script>
