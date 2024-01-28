<template>
    <v-expansion-panels v-if="node" flat v-model="panel" style="overflow-y: auto; width: 300px;" @click.stop>
        <v-expansion-panel class="ma-0 pa-0">
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
                    >
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
                            v-model="node.url"/>
                        <v-text-field
                            disabled
                            help-topic="nodeId"
                            label="ID"
                            v-model="node.id"/>
                        <v-text-field
                            disabled
                            help-topic="nodeIcon"
                            label="Icon"
                            persistent-hint
                            hint="https://cdn.materialdesignicons.com/4.9.95/"
                            v-model="node.properties.icon"/>
                        <v-checkbox
                            help-topic="nodeAppearsInExportedGraph"
                            label="Appears In Exported Graph"
                            v-model="node.properties.appearsInExportedGraph"/>
                    </v-card-text>
                </v-card>
            </v-expansion-panel-text>
        </v-expansion-panel>
        <v-expansion-panel class="ma-0 pa-0">
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
        <v-expansion-panel class="ma-0 pa-0">
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
        <v-expansion-panel class="ma-0 pa-0">
            <v-expansion-panel-title>Node Data</v-expansion-panel-title>
            <v-expansion-panel-text>
                <v-card class="ma-0 pa-0" flat>
                    <v-card-text class="ma-0 pa-0" help-topic="nodeData">
                        <v-textarea label="Data" v-model="node.data"></v-textarea>
                    </v-card-text>
                </v-card>
            </v-expansion-panel-text>
        </v-expansion-panel>
        <v-expansion-panel class="ma-0 pa-0">
            <v-expansion-panel-title>Node Scripts</v-expansion-panel-title>
            <v-expansion-panel-text>
                <v-card class="ma-0 pa-0" flat>
                    <v-card-text class="ma-0 pa-0" help-topic="nodeScripts">
                        <v-textarea label="Scripts" v-model="node.properties.scripts"></v-textarea>
                    </v-card-text>
                </v-card>
            </v-expansion-panel-text>
        </v-expansion-panel>
    </v-expansion-panels>
</template>
<script lang="ts">
import {useStore as useInputStore} from "@plastic-io/graph-editor-vue3-input";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {deref} from "@plastic-io/graph-editor-vue3-utils";
import {mapWritableState, mapActions, mapState} from "pinia";
export default {
    name: "node-properties-panel",
    props: {
        nodeId: String,
    },
    methods: {
        ...mapActions(useGraphStore, [
            'updateNodeProperties',
            'updateNodeUrl',
        ]),
        ...mapActions(useOrchestratorStore, [
          'getPluginsByType',
        ]),
        publish() {
            this.publishNode(this.node.id);
        },
    },
    data() {
        return {
            node: null,
            panel: null,
            updateTimer: 0,
            updateTimeout: 1000,
        };
    },
    watch: {
        "node.url": {
            handler: function () {
                clearTimeout(this.updateTimer);
                this.updateTimer = setTimeout(() => {
                    this.updateNodeUrl({
                        nodeId: this.node.id,
                        url: this.node.url,
                    });
                }, this.updateTimeout);
            },
            deep: true,
        },
        "node.properties": {
            handler: function () {
                clearTimeout(this.updateTimer);
                this.updateTimer = setTimeout(() => {
                    this.updateNodeProperties({
                        nodeId: this.node.id,
                        properties: deref(this.node.properties),
                        version: this.graph.version,
                    });
                }, this.updateTimeout);
            },
            deep: true,
        },
    },
    mounted() {
        this.node = JSON.parse(JSON.stringify(this.graph.nodes.find(n => n.id === this.nodeId)));
    },
    computed: {
        ...mapState(useGraphStore, [
          'tags',
        ]),
        ...mapState(useGraphStore, [
          'graph',
        ]),
    }
};
</script>
<style></style>
