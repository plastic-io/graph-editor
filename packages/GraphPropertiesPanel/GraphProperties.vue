<template>
    <v-card flat v-if="graphSnapshot">
        <v-card-text class="ma-0 pa-0">
            <v-expansion-panels flat v-model="panel">
                <v-expansion-panel>
                    <v-expansion-panel-title>General</v-expansion-panel-title>
                    <v-expansion-panel-text>
                        <v-card class="ma-0 pa-0" flat>
                          <v-card-text class="ma-0 pa-0">
                                <v-text-field help-topic="graphName" label="Name" v-model="graphSnapshot.properties.name"></v-text-field>
                                <v-text-field help-topic="graphDescription" label="Description" v-model="graphSnapshot.properties.description"></v-text-field>
                                <v-text-field help-topic="graphUrl" label="URL" v-model="graphSnapshot.url"></v-text-field>
                                <v-text-field help-topic="graphId" label="Graph Id" disabled v-model="graphSnapshot.id"></v-text-field>
<!--                                 <v-combobox
                                    help-topic="graphIcon"
                                    :prepend-icon="graphSnapshot.properties.icon"
                                    persistent-hint
                                    hint="https://cdn.materialdesignicons.com/4.9.95/"
                                    :eager="true"
                                    title="Icon"
                                    :items="icons"
                                    v-model="graphSnapshot.properties.icon"/> -->
                                <v-text-field help-topic="graphVersion" label="Version" disabled v-model="graphSnapshot.version"></v-text-field>
                            </v-card-text> 
                        </v-card>
                    </v-expansion-panel-text>
                </v-expansion-panel>
                <v-expansion-panel>
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
                <v-expansion-panel>
                    <v-expansion-panel-title>Meta</v-expansion-panel-title>
                    <v-expansion-panel-text>
                        <v-card class="ma-0 pa-0" flat>
                            <v-card-text class="ma-0 pa-0" help-topic="graphMeta">
                                <v-text-field disabled label="Created By" v-model="graphSnapshot.properties.createdBy"></v-text-field>
                                <v-text-field disabled label="Last Updated By" v-model="graphSnapshot.properties.lastUpdatedBy"></v-text-field>
                                <v-text-field disabled label="Created" :value="fromNow(graphSnapshot.properties.createdOn)"></v-text-field>
                                <v-text-field disabled label="Updated" :value="fromNow(graphSnapshot.properties.lastUpdate)"></v-text-field>
                            </v-card-text>
                        </v-card>
                    </v-expansion-panel-text>
                </v-expansion-panel>
                <v-expansion-panel>
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
                <v-expansion-panel>
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
        </v-card-text>
    </v-card>
</template>
<script lang="ts">
import {useStore as useInputStore} from "@plastic-io/graph-editor-vue3-input";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";

import {mapWritableState, mapActions, mapState} from "pinia";

import moment from "moment";

import * as mdi from "@mdi/js";

export default {
    name: "graph-properties",
    methods: {
        ...mapActions(useOrchestratorStore, [
            "publishGraph",
        ]),
        ...mapActions(useGraphStore, [
            "save",
            "selectNode",
        ]),
        fromNow(e) {
            return moment(new Date(e)).fromNow();
        },
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
    },
    data: () => {
        return {
            panel: 0,
        };
    },
    watch: {
        "graphSnapshot.properties": {
            handler: function () {
                // this.save();
            },
            deep: true,
        },
    },
    computed: {
        icons() {
            return Object.keys(mdi).map(this.hyphenateProperty);
        },
        externalIO() {
            const info = {
                inputs: [],
                outputs: [],
            };
            this.graphSnapshot.nodes.forEach((v) => {
                ["inputs", "outputs"].forEach((io) => {
                    v.properties[io].forEach((i) => {
                        if (i.external) {
                            info[io].push({
                                node: v,
                                field: i,
                            });
                        }
                    });
                });
            });
            return info;
        },
        ...mapState(useGraphStore, [
            'graphSnapshot',
        ]),
        ...mapState(useOrchestratorStore, [
            'domainTags',
        ]),
    }
};
</script>
<style></style>
