<template>
    <div>
        <v-card flat style="width: 500px;">
            <v-card-title help-topic="importPanel">
                <v-icon left>mdi-library</v-icon>
                Library
            </v-card-title>
            <v-card-subtitle>
                Create, Import, and Export Components, Nodes, and Graphs
            </v-card-subtitle>
            <v-card-text>
                <v-tabs grow icons-and-text hide-slider v-model="importPanelTabs">
                    <v-tab help-topic="importLocal" value="local">
                        <v-icon>mdi-folder</v-icon>
                        Local Graphs
                    </v-tab>
                    <v-tab help-topic="importPublic" value="public">
                        <v-icon>mdi-folder-network</v-icon>
                        Public Graphs
                    </v-tab>
                    <v-tab v-for="(plugin, index) in getPluginsByType('library-registry-panel')" :value="plugin.name">
                        <v-icon>{{plugin.icon}}</v-icon>
                        {{plugin.name}}
                    </v-tab>
                </v-tabs>
                <v-window v-model="importPanelTabs">
                  <v-window-item value="local">
                      <import-panel-list/>
                  </v-window-item>
                  <v-window-item value="public">
                      <import-panel-registry/>
                  </v-window-item>
                  <v-window-item
                    v-for="(plugin, index) in getPluginsByType('library-registry-panel')"
                    :value="plugin.name"
                  >
                    <component :is="plugin.component" v-bind="plugin.props"/>
                  </v-window-item>
                </v-window>
            </v-card-text>
        </v-card>
    </div>
</template>
<script lang="ts">
import ImportPanelComponent from "./ImportPanelComponent.vue";
import ImportPanelList from "./ImportPanelList.vue";
import ImportPanelRegistry from "./ImportPanelRegistry.vue";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {mapState, mapActions} from "pinia";
export default {
    name: "import-panel",
    components: {ImportPanelList, ImportPanelRegistry, ImportPanelComponent},
    methods: {
        ...mapActions(useOrchestratorStore, [
          'getPluginsByType',
        ]),
    },
    data: () => {
        return {
            importPanelTabs: null,
        };
    },
};
</script>
<style></style>
