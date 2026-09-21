<template>
  <v-menu v-if="serverMode" location="bottom">
    <template v-slot:activator="{ props }">
      <v-btn v-bind="props" size="small" variant="text" :color="color" :title="title" class="sync-status" density="compact">
        <v-icon size="small">{{ icon }}</v-icon>
        <span v-if="count" class="sync-count">{{ count }}</span>
      </v-btn>
    </template>
    <v-list density="compact" class="sync-status-list">
      <v-list-subheader>{{ title }}</v-list-subheader>
      <v-list-item v-for="m in rejected" :key="m.mutationId" :title="m.description" :subtitle="(m.code || 'rejected') + ': ' + (m.reason || '')" prepend-icon="mdi-cloud-alert" />
      <v-list-item v-for="m in pending" :key="m.mutationId" :title="m.description" subtitle="waiting for the server" prepend-icon="mdi-cloud-upload" />
      <v-list-item v-for="m in recentAccepted" :key="m.mutationId" :title="m.description" subtitle="accepted" prepend-icon="mdi-cloud-check" />
      <template v-if="quarantine">
        <v-divider />
        <v-list-subheader>Changes lost when the graph was reloaded</v-list-subheader>
        <v-list-item v-for="(d, i) in quarantine.descriptions" :key="'q' + i" :title="d" :subtitle="i === 0 ? quarantine.reason : 'built on the rejected change'" prepend-icon="mdi-file-alert-outline" />
        <v-list-item title="Download the graph as it was (JSON)" prepend-icon="mdi-download" @click="downloadQuarantine" />
        <v-list-item title="Discard" prepend-icon="mdi-delete-outline" @click="setQuarantine(null)" />
      </template>
      <v-list-item v-if="rejected.length" title="Dismiss rejected" prepend-icon="mdi-close" @click="dismissRejected" />
    </v-list>
  </v-menu>
</template>
<script lang="ts">
import { mapState, mapActions } from "pinia";
import { useStore as useSyncStatusStore } from "./store";
import { useStore as usePreferencesStore } from "@plastic-io/graph-editor-vue3-preferences-provider";
export default {
  name: "sync-status",
  computed: {
    ...mapState(useSyncStatusStore, ["pending", "rejected", "accepted", "connected", "quarantine"]),
    serverMode(): boolean {
      const prefs = (usePreferencesStore() as any).preferences;
      return !!prefs && !prefs.useLocalStorage;
    },
    recentAccepted(): any[] {
      return [...(this as any).accepted].sort((a: any, b: any) => b.at - a.at).slice(0, 5);
    },
    count(): number {
      return (this as any).rejected.length || (this as any).pending.length || 0;
    },
    icon(): string {
      if ((this as any).rejected.length || (this as any).quarantine) return "mdi-cloud-alert";
      if ((this as any).pending.length) return "mdi-cloud-upload";
      return (this as any).connected ? "mdi-cloud-check" : "mdi-cloud-off-outline";
    },
    color(): string {
      if ((this as any).rejected.length || (this as any).quarantine) return "error";
      if ((this as any).pending.length) return "warning";
      return (this as any).connected ? "success" : "grey";
    },
    title(): string {
      if ((this as any).rejected.length) return `${(this as any).rejected.length} change(s) rejected by the server`;
      if ((this as any).quarantine) return "The graph was reloaded from the server; some changes were lost";
      if ((this as any).pending.length) return `${(this as any).pending.length} change(s) waiting for the server`;
      return (this as any).connected ? "All changes accepted by the server" : "Not connected to the server";
    },
  },
  methods: {
    ...mapActions(useSyncStatusStore, ["dismissRejected", "setQuarantine"]),
    downloadQuarantine() {
      const q = (this as any).quarantine;
      if (!q) return;
      const blob = new Blob([JSON.stringify({ reason: q.reason, at: new Date(q.at).toISOString(), lostChanges: q.descriptions, graph: q.graph }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rejected-draft-${(q.graph && q.graph.id) || "graph"}-${q.at}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  },
};
</script>
<style scoped>
.sync-count { margin-left: 4px; font-size: 11px; }
.sync-status-list { max-width: 420px; }
</style>
