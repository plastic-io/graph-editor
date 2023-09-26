<template>
    <v-expansion-panels flat v-model="panel" style="width: 300px;" class="ma-0 pa-0">
        <v-expansion-panel class="ma-0 pa-0">
            <v-expansion-panel-title>General</v-expansion-panel-title>
            <v-expansion-panel-text>
                <v-card class="ma-0 pa-0" flat>
                  <v-card-text class="ma-0 pa-0">
                        <v-text-field help-topic="graphName" label="Name" v-model="graphSnapshot.properties.name"></v-text-field>
                        <v-text-field help-topic="graphDescription" label="Description" v-model="graphSnapshot.properties.description"></v-text-field>
                        <v-text-field help-topic="graphUrl" label="URL" v-model="graphSnapshot.url"></v-text-field>
                        <v-text-field help-topic="graphId" label="Graph Id" disabled v-model="graphSnapshot.id"></v-text-field>
                        <v-text-field
                            help-topic="graphIcon"
                            persistent-hint
                            v-model="graphSnapshot.properties.icon"
                            hint="https://cdn.materialdesignicons.com/4.9.95/"
                            title="Icon">
                            <template v-slot:prepend>
                                <v-icon :icon="graphSnapshot.properties.icon"/>
                            </template>
                        </v-text-field>
                        <v-text-field help-topic="graphVersion" label="Version" disabled v-model="graphSnapshot.version"></v-text-field>
                    </v-card-text> 
                </v-card>
            </v-expansion-panel-text>
        </v-expansion-panel>
        <v-expansion-panel class="ma-0 pa-0">
            <v-expansion-panel-title>Global Scripts</v-expansion-panel-title>
            <v-expansion-panel-text>
                <v-textarea persistent-hint hint="csv list of script sources that will be loaded before the graph loads" v-model="graphSnapshot.properties.scripts" label="Graph Scripts" help-topic="graph-scripts" />
            </v-expansion-panel-text>
            </v-expansion-panel>
        <v-expansion-panel class="ma-0 pa-0">
            <v-expansion-panel-title>Presentation</v-expansion-panel-title>
            <v-expansion-panel-text>
                <v-card class="ma-0 pa-0" flat>
                    <v-card-text class="ma-0 pa-0" help-topic="graphPresentation">
                        <v-switch label="Start In Presentation Mode" v-model="graphSnapshot.properties.startInPresentationMode"></v-switch>
                        <v-text-field label="Height" v-model.number="graphSnapshot.properties.height"></v-text-field>
                        <v-text-field label="Width" v-model.number="graphSnapshot.properties.width"></v-text-field>
                    </v-card-text>
                </v-card>
            </v-expansion-panel-text>
        </v-expansion-panel>
        <v-expansion-panel class="ma-0 pa-0">
            <v-expansion-panel-title>Meta</v-expansion-panel-title>
            <v-expansion-panel-text>
                <v-card class="ma-0 pa-0" flat>
                    <v-card-text class="ma-0 pa-0" help-topic="graphMeta">
                        <v-text-field disabled label="Created By" v-model="graphSnapshot.properties.createdBy"></v-text-field>
                        <v-text-field disabled label="Last Updated By" v-model="graphSnapshot.properties.lastUpdatedBy"></v-text-field>
                        <v-text-field disabled label="Created" :value="graphSnapshot.properties.createdOn"></v-text-field>
                        <v-text-field disabled label="Updated" :value="graphSnapshot.properties.lastUpdate"></v-text-field>
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
                            v-model="graphSnapshot.properties.tags"/>
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
                                <v-list-item :prepend-icon="io === 'inputs' ? 'mdi-power-socket' : 'mdi-power-plug'">
                                    <template v-for="(ios) in externalIO[io]">
                                        {{ios.field.name}} : {{ios.node.properties.name || ios.node.id}}
                                    </template>
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

import {mapActions, mapState, mapWritableState} from "pinia";

export default {
    name: "graph-properties",
    methods: {
        ...mapActions(useOrchestratorStore, [
            "publishGraph",
        ]),
        ...mapActions(useGraphStore, [
            "save",
            "selectNode",
            "updateGraphFromSnapshot",
        ]),
    },
    data: () => {
        return {
            updateTimeout: 1000,
            panel: null,
            saveTimeout: null,
        };
    },
    watch: {
        'graphSnapshot.properties': {
            handler() {
                clearTimeout(this.saveTimeout);
                this.saveTimeout = setTimeout(() => {
                    this.updateGraphFromSnapshot('Update Graph Properties');
                }, this.updateTimeout);
            },
            deep: true,
        },
    },
    computed: {
        ...mapWritableState(useGraphStore, [
            'graphSnapshot',
        ]),
        ...mapState(useGraphStore, [
            'externalIO',
        ]),
        ...mapState(useOrchestratorStore, [
            'domainTags',
        ]),

    }
};
</script>
<style></style>
