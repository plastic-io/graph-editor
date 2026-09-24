<template>
  <v-menu v-if="serverMode" v-model="open" :close-on-content-click="false" location="top">
    <template v-slot:activator="{props}">
      <v-badge :content="stacks.length" :model-value="stacks.length > 0" :color="badgeColor" overlap>
        <v-icon help-topic="deployment-status" icon="mdi-cloud-outline" v-bind="props" class="ma-2" title="What this graph deploys"/>
      </v-badge>
    </template>
    <v-card width="620" @click.stop @mousemove.stop>
      <v-card-title class="d-flex align-center">
        Infrastructure
        <v-spacer/>
        <v-btn size="x-small" variant="text" icon="mdi-refresh" title="Refresh" :loading="busy" @click="refresh"/>
      </v-card-title>
      <v-card-text>
        <v-alert v-if="message" density="compact" type="warning" variant="tonal" class="mb-2" closable @click:close="message = ''">{{ message }}</v-alert>
        <v-alert v-if="!canPlan && stacks.length" density="compact" type="info" variant="tonal" class="mb-2">
          <small>This server holds no CloudFormation authority, so it can check a template and not ask what deploying it would do.</small>
        </v-alert>
        <v-list density="compact" max-height="60vh" style="overflow-y: auto">
          <v-list-item v-for="s in stacks" :key="s.nodeId" :title="s.name" :subtitle="subtitleFor(s)">
            <template v-slot:prepend>
              <v-icon :color="colorFor(s)" :title="stateOf(s)">{{ iconFor(s) }}</v-icon>
            </template>
            <template v-slot:append>
              <v-btn v-if="canPlan" size="x-small" variant="text" icon="mdi-magnify-scan" title="What would this change do?" :loading="planning === s.nodeId" @click.stop="plan(s)"/>
            </template>

            <div v-if="problemsOf(s).length" class="mt-1">
              <div v-for="(p, i) in problemsOf(s)" :key="i" class="text-error"><small>{{ p.resource ? p.resource + ': ' : '' }}{{ p.message }}</small></div>
            </div>

            <div v-if="planOf(s)" class="mt-1">
              <small :class="planOf(s).destructive ? 'text-warning' : 'text-disabled'">
                {{ changeLine(planOf(s)) }}
              </small>
              <div v-for="c in planOf(s).changes" :key="c.logicalId">
                <small class="text-disabled">{{ c.action }} {{ c.logicalId }} ({{ c.resourceType }}){{ c.replacement && c.replacement !== 'False' ? ' — replaced' : '' }}</small>
              </div>
            </div>

            <div v-if="reasonOf(s)" class="mt-1 text-error"><small>{{ reasonOf(s) }}</small></div>
          </v-list-item>
          <v-list-item v-if="!stacks.length && !busy"
            title="This graph describes no infrastructure"
            subtitle="A node carrying a CloudFormation template appears here, with what deploying it would do"/>
        </v-list>
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
 * What this graph deploys (plan §4.9, PB-094).
 *
 * A node carrying a template is a piece of infrastructure the graph describes,
 * and until now the only way to find out what it would do was to be an agent
 * calling `iac.plan`.  This asks the same service the same questions: whether
 * the template is one this environment allows, and — where the server can ask
 * CloudFormation — what the change would add, change or take away.
 *
 * Nothing here applies anything.  There is no button for it because there is
 * no route behind it: planning is the whole of what this milestone can do, and
 * a panel that offered more than the server can do would be a lie about what
 * has been built.
 */
