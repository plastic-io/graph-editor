<template>
    <v-card class="ma-0 pa-0" flat style="overflow-y: scroll; height: calc(100vh - 120px);">
        <v-card-text class="ma-0 pa-0">
            <v-list
              help-topic="graphNodeList"
              :selected="list"
              :items="mappedNodes"
              @update:selected="updateSelected"
              v-if="graphSnapshot.nodes.length > 0"
              select-strategy="classic"></v-list>
            <i v-else class="ma-5">No Nodes</i>
        </v-card-text>
    </v-card>
</template>
<script lang="ts">
import {mapState, mapActions} from "pinia";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
export default {
    name: "node-list",
    methods: {
        ...mapActions(useOrchestratorStore, [
            "raiseError",
            "showInfoDialog",
        ]),
        ...mapActions(useGraphStore, [
            "updateNodeUrl",
            "selectNodes",
            "save",
        ]),
        updateSelected(e) {
          this.selectNodes(e);
        },
        copyNodeUrl(e, url) {
            navigator.clipboard.writeText(url).then(() => {
                this.showInfoDialog("URL Copied!");
            }, (err) => {
                this.raiseError(new Error("Clipboard write failed" + err));
            });
        },
        updateUrl(nodeId, url) {
            // console.log("updateUrl", nodeId, url);
            this.updateNodeUrl({
                nodeId,
                url,
            });
        },
    },
    computed: {
        ...mapState(useGraphStore, [
          'graphSnapshot',
          'selectedNodes',
        ]),
        ...mapState(usePreferencesStore, [
          'preferences'
        ]),
        list() {
            return this.selectedNodes.map(n => n.id);
        },
        mappedNodes() {
          const nodes = this.graphSnapshot.nodes.map((node) => {
            return {
              title: node.properties.name || 'Untitled Node',
              value: node.id,
              props: {
                prependIcon: node.properties.icon,
              },
            };
          });
          return nodes;
        },
    },
    data: () => {
        return {
            nodeList: 0,
        };
    },
};
</script>
<style></style>
