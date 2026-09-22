<template>
  <div class="shared-mouse-layer" v-if="visible">
    <div
      v-for="cursor in cursors"
      :key="cursor.key"
      class="shared-mouse"
      :style="cursor.style"
    >
      <svg width="16" height="20" viewBox="0 0 16 20" aria-hidden="true">
        <path
          d="M1 1 L1 15 L5 11.5 L7.5 17.5 L10 16.5 L7.5 10.5 L13 10.5 Z"
          :fill="cursor.color"
          stroke="#00000066"
          stroke-width="1"
        />
      </svg>
      <span class="shared-mouse-name" :style="{background: cursor.color}">{{cursor.name}}</span>
    </div>
  </div>
</template>
<script lang="ts">
import {mapState} from "pinia";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
export default {
  name: "shared-mouse",
  computed: {
    ...mapState(useGraphStore, ["view", "presentation"]),
    ...mapState(useOrchestratorStore, ["graphUserMouse"]),
    ...mapState(usePreferencesStore, ["preferences"]),
    visible(): boolean {
      return !this.presentation
        && this.preferences
        && this.preferences.showRemoteMouseMovements
        && this.cursors.length > 0;
    },
    cursors(): any[] {
      const pointers: Record<string, any> = this.graphUserMouse || {};
      return Object.keys(pointers).map((key) => {
        const pointer = pointers[key];
        const user = pointer.user || {};
        return {
          key,
          name: user.name || "Someone",
          color: user.color || "#888888",
          // Pointers arrive in graph coordinates, so they land in the right
          // place no matter how each person has panned or zoomed.
          style: {
            transform: `translate(${(pointer.x * this.view.k) + this.view.x}px, `
              + `${(pointer.y * this.view.k) + this.view.y}px)`,
          },
        };
      });
    },
  },
}
</script>
<style scoped>
.shared-mouse-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 3;
}
.shared-mouse {
  position: absolute;
  top: 0;
  left: 0;
  will-change: transform;
  transition: transform 90ms linear;
  display: flex;
  align-items: flex-start;
}
.shared-mouse-name {
  margin-left: 2px;
  margin-top: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 11px;
  line-height: 15px;
  color: #fff;
  white-space: nowrap;
  box-shadow: 0 1px 2px #00000055;
}
</style>
