<template>
    <v-card flat v-if="node && selectedNode" style="overflow-y: auto;">
        <v-card-text class="ma-0 pa-0">
            <v-expansion-panels flat v-model="panel">
                <v-expansion-panel>
                    <v-expansion-panel-title>
                        General
                        <v-spacer/>
                        <v-tooltip flat bottom color="secondary" open-on-hover>
                            <template v-slot:activator="{ props }">
                                <v-icon v-bind="props">
                                    {{node.artifact ? 'mdi-link' : 'mdi-information-outline'}}
                                </v-icon>
                            </template>
                            <v-card v-if="!node.artifact">
                                <v-card-text>
                                    <i>Node Id: {{node.id}}</i>
                                </v-card-text>
                            </v-card>
                            <v-alert
                                v-if="node.artifact"
                                type="warning"
                                prominent
                                class="ma-0"
                                style="width: 35vw;"
                                border="left">
                                This node did not originate on this graph.
                                <i>Node artifact: {{node.artifact}}</i>
                            </v-alert>
                        </v-tooltip>
                    </v-expansion-panel-title>
                    <v-expansion-panel-text>
                        <v-card class="ma-0 pa-0" flat>
                            <v-card-text class="ma-0 pa-0">
                                <v-text-field
                                    help-topic="nodeName"
                                    label="Name"
                                    v-model="node.properties.name"/>
                                <v-textarea
                                    help-topic="nodeDescription"
                                    label="Description"
                                    v-model="node.properties.description"/>
                                <v-text-field
                                    help-topic="nodeUrl"
                                    label="URL"
                                    @change="updateNodeUrl($event)"
                                    v-model="node.url"/>
                                <v-text-field
                                    disabled
                                    help-topic="nodeId"
                                    label="ID"
                                    @change="updateNodeUrl($event)"
                                    v-model="node.id"/>
<!--                                 <v-combobox
                                    help-topic="nodeIcon"
                                    :prepend-icon="node.properties.icon"
                                    persistent-hint
                                    hint="https://cdn.materialdesignicons.com/4.9.95/"
                                    :eager="true"
                                    title="Icon"
                                    :items="icons"
                                    v-model="node.properties.icon"/>
                                <v-checkbox help-topic="nodeAppearsInExportedGraph" label="Appears In Exported Graph" v-model="node.properties.appearsInExportedGraph"/> -->
                            </v-card-text>
                        </v-card>
                    </v-expansion-panel-text>
                </v-expansion-panel>
                <v-expansion-panel>
                    <v-expansion-panel-title>Location</v-expansion-panel-title>
                    <v-expansion-panel-text>
                        <v-card class="ma-0 pa-0" flat>
                            <v-card-text class="ma-0 pa-0" help-topic="nodeLocation">
                                <v-text-field label="x" v-model.number="node.properties.x"></v-text-field>
                                <v-text-field label="y" v-model.number="node.properties.y"></v-text-field>
                                <v-text-field label="z" v-model.number="node.properties.z"></v-text-field>
                            </v-card-text>
                        </v-card>
                    </v-expansion-panel-text>
                </v-expansion-panel>
                <v-expansion-panel>
                    <v-expansion-panel-title>Presentation</v-expansion-panel-title>
                    <v-expansion-panel-text>
                        <v-card class="ma-0 pa-0" flat>
                            <v-card-text class="ma-0 pa-0" help-topic="nodePresentationLocation">
                                <v-checkbox label="Appears In Presentation" v-model="node.properties.appearsInPresentation"></v-checkbox>
                                <v-checkbox label="Position Absolutely" v-model="node.properties.positionAbsolute"></v-checkbox>
                                <v-text-field label="x" v-model.number="node.properties.presentation.x"></v-text-field>
                                <v-text-field label="y" v-model.number="node.properties.presentation.y"></v-text-field>
                                <v-text-field label="z" v-model.number="node.properties.presentation.z"></v-text-field>
                            </v-card-text>
                        </v-card>
                    </v-expansion-panel-text>
                </v-expansion-panel>
                <v-expansion-panel>
                    <v-expansion-panel-title>Node Data</v-expansion-panel-title>
                    <v-expansion-panel-text>
                        <v-card class="ma-0 pa-0" flat>
                            <v-card-text class="ma-0 pa-0" help-topic="nodeData">
                                <v-textarea label="Data" v-model="node.data"></v-textarea>
                            </v-card-text>
                        </v-card>
                    </v-expansion-panel-text>
                </v-expansion-panel>
                <v-expansion-panel v-if="!node.artifact">
                    <v-expansion-panel-title>Publishing</v-expansion-panel-title>
                    <v-expansion-panel-text>
                        <v-card class="ma-0 pa-0" flat>
                            <v-card-text class="ma-0 pa-3">
                                <v-btn color="info" @click="publish" help-topic="nodePublish">
                                    Publish<br>Node
                                    <v-icon right>
                                        mdi-share-variant
                                    </v-icon>
                                </v-btn>
                                <v-combobox
                                    help-topic="nodeTags"
                                    :items="tags"
                                    chips
                                    deletable-chips
                                    clearable
                                    multiple
                                    hide-selected
                                    label="Tags"
                                    persistent-hint
                                    hint="Which domains this resource works in"
                                    prepend-icon="mdi-tag-multiple-outline"
                                    v-model="node.properties.tags"/>
                            </v-card-text>
                        </v-card>
                    </v-expansion-panel-text>
                </v-expansion-panel>
                <v-expansion-panel v-if="!node.artifact">
                    <v-expansion-panel-title>Testing</v-expansion-panel-title>
                    <v-expansion-panel-text>
                        <v-card class="ma-0 pa-0" flat>
                            <v-card-text class="ma-0 pa-3">
                                <v-btn @click="runTest" color="info" block help-topic="nodeTests">
                                    Run Tests
                                    <v-icon right>
                                        mdi-flask
                                    </v-icon>
                                </v-btn>
                            </v-card-text>
                        </v-card>
                    </v-expansion-panel-text>
                </v-expansion-panel>
            </v-expansion-panels>
        </v-card-text>
    </v-card>