export default {
  name: "deployment-status",
  data() {
    return {
      open: false,
      busy: false,
      planning: "",
      message: "",
      stacks: [] as any[],
      canPlan: false,
    };
  },
  watch: {
    open(isOpen: boolean) {
      if (isOpen) {
        this.refresh();
      }
    },
    graphLoaded(loaded: boolean) {
      if (loaded && this.open) {
        this.refresh();
      }
    },
  },
  mounted() {
    if ((this as any).graphLoaded) {
      this.refresh();
    }
  },
  computed: {
    ...mapState(useGraphStore, ["graphLoaded", "graph"]),
    serverMode(): boolean {
      const prefs = (usePreferencesStore() as any).preferences;
      return !!prefs && !prefs.useLocalStorage;
    },
    badgeColor(): string {
      if (this.stacks.some((s: any) => this.problemsOf(s).length || this.reasonOf(s))) {
        return "error";
      }
      return this.stacks.some((s: any) => this.planOf(s) && this.planOf(s).destructive) ? "warning" : "info";
    },
  },
  methods: {
    /**
     * The provider that speaks to the graph server's own routes.  Not
     * `dataProviders.graph` — that one syncs the document and knows nothing
     * about what the server can be asked, so reaching for it left this panel
     * empty and silent.  The one that answers is whichever sync provider
     * offers the call, which is how the executions panel finds it too.
     */
    provider(): any {
      const orchestrator = useOrchestratorStore() as any;
      return (orchestrator.syncProviders || []).find((p: any) => typeof p.listStacks === "function");
    },
    graphId(): string {
      return (this as any).graph && (this as any).graph.id;
    },
    async refresh() {
      const graphId = this.graphId();
      if (!graphId) {
        return;
      }
      const provider = this.provider();
      if (!provider) {
        // Silence here reads as "this graph deploys nothing", which is a
        // different thing from "nothing here can ask".
        this.stacks = [];
        this.canPlan = false;
        this.message = "Nothing here can ask this server about stacks; it may be older than this editor.";
        return;
      }
      this.busy = true;
      this.message = "";
      try {
        const answer = await provider.listStacks(graphId);
        this.stacks = (answer && answer.stacks) || [];
        this.canPlan = !!(answer && answer.canPlan);
      } catch (err: any) {
        this.message = err.message || String(err);
      }
      this.busy = false;
    },
    async plan(stack: any) {
      const provider = this.provider();
      this.planning = stack.nodeId;
      this.message = "";
      try {
        const answer = await provider.planStack(this.graphId(), stack.nodeId);
        stack.status = answer.status || answer;
      } catch (err: any) {
        // a refusal is an answer: it says which template and why
        this.message = err.message || String(err);
      }
      this.planning = "";
      await this.refresh();
    },
    stateOf(stack: any): string {
      if (this.problemsOf(stack).length) {
        return "this environment would refuse this template";
      }
      return (stack.status && stack.status.state) || "never planned";
    },
    planOf(stack: any): any {
      return stack.status && stack.status.plan;
    },
    problemsOf(stack: any): any[] {
      const fromTemplate = (stack.validation && stack.validation.problems) || [];
      const fromPlan = (stack.status && stack.status.problems) || [];
      return fromTemplate.length ? fromTemplate : fromPlan;
    },
    reasonOf(stack: any): string {
      return (stack.status && !this.problemsOf(stack).length && stack.status.reason) || "";
    },
    subtitleFor(stack: any): string {
      const where = `${stack.stack.name} · ${stack.stack.region} · ${stack.stack.environment}`;
      const counted = stack.validation ? `${stack.validation.counts.resources} resource${stack.validation.counts.resources === 1 ? "" : "s"}` : "";
      return [where, counted, this.stateOf(stack)].filter(Boolean).join(" — ");
    },
    changeLine(plan: any): string {
      if (!plan.changes.length) {
        return "nothing would change: the stack already matches";
      }
      const added = plan.changes.filter((c: any) => c.action === "Add").length;
      const modified = plan.changes.filter((c: any) => c.action === "Modify").length;
      const removed = plan.changes.filter((c: any) => c.action === "Remove").length;
      const parts = [added && `${added} added`, modified && `${modified} changed`, removed && `${removed} removed`].filter(Boolean);
      return parts.join(", ") + (plan.destructive ? " — this takes something away" : "");
    },
    iconFor(stack: any): string {
      if (this.problemsOf(stack).length) {
        return "mdi-close-octagon-outline";
      }
      const state = (stack.status && stack.status.state) || "";
      if (state === "planned") {
        return this.planOf(stack) && this.planOf(stack).destructive ? "mdi-alert-outline" : "mdi-check-circle-outline";
      }
      if (state === "failed") {
        return "mdi-alert-circle-outline";
      }
      return "mdi-cloud-question-outline";
    },
    colorFor(stack: any): string {
      if (this.problemsOf(stack).length) {
        return "error";
      }
      const state = (stack.status && stack.status.state) || "";
      if (state === "failed") {
        return "error";
      }
      if (state === "planned") {
        return this.planOf(stack) && this.planOf(stack).destructive ? "warning" : "success";
      }
      return "info";
    },
  },
};
</script>
