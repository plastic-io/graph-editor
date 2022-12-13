<template>
    <v-app class="graph-editor" :style="`background: ${bgColor};`">
        <error-interstitial v-if="notFound" />
        <template v-if="graph && !graph.err">
            <v-system-bar
                class="top-system-bar"
                v-if="!presentation && panelVisibility"
                ref="topBar"
                style="z-index: 2;white-space: nowrap; top: 0; position: fixed; width: 100vw;"
            >
                <template
                v-for="(plugin, index) in getPluginsByType('system-bar-top')"
                :value="plugin.name"
                >
                    <component :is="plugin.component"/>
                </template>
            </v-system-bar>
            <div :style="showHelp ? 'pointer-events: none;' : ''">
                <navigation-drawer v-if="!presentation && panelVisibility" ref="panel"/>
            </div>
            <div :class="presentation ? '' : 'graph-container'" :style="graphContainerStyle">
                <graph-canvas
                    :class="translating && mouse.lmb ? 'no-select' : ''"
                    :showGrid="preferences.appearance.showGrid && !presentation"
                ></graph-canvas>
            </div>
            <v-system-bar
                v-if="!presentation && panelVisibility"
                ref="bottomBar"
                style="position: absolute; z-index: 2; left: 0;bottom: 0; width: 100vw; top: inherit !important;"
                class="no-select bottom-system-bar"
            >
                <template
                v-for="(plugin, index) in getPluginsByType('system-bar-bottom')"
                :value="plugin.name"
                >
                    <component :is="plugin.component"/>
                </template>
            </v-system-bar>
        </template>
    </v-app>
</template>
<script>
import {mapWritableState, mapActions, mapState} from "pinia";
import GraphMap from "@plastic-io/graph-editor-vue3-mini-map-info";
import ErrorPage from "@plastic-io/graph-editor-vue3-error-interstitial";
import GraphRewind from "@plastic-io/graph-editor-vue3-graph-rewind";
import {useStore as useInputStore} from "@plastic-io/graph-editor-vue3-input";
import {useStore as useGraphCanvasStore} from "@plastic-io/graph-editor-vue3-graph-canvas";
import {useStore as useGraphOrchestratorStore} from "@plastic-io/graph-editor-vue3-graph-orchestrator";
import { useTheme } from 'vuetify';
export default {
    name: "GraphEditor",
    props: {
        route: Object,
    },
    computed: {
        ...mapWritableState(useGraphOrchestratorStore, [
            'translating',
            'selectedNodes',
            'preferences',
        ]),
        ...mapWritableState(useInputStore, [
            'mouse',
            'keys',
            'buttonMap',
        ]),
        ...mapWritableState(useGraphCanvasStore, [
            'graph',
            'view',
            'selectionRect',
            'hoveredNode',
            'hoveredPort',
        ]),
        ...mapState(useGraphOrchestratorStore, [
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
            'selectionRect',
            'selectedConnectors',
            'hoveredConnector',
        ]),
        graphContainerStyle: function() {
            let cursor = "";
            if ((this.mouse.lmb && this.translate) || this.mouse.mmb) {
                cursor = "grabbing";
            } else if (this.keys[this.spaceKeyCode]) {
                cursor = "grab";
            } else if (this.hoveredConnector) {
                cursor = "move";
            }
            return {
                pointerEvents: this.showHelp ? "none" : undefined,
                cursor
            };
        },
    },
    methods: {
        ...mapActions(useGraphCanvasStore, [
            'scale',
            'open',
            'createNewNode',
            'evCut',
            'evPaste',
            'evCopy',
        ]),
        ...mapActions(useInputStore, [
            'keydown',
            'keyup',
            'mousedown',
            'dblclick',
            'mouseup',
            'mousemove',
        ]),
        ...mapActions(useGraphOrchestratorStore, [
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
    },
    created() {
        const isDark = this.preferences.appearance.theme === "dark";
        const theme = useTheme();
        theme.global.name.value = isDark ? 'dark' : 'light';
        this.bgColor = isDark ? "#000000" : "#FFFFFF";
    },
    mounted() {
        window.onwheel = e => {
            this.scale(e);
        };
        document.oncut = this.evCut;
        document.onpaste = this.evPaste;
        document.oncopy = this.evCopy;
        window.onmousedown = this.mousedown;
        window.ondblclick = this.dblclick;
        window.onmouseup = this.mouseup;
        window.onmousemove = this.mousemove;
        window.onkeyup = this.keyup;
        window.onkeydown = this.keydown;
        const graphId = window.location.pathname.substring(1);
        this.open(graphId);
    },
    data: () => {
        return {
            bgColor: "#000000",
            spaceKeyCode: 32,
            translate: false,
            showDialog: false,
            localErrorMessage: "",
            localShowError: false,
            localVersion: 0,
            graphLoaded: false,
            presentationWarning: false,
            hasSeenPresentationWarning: false,
            showAnnoyingHelpMessage: false,
        };
    }
};
</script>
<style>
.graph-container, .graph-editor {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    width: 100vw;
}
.graph-container {
    top: 25px;
    height: calc(100vh - 25px);
}
.error-close-btn.v-icon.v-icon:after,
.bottom-system-bar .v-icon.v-icon:after,
.top-system-bar  .v-icon.v-icon:after {
    display: none;
}
.bottom-system-bar {
    white-space: nowrap;
}
.no-pointer-events {
    pointer-events: none;
}
.no-select {
    -webkit-touch-callout: none; /* iOS Safari */
    -webkit-user-select: none; /* Safari */
    -khtml-user-select: none; /* Konqueror HTML */
    -moz-user-select: none; /* Firefox */
    -ms-user-select: none; /* Internet Explorer/Edge */
    user-select: none; /* Non-prefixed version, currently supported by Chrome and Opera */
}
</style>
