<template>
    <v-card elevation="0" flat style="height: calc(100vh - 150px);" class="pa-2">
        <v-card elevation="0">
            <v-card-text>
                <v-tabs v-model="tabs">
                    <v-tab key="history">
                        <v-icon help-topic="historyPanel">mdi-history</v-icon>
                    </v-tab>
                    <v-tab key="rewind">
                        <v-icon help-topic="rewind">mdi-rewind</v-icon>
                    </v-tab>
                </v-tabs>
                <v-window v-model="tabs">
                    <v-window-item key="history">
                        <v-list style="height: calc(100vh - 121px);overflow-y: auto;">
                            <v-list-item
                                v-for="(event, index) in localEvents"
                                :key="index"
                                :style="historyColor(index)"
                                :title="event.description"
                                @click="moveHistoryPosition(-(historyPosition - index))">
                                <template v-slot:prepend>
                                    {{index}}
                                    <v-icon>{{getIcon(event.description)}}</v-icon>
                                </template>
                            </v-list-item>
                        </v-list>
                    </v-window-item>
                    <v-window-item key="rewind">
                        <v-card class="ma-5">
                            <v-card-title>
                                Rewind
                            </v-card-title>
                            <v-card-text>
                                You can rewind the state of your graph to any previous
                                version.
                            </v-card-text>
                            <v-card-actions>
                                <v-spacer/>
                                <v-btn @click="showRewind">
                                    <v-icon>
                                        mdi-rewind
                                    </v-icon>
                                    Rewind
                                </v-btn>
                            </v-card-actions>
                        </v-card>
                    </v-window-item>
                </v-window>
            </v-card-text>
        </v-card>
    </v-card>
</template>
<script>
import {mapState, mapActions} from "pinia";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
export default {
    name: "history-panel",
    data: () => {
      return {
        tabs: null,
      };
    },
    methods: {
        historyColor(index) {
            let color = "";
            if (this.historyPosition === index) {
                color = "background: teal;";
            } else if (index > this.historyPosition) {
                color = "opacity: 0.45;";
            }
            return color;
        },
        ...mapActions(useGraphStore, [
            "moveHistoryPosition",
        ]),
        getIcon(name) {
            return {
                "Start": "mdi-flag-variant",
                "Nudge": "mdi-move-resize-variant",
                "Duplicate": "mdi-content-duplicate",
                "Paste": "mdi-content-paste",
                "Send Forward": "mdi-arrange-bring-forward",
                "Send Backward": "mdi-arrange-send-backward",
                "Bring to Front": "mdi-arrange-bring-to-front",
                "Send to Back": "mdi-arrange-send-to-back",
                "Group": "mdi-group",
                "Ungroup": "mdi-ungroup",
                "Delete": "mdi-delete",
                "Write to Graph": "mdi-pencil",
                "Move Connector": "mdi-vector-point",
                "Add Connector": "mdi-shape-circle-plus",
                "Move Nodes": "mdi-vector-polygon",
                "Change Input Order": "mdi-swap-vertical",
                "Change Output Order": "mdi-swap-vertical",
                "Add Input": "mdi-ray-start-arrow",
                "Add Output": "mdi-ray-end-arrow",
                "Remove Input": "mdi-minus-circle-outline",
                "Remove Output": "mdi-minus-circle-outline",
                "Update Node Properties": "mdi-pencil",
                "Update Graph Properties": "mdi-pencil",
                "Reorder Connectors": "mdi-sync",
                "Delete Connector": "mdi-delete",
                "Rename IO": "mdi-pencil",
                "Update Template": "mdi-pencil",
                "Toggle Node Presentation": "mdi-presentation",
            }[name] || "mdi-pencil";
        },
    },
    computed: {
        localEvents() {
            return [
                {
                    description: "Start",
                },
                ...this.events,
            ];
        },
        ...mapState(useGraphStore, [
            'historyPosition',
            'events',
            'showRewind',
        ]),
    }
};
</script>
<style></style>
