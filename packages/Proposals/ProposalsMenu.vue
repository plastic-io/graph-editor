<template>
  <v-menu v-if="serverMode" v-model="open" :close-on-content-click="false" location="top">
    <template v-slot:activator="{props}">
      <v-badge :content="awaiting" :model-value="awaiting > 0" color="warning" overlap>
        <v-icon help-topic="proposals" icon="mdi-robot-outline" v-bind="props" class="ma-2" title="Proposals and agent activity"/>
      </v-badge>
    </template>
    <v-card width="520" @click.stop @mousemove.stop>
      <v-card-title class="d-flex align-center">
        Proposals
        <v-spacer/>
        <v-btn size="x-small" variant="text" icon="mdi-refresh" title="Refresh" @click="refresh"/>
      </v-card-title>
      <v-card-text>
        <v-alert v-if="message" density="compact" :type="messageType" variant="tonal" class="mb-2" closable @click:close="message = ''">{{ message }}</v-alert>
        <v-alert v-if="inRewindMode && previewing" density="compact" type="info" variant="tonal" class="mb-2">
          Previewing "{{ previewing.description }}". Touched nodes are selected, added connections highlighted.
          <a href="#" @click.prevent="leave">Back to live</a>
        </v-alert>
        <v-list density="compact" max-height="40vh" style="overflow-y: auto">
          <v-list-item v-for="p in proposals" :key="p.proposalId" :title="p.description" :subtitle="subtitleFor(p)">
            <template v-slot:prepend>
              <v-icon :color="colorFor(p.state)">{{ iconFor(p.state) }}</v-icon>
            </template>
            <template v-slot:append>
              <v-btn icon="mdi-eye-outline" size="x-small" variant="text" title="Preview" @click="preview(p)"/>
              <v-btn v-if="isOpen(p)" icon="mdi-sync" size="x-small" variant="text" title="Re-validate against the graph as it is now" @click="validate(p)"/>
              <v-btn v-if="isOpen(p)" icon="mdi-check-bold" size="x-small" variant="text" color="success" title="Commit through admission as you" :disabled="busy" @click="commit(p)"/>
              <v-btn v-if="isOpen(p)" icon="mdi-close-thick" size="x-small" variant="text" color="error" title="Reject" :disabled="busy" @click="reject(p)"/>
            </template>
            <div class="proposal-detail">
              <div><small>{{ p.state }} · by {{ who(p.principal) }} · base {{ short(p.baseRevision) }}<span v-if="p.requiredDecisions && p.requiredDecisions.length"> · needs {{ p.requiredDecisions.join(', ') }}</span></small></div>
              <div v-if="p.rationale" class="rationale"><small><i>Agent's rationale (untrusted):</i> {{ p.rationale }}</small></div>
              <div v-if="p.diffSummary"><small>{{ describe(p.diffSummary) }}</small></div>
              <div v-if="p.validation && !p.validation.ok"><small class="text-error">{{ p.validation.errors.map((e: any) => e.code + ': ' + e.message).join('; ') }}</small></div>
              <div v-if="p.warnings && p.warnings.length"><small class="text-warning">{{ p.warnings.join('; ') }}</small></div>
            </div>
          </v-list-item>
          <v-list-item v-if="!proposals.length" title="No proposals" subtitle="Agents propose changes through the MCP server; they appear here for you to commit or reject"/>
        </v-list>
        <v-divider class="my-2"/>
        <div class="d-flex align-center">
          <span class="text-subtitle-2">Agent activity</span>
          <v-spacer/>
          <v-btn size="x-small" variant="text" @click="showActivity = !showActivity">{{ showActivity ? 'hide' : 'show' }}</v-btn>
        </div>
        <v-list v-if="showActivity" density="compact" max-height="30vh" style="overflow-y: auto">
          <v-list-item v-for="r in activity" :key="r.id" :title="r.kind + (r.description ? ' · ' + r.description : '')" :subtitle="activitySubtitle(r)" :prepend-icon="r.principal && r.principal.kind === 'agent' ? 'mdi-robot' : r.principal && r.principal.kind === 'system' ? 'mdi-server' : 'mdi-account'"/>
          <v-list-item v-if="!activity.length" title="Nothing recorded yet"/>
        </v-list>
      </v-card-text>
    </v-card>
  </v-menu>
