<template>
  <v-list two-line subheader class="connector-info">
    <v-list-item
      v-for="(connectorInfo, index) in getConnectors(ioKey, edge.name)"
      @mouseover="connectorHover(connectorInfo.connector);"
      @click="connectorSelect(connectorInfo.connector);"
      :title="`Field: ${connectorInfo.connector.field}\nNode Id: ${connectorInfo.connector.nodeId}\nConnector Id: ${connectorInfo.connector.id}\nGraph Id: ${connectorInfo.connector.graphId}\nVersion: ${connectorInfo.connector.version}`"
      :key="index">
      <template v-slot:prepend>
        <v-avatar style="overflow: visible;">
          <v-icon>mdi-transit-connection</v-icon>
        </v-avatar>
      </template>
      {{connectorInfo.connector.field}}
      <v-avatar style="overflow: visible;">
        <table style="transform: scale(0.70) translate(5px, -20%); padding-top: 50px;"  help-topic="connectorOrder">
          <tr>
            <td>
              <v-icon
                :disabled="index === 0 || controlsDisabled"
                @click="moveConnectorUp(connectorInfo)">mdi-arrow-up-bold-box-outline</v-icon>
            </td>
          </tr>
          <tr>
            <td>
              <v-icon
                :disabled="index === node.properties[ioKey].length - 1 || controlsDisabled"
                @click="moveConnectorDown(connectorInfo)">mdi-arrow-down-bold-box-outline</v-icon>
            </td>
          </tr>
          <tr>
            <td>
              <v-icon :disabled="controlsDisabled" @click="removeConnector(connectorInfo)">mdi-delete</v-icon>
            </td>
          </tr>
        </table>
      </v-avatar>
    </v-list-item>
    <v-card flat v-if="getConnectors(ioKey, edge.name).length === 0">
      <v-card-text>
        <i>No Connectors</i>
      </v-card-text>
    </v-card>
  </v-list>
</template>
<script lang="ts">
import {mapWritableState, mapActions, mapState} from "pinia";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
export default {
  name: 'connector-properties-panel',
  props: {
    edge: {type: Object, required: true},
    node: {type: Object, required: true},
    ioKey: String,
  },
  methods: {
    ...mapActions(useGraphStore, [
      "deleteConnector",
      "selectConnector",
      "changeConnectorOrder",
    ]),
    output(connector: any) {
      const field = this.node.properties.outputs.find((output: any) => {
        return connector.field === output.name;
      });
      const index = this.node.properties.outputs.indexOf(field);
      return {
        index,
        node: this.node,
        field
      };
    },
    input(connector: any) {
      const node = this.graphSnapshot.nodes.find((v: any) => {
        return v.id === connector.nodeId;
      });
      const field = node ? node.properties.inputs.find((input: any) => {
        return connector.field === input.name;
      }) : null;
      const index = node ? node.properties.inputs.indexOf(field) : null;
      return {
        index,
        node,
        field
      };
    },
    moveConnectorUp(connectorInfo: any) {
      this.changeConnectorOrder({
        nodeId: connectorInfo.node.id,
        connectorId: connectorInfo.connector.id,
        direction: "up",
      });
    },
    moveConnectorDown(connectorInfo: any) {
      this.changeConnectorOrder({
        nodeId: connectorInfo.node.id,
        connectorId: connectorInfo.connector.id,
        direction: "down",
      });
    },
    removeConnector(connectorInfo: any) {
      this.deleteConnector(connectorInfo.connector);
    },
    connectorSelect(connector: any) {
      this.selectConnector(connector);
    },
    connectorHover(connector: any) {
      this.hoveredConnector = {
        node: this.node,
        connector,
        input: this.input(connector),
        output: this.output(connector),
      };
    },
    getConnectors(ioKey: any, name: any) {
      const connectors = [];
      if (ioKey === "inputs") {
        this.graphSnapshot.nodes.forEach((v: any) => {
          v.edges.forEach((edge: any) => {
            connectors.push(...edge.connectors.filter((c: any) => {
              return c.nodeId === this.node.id && c.field === name;
            }).map((connector: any) => {
              return {
                connector,
                node: v,
              };
            }));
          });
        });
      } else {
        connectors.push(...this.node.edges.find((e: any) => e.field === name).connectors.map((connector: any) => {
          return {
            connector,
            node: this.node,
          };
        }));
      }
      return connectors;
    },
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
}
</script>