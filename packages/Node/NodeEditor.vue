<template>
  <div>
    <div class="position-absolute no-graph-targe">
      <monaco-code-editor
          style="opacity: 0.98"
          v-if="showVueEditor"
          templateType="vue"
          language="html"
          :nodeId="nodeId"
          :graphId="graphSnapshot.id"
          :errors="errors.filter(e => e.type === 'vue')"
          :value="vueTemplateValue"
          helpLink="https://vuejs.org/guide/essentials/component-basics.html"
          @close="showVueEditor = false"
          @dirty="vueIsDirty = $event"
          @save="saveTemplate('vue', $event)"
      />
      <monaco-code-editor
          style="opacity: 0.98"
          v-if="showSetEditor"
          templateType="set"
          language="typescript"
          :nodeId="nodeId"
          :graphId="graphSnapshot.id"
          :errors="errors.filter(e => e.type === 'set')"
          :value="setTemplateValue"
          helpLink="https://plastic-io.github.io/plastic-io/interfaces/NodeInterface.html"
          @close="showSetEditor = false"
          @dirty="setIsDirty = $event"
          @save="saveTemplate('set', $event)"
      />
    </div>
    <div class="position-absolute no-graph-targe"
        style="top: -25px; width: 200px;">
        <div :style="{opacity: show ? 1 : 0}" @mouseover="hoveredLocally = true" @mouseout="hoveredLocally = false">
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
          <v-badge color="transparent">
            <v-icon @click="downloadNode" icon="mdi-download"/>
          </v-badge>
          <v-menu style="opacity: 0.98">
            <template v-slot:activator="{props}">
              <v-badge color="transparent">
                <v-icon icon="mdi-chart-sankey-variant" v-bind="props" class="mr-2"/>
              </v-badge>
            </template>
            <node-edge-properties-panel :nodeId="nodeId"/>
          </v-menu>
          <v-menu style="opacity: 0.98">
            <template v-slot:activator="{props}">
              <v-badge color="transparent">
                <v-icon icon="mdi-vector-polyline-edit" v-bind="props"/>
              </v-badge>
            </template>
            <node-properties-panel :nodeId="nodeId"/>
          </v-menu>
        </div>
    </div>
    <node-error :nodeId="nodeId"/>
  </div>
</template>
<script lang="ts">
  import {mapWritableState, mapActions, mapState} from "pinia";
  import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
  import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
  import { saveAs } from "file-saver";
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
        hoveredLocally: null,
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
      async downloadNode() {
        const fileName = `${this.node.properties.name || 'unnamed'}_${this.node.id}_v${this.node.version}`;
        const zip = new JSZip();
        const jsonString = JSON.stringify(this.node, null, 2);
        zip.file(fileName + '.json', jsonString);
        const zipBlob = await zip.generateAsync({ type: "blob" });
        saveAs(zipBlob, fileName + '.zip');
      },
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
        "locked": "locked",
      }),
      ...mapState(useGraphStore, [
        "graphSnapshot"
      ]),
      setTemplateValue() {
        return this.node.template.set;
      },
      vueTemplateValue() {
        return this.node.template.vue;
      },
      show() {
        if (this.locked) {
          return false;
        }
        return this.hoveredLocally
          || this.errors.length > 0
          || this.hovered
          || this.showVueEditor
          || this.showSetEditor
          || this.showError;
      },
      node() {
        if (!this.graphSnapshot) {
          return {template: {vue: '', set: ''}};
        }
        return this.graphSnapshot.nodes.find(n => n.id === this.nodeId);
      },
      errors() {
        return this.nodeErrors[this.nodeId] || [];
      },
    }
  }
</script>
