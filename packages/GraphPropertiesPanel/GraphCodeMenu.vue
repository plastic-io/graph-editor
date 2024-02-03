<template>
  <v-icon
    title="Edit Graph Presentation Code"
    @click="showGraphCodeEditor = !showGraphCodeEditor"
    help-topic="toggleShowGraphCode"
    :color="showGraphCodeEditor ? 'info' : ''"
    class="mx-2"
    style="cursor: pointer;"
    >mdi-vuejs</v-icon>
</template>
<script lang="ts">
  import {mapWritableState, mapActions, mapState} from "pinia";
  import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";

  export default {
    name: 'graph-properties-menu',
    computed: {
      ...mapWritableState(useGraphStore, [
          'showGraphCodeEditor',
      ]),
    }
  }
</script>