</template>
<script lang="ts">
import {useStore as useInputStore} from "@plastic-io/graph-editor-vue3-input";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";

import {mapWritableState, mapActions, mapState} from "pinia";

import * as mdi from "@mdi/js";

export default {
    name: "node-properties",
    methods: {
        hyphenateProperty(prop) {
            var p = "";
            Array.prototype.forEach.call(prop, function (char) {
                if (char === char.toUpperCase()) {
                    p += "-" + char.toLowerCase();
                    return;
                }
                p += char;
            });
            return p;
        },
        updateNodeUrl(e) {
            this.node.url = e;
        },
        publish() {
            this.publishNode(this.node.id);
        },
    },
    data() {
        return {
            node: null,
            panel: 0,
        };
    },
    watch: {
        "node.url": {
            handler: function () {
                // this.$store.commit("updateNodeUrl", {
                //     nodeId: this.node.id,
                //     url: this.node.url,
                // });
            },
            deep: true,
        },
        "node.properties": {
            handler: function () {
                // this.$store.dispatch("updateNodeProperties", {
                //     nodeId: this.node.id,
                //     properties: JSON.parse(JSON.stringify(this.node.properties)),
                //     version: this.graph.version,
                // });
            },
            deep: true,
        },
        selectedNode: function () {
            if (!this.selectedNode) {
                return;
            }
            this.node = JSON.parse(JSON.stringify(this.selectedNode));
        },
    },
    mounted() {
        if (!this.selectedNode) {
            return;
        }
        this.node = JSON.parse(JSON.stringify(this.selectedNode));
    },
    computed: {
        ...mapState(useGraphStore, [
          'tags',
        ]),
        ...mapState(useGraphStore, [
          'graph',
          'selectedNode',
          'selectedNodes',
        ]),
        icons() {
            return Object.keys(mdi).map(this.hyphenateProperty);
        },
    }
};
</script>
<style></style>
