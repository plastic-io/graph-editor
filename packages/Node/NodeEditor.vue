<template>
  <div>
    <div class="position-absolute no-graph-targe">
      <keep-alive>
        <monaco-code-editor
            v-if="showVueEditor"
            templateType="vue"
            language="html"
            :nodeId="nodeId"
            :graphUrl="graph.url"
            :errors="errors.filter(e => e.type === 'vue')"
            :value="node.template.vue"
            helpLink="https://vuejs.org/guide/essentials/component-basics.html"
            @close="showVueEditor = false"
            @dirty="vueIsDirty = $event"
            @save="saveTemplate('vue', $event)"
        />
      </keep-alive>
      <keep-alive>
        <monaco-code-editor
            v-if="showSetEditor"
            templateType="set"
            language="typescript"
            :nodeId="nodeId"
            :graphUrl="graph.url"
            :errors="errors.filter(e => e.type === 'set')"
            :value="node.template.set"
            helpLink="https://plastic-io.github.io/plastic-io/interfaces/NodeInterface.html"
            @close="showSetEditor = false"
            @dirty="setIsDirty = $event"
            @save="saveTemplate('set', $event)"
        />
      </keep-alive>
    </div>
    <div class="position-absolute no-graph-targe"
        style="top: -25px; width: 75px;">
        <div v-show="errors.length > 0 || hovered || showVueEditor || showSetEditor">
          <v-badge :color="vueIsDirty ? 'warning' : 'transparent'" dot>
            <v-icon
                :color="showVueEditor ? 'secondary' : ''"
                icon="mdi-vuejs"
                @click="showVueEditor = !showVueEditor"/>
          </v-badge>
          <v-badge :color="setIsDirty ? 'warning' : 'transparent'" dot>
            <v-icon
                :color="showSetEditor ? 'secondary' : ''"
                icon="mdi-lambda"
                @click="showSetEditor = !showSetEditor"/>
          </v-badge>
          <v-badge v-if="errors.length > 0" color="red" :content="errors.length">
            <v-icon
                @click="showError = !showError"
                color="warning"
                icon="mdi-alert-circle-outline"/>
          </v-badge>
        </div>
    </div>
    <node-error :nodeId="nodeId"/>
  </div>
</template>
<script>
  import {mapWritableState, mapActions, mapState} from "pinia";
  import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
  import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
  import NodeError from "./NodeError.vue";
  export default {
    name: 'node-editor',
    components: {NodeError},
    props: {
      hovered: Boolean,
      nodeId: String,
    },
    data() {
      return {
        localNode: null,
        showVueEditor: false,
        showSetEditor: false,
        showError: false,
        vueIsDirty: false,
        setIsDirty: false,
      };
    },
    methods: {
      ...mapActions(useGraphStore, ['updateNodeTemplate']),
      ...mapActions(useOrchestratorStore, ['clearErrors']),
      saveTemplate(type, value) {
        this.clearErrors(this.nodeId, type);
        this.updateNodeTemplate({
          nodeId: this.nodeId,
          type,
          value,
        });
      }
    },
    computed: {
      ...mapState(useOrchestratorStore, {
        "nodeErrors": "errors",
      }),
      ...mapState(useGraphStore, [
        "graph"
      ]),
      node() {
        if (!this.graph) {
          return {template: {vue: '', set: ''}};
        }
        return this.graph.nodes.find(n => n.id === this.nodeId);
      },
      errors() {
        return this.nodeErrors[this.nodeId] || [];
      },
    }
  }
</script>
