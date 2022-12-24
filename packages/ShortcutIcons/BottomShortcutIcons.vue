<template>
    <div
        @click="resetView"
        help-topic="mouseCoordinates"
        title="Mouse Coordinates"
        style="width: 110px;cursor: crosshair;">
        <v-icon>mdi-crosshairs-gps</v-icon>{{ Math.floor((mouse.x - view.x) / view.k) }} : {{ Math.floor((mouse.y - view.y) / view.k) }}
    </div>
    <div
    help-topic="selectionCoordinates"
    title="Selection Coordinates"
    style="width: 240px;cursor: crosshair;">
        <v-icon>mdi-selection</v-icon>
            x: {{Math.floor(selectionRect.x)}}
            y: {{Math.floor(selectionRect.x)}}
            h: {{Math.floor(selectionRect.height)}}
            w: {{Math.floor(selectionRect.width)}}
    </div>
    <v-spacer/>
    <div help-topic="selectedNodes" title="Selected Nodes / Total Nodes" style="padding-right: 10px;cursor: pointer;">
        <v-icon>mdi-network</v-icon>{{ selectedNodes.length }}/{{ graph.nodes.length }}
    </div>
    <div help-topic="viewportLocation" title="Viewport localtion" style="padding-right: 10px;cursor: crosshair;" @click="resetView">
        <v-icon>mdi-crosshairs-gps</v-icon>x:{{ view.x.toFixed(0) }} y:{{ view.y.toFixed(0) }}
    </div>
    <v-icon title="Zoom Out (^ + -)" style="cursor: pointer;" @click="zoomOut">mdi-magnify-minus-outline</v-icon>
    <div
        help-topic="viewportZoom"
        @click="resetZoom"
        title="Zoom Level"
        style="padding-right: 5px;cursor: crosshair;">
        {{ (view.k * 100).toFixed(2) }}%
    </div>
    <v-icon
        @click="zoomIn"
        title="Zoom In (^ + +)"
        style="padding-right: 10px;cursor: pointer;"
        >mdi-magnify-plus-outline</v-icon>
    <v-icon
        help-topic="showConnectorView"
        title="Show Connector Information"
        @click="showConnectorView = !showConnectorView"
        style="padding-right: 10px;cursor: pointer;"
        :color="showConnectorView ? 'info' : ''"
        >mdi-information-outline</v-icon>
    <v-icon
        help-topic="toggleLabels"
        title="Toggle Input/Output Labels"
        @click="preferences.showLabels = !preferences.showLabels"
        style="padding-right: 10px;cursor: pointer;"
        :color="preferences.showLabels ? 'info' : ''"
        >{{preferences.showLabels ? 'mdi-label' : 'mdi-label-off'}}</v-icon>
    <v-icon
        title="Toggle Grid Visibility"
        @click="preferences.appearance.showGrid = !preferences.appearance.showGrid"
        help-topic="toggleGrid"
        style="padding-right: 10px;cursor: pointer;"
        :color="preferences.appearance.showGrid ? 'info' : ''"
        >mdi-grid</v-icon>
    <v-icon
        title="Toggle Map Visibility"
        @click="preferences.showMap = !preferences.showMap"
        help-topic="toggleMap"
        style="padding-right: 10px;cursor: pointer;"
        :color="preferences.showMap ? 'info' : ''"
        >mdi-map</v-icon>
    <v-icon
        title="Toggle Lock"
        @click="locked = !locked"
        help-topic="toggleLock"
        :color="locked ? 'info' : ''"
        style="padding-right: 10px;cursor: pointer;"
        >{{locked ? 'mdi-lock' : 'mdi-lock-open'}}</v-icon>
    <v-icon
        title="Toggle Presentation (Alt + `)"
        @click="presentation = !presentation"
        help-topic="togglePresentation"
        :color="presentation ? 'info' : ''"
        style="padding-right: 10px;cursor: pointer;"
        >{{presentation ? 'mdi-presentation-play' : 'mdi-presentation'}}</v-icon>
</template>
<script lang="typescript">
import {mapWritableState, mapActions, mapState} from "pinia";
import {useStore as useInputStore} from "@plastic-io/graph-editor-vue3-input";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";

export default {
    name: "bottom-shortcut-icons",
    props: {
        route: Object,
    },
    computed: {
        ...mapState(useInputStore, [
            'mouse',
            'keys',
            'buttonMap',
        ]),
        ...mapWritableState(useGraphStore, [
            'graph',
            'view',
            'resetView',
            'resetZoom',
            'selectionRect',
            'hoveredNode',
            'hoveredPort',
            'selectedNodes',
        ]),
        ...mapWritableState(usePreferencesStore, [
            'preferences',
        ]),
        ...mapWritableState(useOrchestratorStore, [
            'translating',
        ]),
        ...mapState(useOrchestratorStore, [
            'showConnectorView',
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
            'presentation',
            'locked',
            'events',
            'historyPosition',
            'primaryGroup',
            'groupNodes',
            'boundingRect',
            'selectedConnectors',
            'hoveredConnector',
        ]),
    },
    methods: {
        ...mapActions(useGraphStore, [
            'open',
            'createNewNode',
            'zoomOut',
            'zoomIn',
            'zoomReset',
        ]),
        ...mapActions(useGraphStore, [
            'open',
            'createNewNode',
        ]),
        ...mapActions(useInputStore, [
            'keydown',
            'keyup',
        ]),
        ...mapActions(useOrchestratorStore, [
            'clearInfo',
            'getPluginsByType',
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
        ]),
    }
}

</script>