</template>
<script lang="ts">
import {mapState, mapActions} from "pinia";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
export default {
  name: "proposals-menu",
  data() {
    return {
      open: false,
      busy: false,
      message: "",
      messageType: "info" as "info" | "warning" | "error" | "success",
      proposals: [] as any[],
      activity: [] as any[],
      showActivity: false,
      previewing: null as any,
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
        this.refresh();
      }
    },
  },
  mounted() {
    if ((this as any).graphLoaded) {
      this.subscribe();
      this.refresh();
    }
  },
  unmounted() {
    this.unsubscribe();
  },
  computed: {
    ...mapState(useGraphStore, ["inRewindMode", "graphLoaded", "graph"]),
    serverMode(): boolean {
      const prefs = (usePreferencesStore() as any).preferences;
      return !!prefs && !prefs.useLocalStorage;
    },
    awaiting(): number {
      return (this as any).proposals.filter((p: any) => p.state === "awaiting-review" || p.state === "validated").length;
    },
  },
  methods: {
    ...mapActions(useGraphStore, ["listProposals", "previewProposal", "leaveProposalPreview", "validateProposal", "commitProposal", "decideProposal", "agentActivity"]),
    subscribe() {
      const orchestrator = useOrchestratorStore() as any;
      const graphId = (this as any).graph && (this as any).graph.id;
      const provider = orchestrator.dataProviders && orchestrator.dataProviders.graph;
      if (!graphId || !provider || typeof provider.subscribe !== "function" || this.subscribedTo === graphId) {
        return;
      }
      this.unsubscribe();
      this.listener = (e: any) => {
        if (e && e.eventType === "proposal") {
          this.refresh();
          if (!this.open) {
            this.say(e.action === "created" ? `An agent proposed "${e.description || "a change"}".` : `Proposal ${e.action}.`);
          }
        }
      };
      provider.subscribe("graph-notify-" + graphId, this.listener);
      this.subscribedTo = graphId;
    },
    unsubscribe() {
      const orchestrator = useOrchestratorStore() as any;
      const provider = orchestrator.dataProviders && orchestrator.dataProviders.graph;
      if (this.listener && provider && this.subscribedTo && typeof provider.unsubscribe === "function") {
        provider.unsubscribe("graph-notify-" + this.subscribedTo, this.listener);
      }
      this.listener = null;
      this.subscribedTo = "";
    },
    async refresh() {
      try {
        const [list, activity] = await Promise.all([(this as any).listProposals(), (this as any).agentActivity(50)]);
        this.proposals = list.proposals || [];
        this.activity = (activity.records || []).filter((r: any) => /^(mcp\.|proposal\.)/.test(r.kind) || (r.principal && r.principal.kind === "agent"));
      } catch (err: any) {
        this.say(`Cannot load proposals: ${err.message}`, "error");
      }
    },
    say(text: string, type: "info" | "warning" | "error" | "success" = "info") {
      this.message = text;
      this.messageType = type;
    },
    isOpen(p: any): boolean {
      return p.state === "awaiting-review" || p.state === "validated" || p.state === "stale";
    },
    who(principal: any): string {
      if (!principal) return "?";
      const sub = String(principal.sub).split("|").pop();
      return principal.delegatedBy ? `${sub} (for ${String(principal.delegatedBy).split("|").pop()})` : sub || "?";
    },
    short(rev: string): string {
      return rev ? rev.replace(/^rev_/, "").slice(-6) : "";
    },
    subtitleFor(p: any): string {
      return `${p.createdAt ? new Date(p.createdAt).toLocaleString() : ""} · ${(p.diffSummary && p.diffSummary.namespaces || []).join(", ")}`;
    },
    describe(d: any): string {
      const parts: string[] = [];
      if (d.nodesAdded) parts.push(`+${d.nodesAdded} node(s)`);
      if (d.nodesRemoved) parts.push(`-${d.nodesRemoved} node(s)`);
      if (d.nodesChanged) parts.push(`${d.nodesChanged} node(s) changed`);
      if (d.connectorsAdded) parts.push(`+${d.connectorsAdded} connection(s)`);
      if (d.connectorsRemoved) parts.push(`-${d.connectorsRemoved} connection(s)`);
      const ops = (d.ops || []).map((o: any) => o.op + (o.nodeId ? " " + o.nodeId.slice(0, 8) : "") + (o.field ? " " + o.field : "")).slice(0, 8).join(", ");
      return `${parts.join(", ")}${ops ? " · " + ops : ""}${d.opsTruncated ? " …" : ""}`;
    },
    iconFor(state: string): string {
      return ({ "awaiting-review": "mdi-account-clock", validated: "mdi-check-circle-outline", committed: "mdi-check-all", rejected: "mdi-cancel", expired: "mdi-timer-off", stale: "mdi-alert-circle-outline" } as any)[state] || "mdi-file-question";
    },
    colorFor(state: string): string | undefined {
      return ({ "awaiting-review": "warning", validated: "info", committed: "success", rejected: "error", stale: "warning" } as any)[state];
    },
    activitySubtitle(r: any): string {
      const who = r.principal ? String(r.principal.sub).split("|").pop() : "?";
      return `${r.at ? new Date(r.at).toLocaleString() : ""} · ${who}${r.decision ? " · " + r.decision : ""}${r.code ? " · " + r.code : ""}`;
    },
    async preview(p: any) {
      try {
        await (this as any).previewProposal(p);
        this.previewing = p;
        this.say(`Previewing "${p.description}"; the live graph is unchanged.`);
      } catch (err: any) {
        this.say(`Cannot preview: ${err.message}`, "error");
      }
    },
    async leave() {
      await (this as any).leaveProposalPreview();
      this.previewing = null;
      this.message = "";
    },
    async validate(p: any) {
      this.busy = true;
      try {
        const r = await (this as any).validateProposal(p, true);
        this.say(r && r.proposal ? `Validated: ${r.proposal.state}.` : "Validated.", "success");
        await this.refresh();
      } catch (err: any) {
        this.say(`Cannot validate: ${err.message}`, "error");
      } finally {
        this.busy = false;
      }
    },
    async commit(p: any) {
      this.busy = true;
      try {
        const r = await (this as any).commitProposal(p);
        this.previewing = null;
        this.say(r && r.proposal && r.proposal.state === "committed" ? `Committed "${p.description}" as you.` : `Commit answered ${r && r.result && r.result.decision}.`, "success");
        await this.refresh();
      } catch (err: any) {
        this.say(`Cannot commit: ${err.message}`, "error");
      } finally {
        this.busy = false;
      }
    },
    async reject(p: any) {
      this.busy = true;
      try {
        await (this as any).decideProposal(p, "reject", "rejected in the editor");
        this.previewing = null;
        this.say(`Rejected "${p.description}".`, "info");
        await this.refresh();
      } catch (err: any) {
        this.say(`Cannot reject: ${err.message}`, "error");
      } finally {
        this.busy = false;
      }
    },
  },
};
</script>
<style scoped>
.proposal-detail { white-space: normal; line-height: 1.3; }
.rationale { opacity: 0.85; }
</style>
