<template>
  <v-alert
      v-if="error"
      color="error"
      :title="error.error.message.replace(/Error: Error:/g, 'Error:')"
      class="node-error"
      style="pointer-events: all;">
      <div style="text-align: right;">
          <i style="font-weight: bold;padding-left: 10px;"
             v-if="hasErrors">
              {{index + 1}} of {{errors.length}}
          </i>
          <div v-if="error.graphId">GraphId {{error.graphId}}</div>
      </div>
      <v-card>
          <v-card-text v-if="error.error.stack">
              <pre class="no-graph-target">{{error.error.stack}}</pre>
          </v-card-text>
          <v-card-subtitle>
            <div v-if="error.field">Field {{error.field}}</div>
          </v-card-subtitle>
      </v-card>
      <div>
        <v-btn v-if="hasErrors" class="ma-3" :disabled="index === 0" @click="index = Math.max(index - 1, 0)">
            Previous
        </v-btn>
        <v-btn
           v-if="hasErrors"
          class="ma-3"
          :disabled="index === errors.length - 1"
          @click="index = Math.min(index + 1, errors.length - 1)">
            Next
        </v-btn>
        <v-btn class="ma-3" @click="clearError(nodeId, error);">
            Dismiss
        </v-btn>
        <v-btn v-if="hasErrors" class="ma-3" @click="clearErrors(nodeId)">
            Dismiss All
        </v-btn>
      </div>
  </v-alert>
</template>
<script lang="ts">
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {mapWritableState, mapActions, mapState} from "pinia";
export default {
  name: 'node-error',
  props: {
    nodeId: String,
  },
  data() {
    return {
      index: 0,
    };
  },
  methods: {
    ...mapActions(useOrchestratorStore, [
      "clearErrors",
      "clearError",
    ]),
  },
  computed: {
    ...mapState(useOrchestratorStore, {
      "scheduler": "scheduler",
      "nodeErrors": "errors",
    }),
    hasErrors() {
      return this.errors.length > 1;
    },
    error: function () {
      return this.errors[this.index];
    },
    errors: function () {
      return this.nodeErrors[this.nodeId] || [];
    },
  }
}
</script>
<style>
  .node-error {
      position: absolute;
      left: 110%;
      top: 110%;
      width: 700px;
      overflow: scroll;
  }
</style>
