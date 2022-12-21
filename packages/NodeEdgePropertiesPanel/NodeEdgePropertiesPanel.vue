<template>
    <div v-if="node">
        <v-tabs v-model="inputsTabs">
            <v-tab v-for="ioKey in ['inputs', 'outputs']" :key="ioKey">
                {{ioKey}}
            </v-tab>
        </v-tabs>
        <v-window v-model="inputsTabs">
            <v-window-item v-for="ioKey in ['inputs', 'outputs']" :key="ioKey">
                <v-btn
                    class="ma-5"
                    @click.stop="add(ioKey)"
                     :disabled="controlsDisabled"
                    color="info"
                    fab
                    x-small
                    absolute
                    left
                >
                    Add {{ioKey.substring(0, ioKey.length - 1)}}<v-icon>mdi-plus-circle-outline</v-icon>
                </v-btn>
                <v-expansion-panels>
                    <v-expansion-panel v-for="(io, index) in node.properties[ioKey]" :key="index">
                        <v-expansion-panel-title :help-topic="ioKey">
                            <v-icon :disabled="controlsDisabled" @click.stop="remove(ioKey, io)">mdi-delete</v-icon>
                            <v-text-field
                                @click.stop
                                :disabled="controlsDisabled"
                                v-model="io.name"
                                :help-topic="ioKey + '-name'">
                            </v-text-field>
                            <template v-slot:actions="{ expanded }">
                                <v-icon
                                    :disabled="index === 0 || controlsDisabled"
                                    @click.stop="moveUp(ioKey, io)">mdi-arrow-up-bold-box-outline</v-icon>
                                <v-icon
                                    :disabled="index === node.properties[ioKey].length - 1 || controlsDisabled"
                                    @click.stop="moveDown(ioKey, io)">mdi-arrow-down-bold-box-outline</v-icon>
                                <v-icon :icon="expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'" style="margin-left: 10px;"></v-icon>
                            </template>
                        </v-expansion-panel-title>
                        <v-expansion-panel-text>
                            <v-combobox
                                :items="ioTypes"
                                :disabled="controlsDisabled"
                                v-model="io.type"
                                :help-topic="ioKey + '-type'"/>
                            <v-checkbox
                                v-if="!controlsDisabled"
                                v-model="io.external"
                                label="External"
                                :help-topic="ioKey + '-external'"/>
                            <v-card flat>
                                <v-list two-line subheader class="connector-info">
                                    <v-list-item
                                        v-for="(connectorInfo, index) in getConnectors(ioKey, io.name)"
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
                                    <v-card flat v-if="getConnectors(ioKey, io.name).length === 0">
                                        <v-card-text>
                                            <i>No Connectors</i>
                                        </v-card-text>
                                    </v-card>
                                </v-list>
                            </v-card>
                        </v-expansion-panel-text>
                    </v-expansion-panel>
                </v-expansion-panels>
            </v-window-item>
        </v-window>
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
    </div>
</template>
<script lang="typescript">
import {diff} from "deep-diff";
import {mapWritableState, mapActions, mapState} from "pinia";
import {useStore as useInputStore} from "@plastic-io/graph-editor-vue3-input";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
export default {
    name: "edge-properties",
    data() {
        return {
            node: null,
            override: false,
            showMessage: false,
            message: "",
            messageCallback: null,
            panels: [0],
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
            "hoveredConnector",
            "moveHistoryPosition",
            "changeConnectorOrder",
            "changeInputOrder",
            "changeOutputOrder",
            "updateNodeFields",
        ]),
        output(connector) {
            const field = this.node.properties.outputs.find((output) => {
                return connector.field === output.name;
            });
            const index = this.node.properties.outputs.indexOf(field);
            return {
                index,
                node: this.node,
                field
            };
        },
        input(connector) {
            const node = this.graphSnapshot.nodes.find((v) => {
                return v.id === connector.nodeId;
            });
            const field = node ? node.properties.inputs.find((input) => {
                return connector.field === input.name;
            }) : null;
            const index = node ? node.properties.inputs.indexOf(field) : null;
            return {
                index,
                node,
                field
            };
        },
        moveConnectorUp(connectorInfo) {
            this.changeConnectorOrder({
                nodeId: connectorInfo.node.id,
                connectorId: connectorInfo.connector.id,
                direction: "up",
            });
        },
        moveConnectorDown(connectorInfo) {
            this.changeConnectorOrder({
                nodeId: connectorInfo.node.id,
                connectorId: connectorInfo.connector.id,
                direction: "down",
            });
        },
        removeConnector(connectorInfo) {
            this.deleteConnector(connectorInfo.connector);
        },
        connectorSelect(connector) {
            this.selectConnector(connector);
        },
        connectorHover(connector) {
            this.hoveredConnector({
                node: this.node,
                connector,
                input: this.input(connector),
                output: this.output(connector),
            });
        },
        getConnectors(ioKey, name) {
            const connectors = [];
            if (ioKey === "inputs") {
                this.graphSnapshot.nodes.forEach((v) => {
                    v.edges.forEach((edge) => {
                        connectors.push(...edge.connectors.filter((c) => {
                            return c.nodeId === this.node.id && c.field === name;
                        }).map((connector) => {
                            return {
                                connector,
                                node: v,
                            };
                        }));
                    });
                });
            } else {
                connectors.push(...this.node.edges.find(e => e.field === name).connectors.map((connector) => {
                    return {
                        connector,
                        node: this.node,
                    };
                }));
            }
            return connectors;
        },
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
            const newName = isInput ? "new input" : "new output";
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
            const v = this.getSelectedNode();
            if (!v) {
                return;
            }
            this.node = JSON.parse(JSON.stringify(v));
        },
        getSelectedNode() {
            return this.graphSnapshot.nodes.find((v) => v.id === this.nodeId);
        },
    },
    watch: {
        graphSnapshot: {
            handler: function () {
                if (diff(this.getSelectedNode(), this.node)) {
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
        selectedNode: function () {
            if (!this.selectedNode) {
                return;
            }
            this.nodeId = this.selectedNode.id;
            this.setLocalNode();
        },
    },
    mounted() {
        if (this.selectedNode) {
            this.nodeId = this.selectedNode.id;
            this.setLocalNode();
        }
    },
    computed: {
        controlsDisabled() {
            return !!this.node.artifact;
        },
        ...mapWritableState(useGraphStore, [
            'ioTypes',
            'selectedNode',
            'graphSnapshot',
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
