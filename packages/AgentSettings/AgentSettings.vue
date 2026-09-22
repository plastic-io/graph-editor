<template>
  <div>
    <p class="text-caption mb-2">An agent acts only with what you delegate: which graph (or every graph), which authorities, until when. Its token identifies it; this record lets it in.</p>
    <v-alert v-if="message" density="compact" :type="messageType" variant="tonal" class="mb-2" closable @click:close="message = ''">{{ message }}</v-alert>
    <v-list density="compact">
      <v-list-item v-for="d in delegations" :key="d.agentSub + d.graphId" :title="d.agentSub" :subtitle="(d.graphId === '*' ? 'every graph' : d.graphId) + ' · ' + d.scopes.join(', ') + (d.expiresAt ? ' · until ' + new Date(d.expiresAt).toLocaleDateString() : '')">
        <template v-slot:append>
          <v-btn icon="mdi-delete-outline" size="x-small" variant="text" @click="remove(d)"/>
        </template>
      </v-list-item>
      <v-list-item v-if="!delegations.length" title="No agents delegated"/>
    </v-list>
    <v-divider class="my-2"/>
    <div class="text-subtitle-2">How much of their work you see first</div>
    <p class="text-caption mb-1">
      Supervised: an agent proposes and you decide. Auto: an agent you delegated commit to acts without asking.
      Either way it can only do what you delegated, and either way the tests and journeys still decide what may be published or run.
    </p>
    <v-radio-group v-model="autonomy" density="compact" hide-details inline :disabled="busy" @update:modelValue="saveAutonomy">
      <v-radio label="Supervised" value="supervised"/>
      <v-radio label="Auto" value="auto"/>
    </v-radio-group>
    <p class="text-caption mb-2">
      This is your setting, for everything of yours. A graph can answer for itself in its properties, and what the graph says wins.
      <span v-if="graphAutonomy">This graph says <b>{{ graphAutonomy }}</b>.</span>
    </p>
    <v-divider class="my-2"/>
    <v-text-field v-model="form.agentSub" density="compact" label="Agent subject (the token's sub, e.g. abc123@clients)" hide-details class="mb-2"/>
    <v-text-field v-model="form.graphId" density="compact" label="Graph id, or * for every graph" hide-details class="mb-2"/>
    <div class="d-flex flex-wrap">
      <v-checkbox v-for="s in scopeOptions" :key="s" v-model="form.scopes" :value="s" :label="s" density="compact" hide-details class="mr-3"/>
    </div>
    <v-text-field v-model.number="form.days" density="compact" type="number" label="Expires in days (blank = never)" hide-details class="mb-2"/>
    <v-btn size="small" color="primary" :loading="busy" @click="save" prepend-icon="mdi-robot">Delegate</v-btn>
  </div>
</template>
<script lang="ts">
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
export default {
  name: "agent-settings",
  data() {
    return {
      busy: false,
      message: "",
      messageType: "info" as "info" | "warning" | "error" | "success",
      delegations: [] as any[],
      autonomy: "supervised" as string,
      graphAutonomy: "" as string,
      // what an agent can be given; commit is what lets it act without asking,
      // and only in auto mode
      scopeOptions: ["graph:read", "graph:inspect-internals", "graph:observe", "graph:propose", "graph:commit", "graph:test", "graph:execute", "registry:read"],
      form: { agentSub: "", graphId: "*", scopes: ["graph:read", "graph:propose", "graph:observe"], days: null as number | null },
    };
  },
  mounted() {
    this.refresh();
  },
  methods: {
    provider(): any {
      const orchestrator = useOrchestratorStore() as any;
      return (orchestrator.syncProviders || []).find((p: any) => typeof p.listDelegations === "function") || null;
    },
    say(text: string, type: "info" | "warning" | "error" | "success" = "info") {
      this.message = text;
      this.messageType = type;
    },
    async saveAutonomy(value: string) {
      const provider = this.provider();
      if (!provider || typeof provider.setAutonomy !== "function") {
        return;
      }
      this.busy = true;
      try {
        await provider.setAutonomy(value);
        this.say(value === "auto"
          ? "Agents you delegated commit to now act without asking. The tests and journeys still decide what may be published or run."
          : "You will be asked before an agent's work takes effect.", "success");
      } catch (err: any) {
        this.say(`Cannot change this: ${err.message}`, "error");
        await this.refresh();
      } finally {
        this.busy = false;
      }
    },
    async refresh() {
      const provider = this.provider();
      if (!provider) {
        return;
      }
      try {
        if (typeof provider.autonomy === "function") {
          const r = await provider.autonomy();
          this.autonomy = (r && r.autonomy) || "supervised";
        }
        const graph: any = (useOrchestratorStore() as any).graphStore && (useOrchestratorStore() as any).graphStore.graph;
        this.graphAutonomy = (graph && graph.properties && graph.properties.autonomy) || "";
      } catch (err) {
        // the panel still works without it
      }
      try {
        const r = await provider.listDelegations();
        this.delegations = r.delegations || [];
      } catch (err: any) {
        this.say(`Cannot list agents: ${err.message}`, "error");
      }
    },
    async save() {
      const provider = this.provider();
      if (!provider || !this.form.agentSub.trim()) {
        return;
      }
      this.busy = true;
      try {
        const expiresAt = this.form.days ? new Date(Date.now() + this.form.days * 86400000).toISOString() : null;
        await provider.putDelegation(this.form.agentSub.trim(), this.form.graphId.trim() || "*", { scopes: this.form.scopes, expiresAt });
        this.say(`Delegated ${this.form.agentSub.trim()}.`, "success");
        await this.refresh();
      } catch (err: any) {
        this.say(`Cannot delegate: ${err.message}`, "error");
      } finally {
        this.busy = false;
      }
    },
    async remove(d: any) {
      const provider = this.provider();
      if (!provider) {
        return;
      }
      try {
        await provider.deleteDelegation(d.agentSub, d.graphId);
        await this.refresh();
      } catch (err: any) {
        this.say(`Cannot remove: ${err.message}`, "error");
      }
    },
  },
};
</script>
