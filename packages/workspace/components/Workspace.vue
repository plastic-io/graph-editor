<template>
    <v-app class="graph-editor" :style="workspaceBackground">
        <component is="script" v-for="script in scripts" :src="script"/>
        <error-interstitial/>
        <template v-if="graph && !graph.err && preferences">
            <v-system-bar
                class="top-system-bar no-graph-target"
                v-if="!presentation && panelVisibility"
                ref="topBar"
                style="z-index: 2;white-space: nowrap; top: 0; position: fixed; width: 100vw;"
            >
                <template
                v-for="(plugin, index) in getPluginsByType('system-bar-top')"
                :value="plugin.name"
                >
                    <v-divider v-if="plugin.divider" vertical class="mx-2"/>
                    <component :is="plugin.component" v-bind="plugin.props"/>
                </template>
            </v-system-bar>
            <div :style="showHelp ? 'pointer-events: none;' : ''">
                <navigation-drawer v-if="!presentation && panelVisibility" ref="panel"/>
            </div>
            <mini-map-info v-if="preferences.showMap && !presentation"/>
            <div :class="presentation ? '' : 'graph-container'" :style="graphContainerStyle">
                <graph-canvas
                    :class="noSelect ? 'no-select' : ''"
                    :showGrid="preferences.appearance.showGrid && !presentation"
                ></graph-canvas>
            </div>
            <v-system-bar
                v-if="!presentation && panelVisibility"
                ref="bottomBar"
                class="no-select bottom-system-bar no-graph-target"
            >
                <template
                    v-for="(plugin, index) in getPluginsByType('system-bar-bottom')"
                    :value="plugin.name"
                >
                    <component :is="plugin.component" v-bind="plugin.props"/>
                </template>
            </v-system-bar>
            <connector-info v-if="showConnectorView" @close="showConnectorView = false;"/>
        </template>
    </v-app>
</template>
<script lang="ts">
import {mapWritableState, mapActions, mapState} from "pinia";
import GraphMap from "@plastic-io/graph-editor-vue3-mini-map-info";
import ErrorPage from "@plastic-io/graph-editor-vue3-error-interstitial";
import GraphRewind from "@plastic-io/graph-editor-vue3-rewind";
import {useStore as useInputStore} from "@plastic-io/graph-editor-vue3-input";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
export default {
    name: "GraphEditor",
    props: {
        route: Object,
    },
    computed: {
        ...mapState(usePreferencesStore, [
            'preferences',
        ]),
        ...mapState(useInputStore, [
            'mouse',
            'keys',
        ]),
        ...mapState(useGraphStore, [
            'graph',
        ]),
        ...mapWritableState(useGraphStore, [
            'workspaceElement',
        ]),
        ...mapWritableState(useOrchestratorStore, [
            'showConnectorView',
        ]),
        ...mapState(useOrchestratorStore, [
            'bgColor',
            'showHelp',
            'panelVisibility',
            'presentation',
            'hoveredConnector',
        ]),
        workspaceBackground() {
            return {
                background: this.bgColor,
            };
        },
        scripts() {
            return [
                ...this.preferences.componentScripts.replace('\n', ',').split(','),
            ]
        },
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
    watch: {
        'mouse.lmb'() {
            if (this.mouse.lmb) {
                this.noSelect = true;
                return;
            }
            if (!this.mouse.lmb) {
                setTimeout(() => {
                    this.noSelect = false;
                }, 1);
            }
        },
    },
    methods: {
        ...mapActions(useGraphStore, [
            'scale',
            'evCut',
            'evPaste',
            'evCopy',
        ]),
        ...mapActions(useInputStore, [
            'onwheel',
            'keydown',
            'keyup',
            'mousedown',
            'dblclick',
            'mouseup',
            'mousemove',
        ]),
        ...mapActions(useOrchestratorStore, [
            'init',
            'setTheme',
            'getPluginsByType',
        ]),
    },
    unmounted() {
        document.removeEventListener('cut', this.evCut);
        document.removeEventListener('paste', this.evPaste);
        document.removeEventListener('copy', this.evCopy);
        window.removeEventListener('mousedown', this.mousedown);
        window.removeEventListener('dblclick', this.dblclick);
        window.removeEventListener('mouseup', this.mouseup);
        window.removeEventListener('mousemove', this.mousemove);
        window.removeEventListener('keyup', this.keyup);
        window.removeEventListener('keydown', this.keydown);
        document.removeEventListener('wheel', this.onwheel, {
            passive: false,
        });
    },
    mounted() {
        this.workspaceElement = this.$el;
        document.addEventListener('cut', this.evCut);
        document.addEventListener('paste', this.evPaste);
        document.addEventListener('copy', this.evCopy);
        window.addEventListener('mousedown', this.mousedown);
        window.addEventListener('dblclick', this.dblclick);
        window.addEventListener('mouseup', this.mouseup);
        window.addEventListener('mousemove', this.mousemove);
        window.addEventListener('keyup', this.keyup);
        window.addEventListener('keydown', this.keydown);
        document.addEventListener('wheel', this.onwheel, {
            passive: false,
        });
        this.setTheme(this.preferences.appearance.theme);
    },
    data: () => {
        return {
            spaceKeyCode: 32,
            themeSet: false,
            translate: false,
            noSelect: false,
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
}
.graph-container {
    top: 0px;
    height: calc(100vh - 25px);
}
.error-close-btn.v-icon.v-icon:after,
.bottom-system-bar .v-icon.v-icon:after,
.top-system-bar  .v-icon.v-icon:after {
    display: none;
}
.bottom-system-bar {
    bottom: 0;
    white-space: nowrap;
    position: absolute;
    z-index: 2;
    left: 0 !important;
    width: 100vw !important;
    max-width: 100vw !important;
    top: inherit !important;
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
