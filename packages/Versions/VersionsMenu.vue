<template>
  <v-menu v-if="serverMode" v-model="open" :close-on-content-click="false" location="top">
    <template v-slot:activator="{props}">
      <v-icon help-topic="versions" icon="mdi-tag-multiple" v-bind="props" class="ma-2" :title="activatorTitle"/>
    </template>
    <v-card width="420" @click.stop @mousemove.stop>
      <v-card-title class="d-flex align-center">
        Versions
        <v-spacer/>
        <v-chip v-if="current" size="small" color="primary" variant="tonal">now: v{{ current.seq }}{{ current.label ? ' ' + current.label : '' }}</v-chip>
      </v-card-title>
      <v-card-text>
        <div class="d-flex align-center mb-2">
          <v-text-field v-model="label" density="compact" hide-details variant="outlined" placeholder="Name this version" @keyup.enter="save" :disabled="busy"/>
          <v-btn class="ml-2" size="small" color="primary" :loading="busy" @click="save" prepend-icon="mdi-tag-plus">Save</v-btn>
        </div>
        <v-alert v-if="message" density="compact" :type="messageType" variant="tonal" class="mb-2" closable @click:close="message = ''">{{ message }}</v-alert>
        <v-alert v-if="inRewindMode" density="compact" type="info" variant="tonal" class="mb-2">
          Previewing a version. <a href="#" @click.prevent="leavePreview">Back to live</a>
        </v-alert>
        <v-list density="compact" max-height="45vh" style="overflow-y: auto">
          <v-list-item v-for="r in revisionsNewestFirst" :key="r.revisionId" :title="'v' + r.seq + (r.label ? ' ' + r.label : '')" :subtitle="subtitleFor(r)">
            <template v-slot:prepend>
              <v-icon :color="isActive(r) ? 'success' : undefined">{{ isActive(r) ? 'mdi-play-circle' : 'mdi-tag-outline' }}</v-icon>
            </template>
            <template v-slot:append>
              <v-btn icon="mdi-eye-outline" size="x-small" variant="text" title="Preview" @click="preview(r)"/>
              <v-btn icon="mdi-restore" size="x-small" variant="text" title="Restore into the live graph" @click="restore(r)"/>
              <v-btn icon="mdi-rocket-launch-outline" size="x-small" variant="text" :disabled="isActive(r)" :title="isActive(r) ? 'This version is what runs' : 'Run this version'" @click="activate(r)"/>
            </template>
          </v-list-item>
          <v-list-item v-if="!revisions.length" title="No versions yet" subtitle="Save one to name the graph as it stands"/>
        </v-list>
      </v-card-text>
    </v-card>
  </v-menu>
</template>
<script lang="ts">
import {mapState, mapActions} from "pinia";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
export default {
  name: "versions-menu",
  data() {
    return {
      open: false,
      busy: false,
      label: "",
      message: "",
      messageType: "info" as "info" | "warning" | "error" | "success",
      revisions: [] as any[],
      head: null as any,
      active: null as any,
      current: null as any,
    };
  },
  watch: {
    open(isOpen: boolean) {
      if (isOpen) {
        this.refresh();
      }
    },
  },
  computed: {
    ...mapState(useGraphStore, ["inRewindMode", "graphLoaded"]),
    serverMode(): boolean {
      const prefs = (usePreferencesStore() as any).preferences;
      return !!prefs && !prefs.useLocalStorage;
    },
    revisionsNewestFirst(): any[] {
      return [...(this as any).revisions].sort((a: any, b: any) => b.seq - a.seq);
    },
    activatorTitle(): string {
      const c = (this as any).current;
      return c ? `Version ${c.seq}${c.label ? ": " + c.label : ""}` : "Versions";
    },
  },
  methods: {
    ...mapActions(useGraphStore, ["listVersions", "saveVersion", "previewVersion", "restoreVersion", "activateVersion", "exitRewind", "currentVersion"]),
    isActive(r: any): boolean {
      return !!((this as any).active && (this as any).active.revisionId === r.revisionId);
    },
    subtitleFor(r: any): string {
      const when = r.at ? new Date(r.at).toLocaleString() : "";
      const by = r.createdBy && r.createdBy.sub ? r.createdBy.sub.split("|").pop() : "";
      const what = r.diffFromParent ? ` · ${r.diffFromParent}` : "";
      return `${when}${by ? " · " + by : ""} · ${r.counts ? r.counts.nodes + " nodes" : ""}${what}`;
    },
    async refresh() {
      try {
        const result = await (this as any).listVersions();
        this.revisions = result.revisions || [];
        this.head = result.head || null;
        this.active = result.active || null;
        this.current = (this as any).currentVersion();
      } catch (err: any) {
        this.say(`Cannot list versions: ${err.message}`, "error");
      }
    },
    say(text: string, type: "info" | "warning" | "error" | "success" = "info") {
      this.message = text;
      this.messageType = type;
    },
    async save() {
      this.busy = true;
      try {
        const result = await (this as any).saveVersion(this.label);
        if (result && result.revision) {
          this.say(result.created ? `Saved version ${result.revision.seq}.` : `Nothing changed since version ${result.revision.seq}.`, result.created ? "success" : "info");
          this.label = "";
        }
        await this.refresh();
      } catch (err: any) {
        this.say(`Cannot save a version: ${err.message}`, "error");
      } finally {
        this.busy = false;
      }
    },
    async preview(r: any) {
      try {
        await (this as any).previewVersion(r);
        this.say(`Previewing version ${r.seq}; the live graph is unchanged.`);
      } catch (err: any) {
        this.say(`Cannot preview: ${err.message}`, "error");
      }
    },
    async leavePreview() {
      await (this as any).exitRewind();
      this.message = "";
    },
    async restore(r: any) {
      this.busy = true;
      try {
        const result = await (this as any).restoreVersion(r);
        if (result && result.decision === "accepted") {
          this.say(result.reason && /already/.test(result.reason) ? result.reason : `Restored version ${r.seq} into the live graph.`, "success");
        } else if (result) {
          this.say(`Restore refused: ${result.code} ${result.reason || ""}`, "error");
        }
        await this.refresh();
      } catch (err: any) {
        this.say(`Cannot restore: ${err.message}`, "error");
      } finally {
        this.busy = false;
      }
    },
    async activate(r: any) {
      this.busy = true;
      try {
        await (this as any).activateVersion(r);
        this.say(`Version ${r.seq} is now what the server runs.`, "success");
        await this.refresh();
      } catch (err: any) {
        this.say(`Cannot activate: ${err.message}`, "error");
      } finally {
        this.busy = false;
      }
    },
  },
};
</script>
