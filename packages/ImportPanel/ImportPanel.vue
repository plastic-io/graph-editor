<template>
    <v-card flat>
        <v-card-title help-topic="importPanel">
            <v-icon left>mdi-library</v-icon>
            Library
        </v-card-title>
        <v-card-subtitle>
            Create, Import, and Export Components, Nodes, and Graphs
        </v-card-subtitle>
        <v-card-text>
            <v-tabs grow icons-and-text hide-slider v-model="importPanelTabs">
                <v-tab help-topic="importLocal">
                    <v-icon>mdi-folder</v-icon>
                    Local Graphs
                </v-tab>
                <v-tab help-topic="importPublic">
                    <v-icon>mdi-folder-network</v-icon>
                    Public Graphs
                </v-tab>
            </v-tabs>
            <v-window v-model="importPanelTabs">
              <v-window-item>
                  <import-panel-list/>
              </v-window-item>
              <v-window-item>
                  <import-panel-registry/>
              </v-window-item>
            </v-window>
        </v-card-text>
    </v-card>
</template>
<script lang="ts">
import ImportPanelComponent from "./ImportPanelComponent.vue";
import ImportPanelList from "./ImportPanelList.vue";
import ImportPanelRegistry from "./ImportPanelRegistry.vue";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {mapState} from "pinia";
export default {
    name: "import-panel",
    components: {ImportPanelList, ImportPanelRegistry, ImportPanelComponent},
    data: () => {
        return {
            importPanelTabs: null,
        };
    },
};
</script>
<style></style>
