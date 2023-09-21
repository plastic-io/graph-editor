<template>
  <v-alert
      v-if="error"
      color="error"
      :title="error.error.message"
      class="node-error"
      style="pointer-events: all;">
      <div style="text-align: right;">
          <i style="font-weight: bold;padding-left: 10px;"
             v-if="hasErrors">
              {{index + 1}} of {{errors.length}}
          </i>
      </div>
      <v-card>
          <v-card-text>
              <pre class="no-graph-target">{{error.error.stack}}</pre>
          </v-card-text>
          <v-card-subtitle>
            Field {{error.field}}<br/>
            GraphId {{error.graphId}}
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
      width: 1200px;
      overflow: scroll;
  }
</style>
