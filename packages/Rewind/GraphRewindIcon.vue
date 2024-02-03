<template>
  <v-icon help-topic="rewind" icon="mdi-vhs" @click="inRewindMode = !inRewindMode" class="ma-2" :color="inRewindMode ? 'info' : ''" title="Graph Rewind"/>
  <graph-rewind v-if="inRewindMode"/>
</template>
<script lang="ts">
import {mapWritableState, mapActions} from "pinia";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
export default {
  computed: {
    ...mapWritableState(useGraphStore, ['inRewindMode']),
  },
}
</script>
<style></style>