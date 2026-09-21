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
    ...mapState(useSyncStatusStore, ["pending", "rejected", "accepted", "connected"]),
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
      if ((this as any).rejected.length) return "mdi-cloud-alert";
      if ((this as any).pending.length) return "mdi-cloud-upload";
      return (this as any).connected ? "mdi-cloud-check" : "mdi-cloud-off-outline";
    },
    color(): string {
      if ((this as any).rejected.length) return "error";
      if ((this as any).pending.length) return "warning";
      return (this as any).connected ? "success" : "grey";
    },
    title(): string {
      if ((this as any).rejected.length) return `${(this as any).rejected.length} change(s) rejected by the server`;
      if ((this as any).pending.length) return `${(this as any).pending.length} change(s) waiting for the server`;
      return (this as any).connected ? "All changes accepted by the server" : "Not connected to the server";
    },
  },
  methods: {
    ...mapActions(useSyncStatusStore, ["dismissRejected"]),
  },
};
</script>
<style scoped>
.sync-count { margin-left: 4px; font-size: 11px; }
.sync-status-list { max-width: 420px; }
</style>
