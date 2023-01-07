<template>
  <v-expansion-panels class="ma-0 pa-0" flat v-model="panel">
      <v-expansion-panel v-for="(plugin, index) in settingsPanels">
          <v-expansion-panel-title>{{plugin.title}}</v-expansion-panel-title>
          <v-expansion-panel-text>
            <component :is="plugin.component" v-bind="plugin.props" v-model="preferences"/>
          </v-expansion-panel-text>
      </v-expansion-panel>
  </v-expansion-panels>
</template>
<script lang="ts">
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";

import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
import {mapWritableState, mapActions, mapState} from "pinia";

export default {
    name: "settings-panel",
    methods: {
        ...mapActions(useOrchestratorStore, [
          'getPluginsByType',
        ]),
    },
    data() {
        return {
            panel: 0,
        };
    },
    computed: {
        ...mapWritableState(usePreferencesStore, [
            "preferences",
        ]),
        settingsPanels() {
          return this.getPluginsByType('settings-panel');
        }
    },
};
</script>
<style></style>
