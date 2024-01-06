<template>
    <v-expansion-panels flat v-model="panel" style="width: 300px;" class="ma-0 pa-0">
        <v-expansion-panel class="ma-0 pa-0">
            <v-expansion-panel-title>General</v-expansion-panel-title>
            <v-expansion-panel-text>
                <v-card class="ma-0 pa-0" flat>
                  <v-card-text class="ma-0 pa-0">
                        <v-text-field help-topic="graphName" label="Name" v-model="localGraph.properties.name"></v-text-field>
                        <v-text-field help-topic="graphDescription" label="Description" v-model="localGraph.properties.description"></v-text-field>
                        <v-text-field help-topic="graphUrl" label="URL" v-model="localGraph.url"></v-text-field>
                        <v-text-field help-topic="graphId" label="Graph Id" disabled v-model="localGraph.id"></v-text-field>
                        <v-text-field
                            help-topic="graphIcon"
                            persistent-hint
                            v-model="localGraph.properties.icon"
                            hint="https://cdn.materialdesignicons.com/4.9.95/"
                            title="Icon">
                            <template v-slot:prepend>
                                <v-icon :icon="localGraph.properties.icon || 'mdi-graph'"/>
                            </template>
                        </v-text-field>
                        <v-text-field help-topic="graphVersion" label="Version" disabled v-model="localGraph.version"></v-text-field>
                        <v-text-field help-topic="timeout" label="Timeout (ms)" v-model.number="localGraph.properties.timeout"></v-text-field>
                        <v-text-field help-topic="logLevel" label="Log Level (1-4)" v-model.number="localGraph.properties.logLevel"></v-text-field>
                    </v-card-text>
                </v-card>
            </v-expansion-panel-text>
        </v-expansion-panel>
        <v-expansion-panel class="ma-0 pa-0">
            <v-expansion-panel-title>Global Scripts</v-expansion-panel-title>
            <v-expansion-panel-text>
                <v-textarea persistent-hint hint="csv list of script sources that will be loaded before the graph loads" v-model="localGraph.properties.scripts" label="Graph Scripts" help-topic="graph-scripts" />
            </v-expansion-panel-text>
            </v-expansion-panel>
        <v-expansion-panel class="ma-0 pa-0">
            <v-expansion-panel-title>Presentation</v-expansion-panel-title>
            <v-expansion-panel-text>
                <v-card class="ma-0 pa-0" flat>
                    <v-card-text class="ma-0 pa-0" help-topic="graphPresentation">
                        <v-switch label="Start In Presentation Mode" v-model="localGraph.properties.startInPresentationMode"></v-switch>
                        <v-text-field label="Height" v-model.number="localGraph.properties.height"></v-text-field>
                        <v-text-field label="Width" v-model.number="localGraph.properties.width"></v-text-field>
                    </v-card-text>
                </v-card>
            </v-expansion-panel-text>
        </v-expansion-panel>
        <v-expansion-panel class="ma-0 pa-0">
            <v-expansion-panel-title>Meta</v-expansion-panel-title>
            <v-expansion-panel-text>
                <v-card class="ma-0 pa-0" flat>
                    <v-card-text class="ma-0 pa-0" help-topic="graphMeta">
                        <v-text-field disabled label="Created By" v-model="localGraph.properties.createdBy"></v-text-field>
                        <v-text-field disabled label="Last Updated By" v-model="localGraph.properties.lastUpdatedBy"></v-text-field>
                        <v-text-field disabled label="Created" :value="localGraph.properties.createdOn"></v-text-field>
                        <v-text-field disabled label="Updated" :value="localGraph.properties.lastUpdate"></v-text-field>
                    </v-card-text>
                </v-card>
            </v-expansion-panel-text>
        </v-expansion-panel>
        <v-expansion-panel class="ma-0 pa-0">
            <v-expansion-panel-title>Publishing</v-expansion-panel-title>
            <v-expansion-panel-text>
                <v-card class="ma-0 pa-0" flat>
                    <v-card-text class="ma-0 pa-0">
                        <v-btn class="ma-4" color="info" @click="publishGraph" help-topic="graphPublishButton">
                            Publish<br>Graph
                            <v-icon right>
                                mdi-share-variant
                            </v-icon>
                        </v-btn>
                        <v-combobox
                            help-topic="graphTags"
                            :items="domainTags"
                            persistent-hint
                            hint="Which domains this resource works in"
                            chips
                            deletable-chips
                            clearable
                            multiple
                            hide-selected
                            label="Tags"
                            prepend-icon="mdi-tag-multiple-outline"
                            v-model="localGraph.properties.tags"/>
                    </v-card-text>
                </v-card>
            </v-expansion-panel-text>
        </v-expansion-panel>
        <v-expansion-panel class="ma-0 pa-0">
            <v-expansion-panel-title>External Graph IO</v-expansion-panel-title>
            <v-expansion-panel-text>
                <v-card class="ma-0 pa-0" flat help-topic="graphIOList">
                    <v-card-text class="ma-0 pa-0">
                        <v-list style="width: 110%;" value="true">
                            <template v-for="io in ['inputs', 'outputs']" :key="io">
                                <v-card-title>{{io}}</v-card-title>
                                <v-list-item :prepend-icon="io === 'inputs' ? 'mdi-power-socket' : 'mdi-power-plug'"  v-for="(ios) in ioList[io]">
                                    {{ios.field.name}} : {{ios.node.properties.name || ios.node.id}}
                                </v-list-item>
                            </template>
                        </v-list>
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
import {diff} from "deep-diff";
import {deref} from "@plastic-io/graph-editor-vue3-utils";
import {mapActions, mapState, mapWritableState} from "pinia";

export default {
    name: "graph-properties",
    methods: {
        ...mapActions(useOrchestratorStore, [
            "publishGraph",
        ]),
        ...mapActions(useGraphStore, [
            "externalIO",
            "save",
            "selectNode",
            "updateGraphFromSnapshot",
        ]),
    },
    mounted() {
        this.localGraph = deref(this.graphSnapshot);
    },
    data: () => {
        return {
            updateTimeout: 1000,
            panel: null,
            saveTimeout: null,
            localGraph: null,
            updatingLocal: false,
        };
    },
    watch: {
        'graphSnapshot.properties': {
            handler() {
                if (this.updatingLocal) {
                    return;
                }
                this.localGraph.properties = deref(this.graphSnapshot.properties);
            },
            deep: true,
        },
        'localGraph.properties': {
            handler() {
                clearTimeout(this.saveTimeout);
                this.saveTimeout = setTimeout(() => {
                    this.updatingLocal = true;
                    this.graphSnapshot.properties = deref(this.localGraph.properties);
                    this.updateGraphFromSnapshot('Update Graph Properties');
                    this.updatingLocal = false;
                }, this.updateTimeout);
            },
            deep: true,
        },
    },
    computed: {
        ...mapWritableState(useGraphStore, [
            'graphSnapshot',
        ]),
        ...mapState(useOrchestratorStore, [
            'domainTags',
        ]),
        ioList() {
            return this.externalIO();
        }
    }
};
</script>
<style></style>
