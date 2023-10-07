<template>
  <v-expansion-panels multiple @click.stop  flat v-model="panel" style="width: 400px;">
    <v-expansion-panel v-for="(ioKey, ioKeyIndex) in ['inputs', 'outputs']" :key="ioKey" class="pa-0 ma-0">
      <v-expansion-panel-title>
        {{ioKey}}
        <v-btn
          @click.stop="add(ioKey); panel = ioKeyIndex;"
           :disabled="controlsDisabled"
           class="ml-4"
           color="secondary"
           variant="tonal"
        >
          Add <v-icon class="ml-2">mdi-plus-circle-outline</v-icon>
        </v-btn>
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <keep-alive>
          <div>
            <v-expansion-panels>
              <v-expansion-panel v-for="(edge, index) in node.properties[ioKey]" :key="index">
                <v-expansion-panel-title :help-topic="ioKey" class="pa-0 ma-0">
                  <v-text-field
                    @click.stop
                    :disabled="controlsDisabled"
                    v-model="edge.name"
                    :help-topic="ioKey + '-name'">
                    <template v-slot:prepend>
                      <v-icon icon="mdi-delete" :disabled="controlsDisabled" @click.stop="remove(ioKey, edge)"/>
                    </template>
                    <template v-slot:append>
                      <v-icon
                        :disabled="index === 0 || controlsDisabled"
                        @click.stop="moveUp(ioKey, edge)">mdi-arrow-up-bold-box-outline</v-icon>
                      <v-icon
                        :disabled="index === node.properties[ioKey].length - 1 || controlsDisabled"
                        @click.stop="moveDown(ioKey, edge)">mdi-arrow-down-bold-box-outline</v-icon>
                    </template>
                  </v-text-field>
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-combobox
                    :items="ioTypes"
                    :disabled="controlsDisabled"
                    v-model="edge.type"
                    :help-topic="ioKey + '-type'"/>
                  <v-checkbox
                    :disabled="controlsDisabled"
                    v-model="edge.visible"
                    label="visible"
                    :help-topic="ioKey + '-visible'"/>
                  <v-checkbox
                    v-if="!controlsDisabled"
                    v-model="edge.external"
                    label="External"
                    :help-topic="ioKey + '-external'"/>
                  <connector-properties-panel :node="node" :edge="edge" :ioKey="ioKey"/>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </div>
        </keep-alive>
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
  <v-dialog absolute v-model="showMessage" max-width="290">
    <v-card>
      <v-card-title class="headline">Confirm</v-card-title>
      <v-card-text>
        {{message}}
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn @click="showMessage = false">Cancel</v-btn>
        <v-btn @click="messageClick">Delete</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
<script lang="typescript">
import {diff} from "deep-diff";
import {mapWritableState, mapActions, mapState} from "pinia";
import {useStore as useInputStore} from "@plastic-io/graph-editor-vue3-input";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
export default {
  name: "node-edge-properties-panel",
  props: {
    nodeId: String,
  },
  data() {
    return {
      node: null,
      override: false,
      showMessage: false,
      message: "",
      messageCallback: null,
      panel: null,
      inputsTabs: null
    };
  },
  methods: {
    ...mapActions(useGraphStore, [
      "removeInput",
      "removeOutput",
      "addInput",
      "addOutput",
      "deleteConnector",
      "selectConnector",
      "moveHistoryPosition",
      "changeConnectorOrder",
      "changeInputOrder",
      "changeOutputOrder",
      "updateNodeFields",
    ]),
    messageClick() {
      if (this.messageCallback) {
        this.messageCallback();
      }
    },
    moveUp(ioKey, io) {
      this[ioKey === "inputs" ? "changeInputOrder" : "changeOutputOrder"]({
        nodeId: this.node.id,
        name: io.name,
        direction: "up",
      });
    },
    moveDown(ioKey, io) {
      this[ioKey === "inputs" ? "changeInputOrder" : "changeOutputOrder"]({
        nodeId: this.node.id,
        name: io.name,
        direction: "down",
      });
    },
    add(ioKey) {
      // if a key with this name exists, don't do it
      const isInput = ioKey === "inputs";
      const newName = isInput ? "input" : "output";
      if (isInput && this.node.properties[ioKey].map(i => i.name).indexOf(newName) !== -1) {
        return;
      }
      if (!isInput && this.node.properties.outputs.map(i => i.name).indexOf(newName) !== -1) {
        return;
      }
      this[isInput ? "addInput" : "addOutput"]({
        nodeId: this.node.id,
        name: newName,
      });
      // HACK: this is just wrong. why?!
      this.$nextTick(() => {
        this.$forceUpdate();
      });
    },
    remove(ioKey, io, override) {
      // if there are connectors attached to edges, warn the user of the eventual removal of the connectors
      const isInput = ioKey === "inputs";
      if (isInput) {
        for (let x = 0; x < this.graphSnapshot.nodes.length; x += 1) {
          for (let y =0; y < this.graphSnapshot.nodes[x].edges.length; y += 1) {
            const connectors = this.graphSnapshot.nodes[x].edges[y].connectors.find(c => c.nodeId === this.node.id && c.field === io.name);
            if (!override && connectors) {
              this.showMessage = true;
              this.message = "There are connectors connected to this input.  Are you sure you want to delete it?";
              this.messageCallback = () => {
                this.showMessage = false;
                this.override = false;
                this.showMessage = false;
                this.remove(ioKey, io, true);
              };
              return;
            }
          }
        }
      } else {
        const edge = this.node.edges.find(e => e.field === io.name);
        if (!edge) {
          return;
        }
        if (edge.connectors.length > 0 && !override) {
          this.showMessage = true;
          this.message = "There are connectors connected to this output.  Are you sure you want to delete it?";
          this.messageCallback = () => {
            this.showMessage = false;
            this.override = false;
            this.showMessage = false;
            this.remove(ioKey, io, true);
          };
          return;
        }
      }
      this[isInput ? "removeInput" : "removeOutput"]({
        nodeId: this.node.id,
        name: io.name,
      });
    },
    setLocalNode() {
      const v = this.graph.nodes.find((n) => {
        return n.id === this.nodeId;
      });
      if (!v) {
        return;
      }
      this.node = JSON.parse(JSON.stringify(v));
    },
    getNode() {
      return JSON.parse(JSON.stringify(this.graphSnapshot.nodes.find((v) => v.id === this.nodeId)));
    },
  },
  watch: {
    graphSnapshot: {
      handler: function () {
        if (diff(this.getNode(), this.node)) {
          this.setLocalNode();
        }
      },
      deep: true,
    },
    "node.properties": {
      handler: function () {
        this["updateNodeFields"]({
          node: this.node,
        });
      },
      deep: true,
    },
  },
  mounted() {
    this.setLocalNode();
  },
  computed: {
    controlsDisabled() {
      return !!(this.node && this.node.artifact);
    },
    ...mapWritableState(useGraphStore, [
      'ioTypes',
      'graph',
      'graphSnapshot',
      'hoveredConnector',
    ]),
  },
};
</script>
<style>
  .io-title- {

  }
  .hide-arrows .v-slide-group__prev, .hide-arrows .v-slide-group__next {
    display: none!important;
  }
  .connector-info {
    max-height: 300px;
    overflow-y: auto;
    overflow-x: visible;
    padding-top: 10px;
    width: 240px;
  }
</style>
