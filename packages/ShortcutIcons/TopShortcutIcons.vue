<template>
    <div
        title="Graph ID"
        style="padding-right: 10px;cursor: pointer;">
        <v-icon help-topic="openGraph"  @click="navigateToRoot" title="Show open graph dialog (^ + O)">
            mdi-folder
        </v-icon>
        <span v-if="inRewindMode">
            Rewinding...
        </span>
    </div>
    <span help-topic="documentName" class="pa-1 version-view">
        {{ graph.properties.name || graph.url || "Untitled" }}
        <span>v{{ graph.version }}</span>
    </span>
    <v-spacer/>
    <shared-users/>
    <v-icon
        help-topic="panic"
        @click="panic"
        title="PANIC!"
        >mdi-exclamation-thick</v-icon>
    <v-divider vertical class="mx-2"/>
    <v-icon :disabled="historyPosition === 0 || events.length === 0"
        @click="undo"
        help-topic="undo"
        title="Undo last action (^ + Z)">mdi-undo-variant</v-icon>
    <v-icon :disabled="historyPosition === events.length"
        @click="redo"
        help-topic="redo"
        title="Redo last undone action (^ + Shift + Z)">mdi-redo-variant</v-icon>
    <v-divider vertical class="mx-2"/>
    <v-icon :disabled="selectedNodes.length === 0"
        @click="duplicateSelection"
        help-topic="duplicate"
        title="Duplicate selected nodes (^ + Shift + D)">mdi-content-duplicate</v-icon>
    <v-divider vertical class="mx-2"/>
    <v-icon :disabled="selectedNodes.length < 2"
        @click="groupSelected"
        help-topic="group"
        title="Group (^ + G)">mdi-group</v-icon>
    <v-icon :disabled="primaryGroup === null"
        @click="ungroupSelected"
        help-topic="ungroup"
        title="Ungroup (^ + Shift + G)" >mdi-ungroup</v-icon>
    <v-divider vertical class="mx-2"/>
    <v-icon
        @click="bringForward"
        help-topic="bringForward"
        title="Bring forward (^ + ])">mdi-arrange-bring-forward</v-icon>
    <v-icon
        @click="bringToFront"
        help-topic="bringToFront"
        title="Bring to front (^ + Shift + ])">mdi-arrange-bring-to-front</v-icon>
    <v-icon
        @click="sendBackward"
        help-topic="sendBackward"
        title="Send backward (^ + [)">mdi-arrange-send-backward</v-icon>
    <v-icon
        @click="sendToBack"
        help-topic="sendToBack"
        title="Send to back (^ + Shift + [)">mdi-arrange-send-to-back</v-icon>
    <v-divider vertical class="mx-2"/>
    <v-icon
        help-topic="deleteSelected"
        @click="deleteSelected"
        title="Delete selected (delete)"
        :disabled="selectedNodes.length === 0 && selectedConnectors === 0">mdi-delete</v-icon>
    <v-divider vertical class="mx-2"/>
    <v-icon
        @click="showHelp = !showHelp"
        help-topic="toggleHelp"
        :color="showHelp ? 'info' : ''"
        title="Help">mdi-help-circle-outline</v-icon>
</template>
<script lang="typescript">
import {mapWritableState, mapActions, mapState} from "pinia";
import {useStore as useInputStore} from "@plastic-io/graph-editor-vue3-input";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";

export default {
    name: "top-shortcut-icons",
    props: {
        route: Object,
    },
    computed: {
        ...mapWritableState(usePreferencesStore, ['preferences']),
        ...mapWritableState(useOrchestratorStore, [
            'translating',
        ]),
        ...mapWritableState(useGraphStore, [
            'graph',
            'view',
            'events',
            'selectedNodes',
            'selectionRect',
            'hoveredNode',
            'hoveredPort',
        ]),
        ...mapState(useOrchestratorStore, [
            'notFound',
            'inRewindMode',
            'rewindVisible',
            'showInfo',
            'infoMessage',
            'dataProviders',
            'pendingEvents',
            'activityConnectors',
            'pathPrefix',
            'showHelp',
            'panelVisibility',
            'nodeMimeType',
            'showError',
            'error',
            'locked',
            'historyPosition',
            'primaryGroup',
            'groupNodes',
            'boundingRect',
            'selectionRect',
            'selectedConnectors',
            'hoveredConnector',
        ]),
        pending: function() {
            return Object.keys(this.pendingEvents).length;
        },
    },
    methods: {
        ...mapActions(useGraphStore, [
            'open',
            'undo',
            'redo',
            'duplicateSelection',
            'groupSelected',
            'ungroupSelected',
            'bringForward',
            'bringToFront',
            'sendBackward',
            'sendToBack',
            'deleteSelected',
            'createNewNode',
        ]),
        ...mapActions(useInputStore, [
            'keydown',
            'keyup',
        ]),
        ...mapActions(useOrchestratorStore, [
            'panic',
            'clearInfo',
            'getPluginsByType',
        ]),
        navigateToRoot() {
            window.location = '/graph-editor/'
        },
        openGraph() {
            window.open(
                this.pathPrefix,
                "_graphs",
            );
        },
    }
}

</script>
<style>
.version-view span {
    opacity: 0;
}
.version-view:hover span {
    opacity: 1;
}
</style>