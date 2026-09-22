<template>
    <v-expansion-panels v-if="node" flat v-model="panel" style="overflow-y: auto; width: 300px;" @click.stop>
        <v-expansion-panel class="ma-0 pa-0">
            <v-expansion-panel-title>
                General
            </v-expansion-panel-title>
            <v-expansion-panel-text>
                <v-card class="ma-0 pa-0" flat>
                    <v-card-text class="ma-0 pa-0">
                    <v-alert
                        v-if="node.artifact && !node.properties.component"
                        type="info"
                        prominent
                        class="ma-0"
                    >
                        This node is linked from another graph.
                    </v-alert>
                    <v-alert
                        v-if="node.properties.component"
                        type="info"
                        variant="tonal"
                        class="ma-0 mb-2"
                    >
                        Component {{ node.properties.component.publishedId }} v{{ node.properties.component.version }}
                        <div v-if="newerVersion" class="mt-2">
                            v{{ newerVersion.version }} is published{{ newerVersion.label ? ': ' + newerVersion.label : '' }}.
                            <v-btn size="small" color="primary" class="ml-2" :loading="upgrading" @click="upgrade(newerVersion.version)" prepend-icon="mdi-arrow-up-bold">Upgrade</v-btn>
                        </div>
                        <div v-else-if="versionsChecked" class="mt-1"><small>This is the newest published version.</small></div>
                        <div v-if="upgradeMessage" class="mt-1"><small>{{ upgradeMessage }}</small></div>
                    </v-alert>
                    <v-btn
                        v-if="node.linkedGraph"
                        size="small"
                        variant="tonal"
                        class="ma-0 mb-2"
                        prepend-icon="mdi-magnify-expand"
                        :loading="looking"
                        @click="lookInsideThis"
                    >Look inside</v-btn>
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
                        <v-text-field label="Order" v-model.number="node.properties.presentation.order"></v-text-field>
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
        /**
         * Stand inside the call this node is (PB-115).  It is a place with an
         * address — the chain of hosts it was reached through — so it is a
         * route, which makes it linkable and survives a reload.
         */
        async lookInsideThis() {
            // the editor lives under a base path the preferences hold
            const pathPrefix = useOrchestratorStore().pathPrefix;
            this.looking = true;
            try {
                const here = this.graphStore.insideInstance;
                const path = (here ? here.path : []).concat([this.node.id]);
                await this.$router.push(`${pathPrefix}${here ? here.hostDocumentId : this.graphStore.graph.id}/inside/${path.join("/")}`);
            } finally {
                this.looking = false;
            }
        },
        ...mapActions(useGraphStore, [
            'updateNodeProperties',
            'updateNodeUrl',
        ]),
        ...mapActions(useOrchestratorStore, [
          'getPluginsByType',
        ]),
        ...mapActions(useGraphStore, [
            'componentVersions',
            'upgradeComponent',
        ]),
        ...mapActions(useOrchestratorStore, [
            'publishNode',
        ]),
        publish() {
            this.publishNode(this.node.id);
        },
        async checkVersions() {
            const pin = this.node && this.node.properties && this.node.properties.component;
            this.newerVersion = null;
            this.versionsChecked = false;
            if (!pin) {
                return;
            }
            try {
                const { versions } = await this.componentVersions(pin.publishedId);
                const newer = (versions || []).filter((v: any) => v.version > pin.version).sort((a: any, b: any) => b.version - a.version)[0];
                this.newerVersion = newer || null;
                this.versionsChecked = true;
            } catch (err: any) {
                this.upgradeMessage = 'Cannot check for newer versions: ' + (err && err.message);
            }
        },
        async upgrade(version: number) {
            this.upgrading = true;
            this.upgradeMessage = '';
            try {
                const result = await this.upgradeComponent(this.node.id, version);
                this.upgradeMessage = result && result.droppedEdges && result.droppedEdges.length
                    ? `Upgraded to v${version}; connections dropped on removed outputs: ${result.droppedEdges.join(', ')}`
                    : `Upgraded to v${version}.`;
                await this.checkVersions();
            } catch (err: any) {
                this.upgradeMessage = 'Cannot upgrade: ' + (err && err.message);
            } finally {
                this.upgrading = false;
            }
        },
    },
    data() {
        return {
            node: null as any,
            panel: null,
            updateTimer: 0 as any,
            updateTimeout: 1000,
            newerVersion: null as any,
            versionsChecked: false,
            upgrading: false,
            upgradeMessage: '',
            looking: false,
            graphStore: useGraphStore() as any,
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
        this.node = JSON.parse(JSON.stringify(this.graph.nodes.find((n: any) => n.id === this.nodeId)));
        this.checkVersions();
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
