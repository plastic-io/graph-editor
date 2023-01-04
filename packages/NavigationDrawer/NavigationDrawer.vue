<template>
    <v-navigation-drawer
        disable-resize-watcher
        permanent
        :style="navStyle"
        class="graph-nav-drawer"
        ref="nav"
        app
        flat
        :key="localVersion">
        <v-container
            class="pa-0"
            style="z-index: 1; overflow: hidden;">
            <v-tabs v-model="panelTopTabs">
                  <v-tab
                    v-for="(plugin, index) in getPluginsByType('nav-panel-tabs')"
                    :value="plugin.name"
                  >
                    <span v-if="preferences.textLabels">{{plugin.name}}</span>
                    <v-icon v-if="!preferences.textLabels" :icon="plugin.icon"/>
                </v-tab>
            </v-tabs>
            <v-window v-model="panelTopTabs" :transition="false">
              <v-window-item
                v-for="(plugin, index) in getPluginsByType('nav-panel-tabs')"
                :value="plugin.name"
                :transition="false">
                <component :is="plugin.component" v-bind="plugin.props"/>
              </v-window-item>
            </v-window>
        </v-container>
        <v-icon
            help-topic="dragResizePanel"
            class="nav-drawer-resizer"
            title="Use this slider to resize this panel"
            color="secondary"
            :style="{left: (currentWidth - dragIconWidth) + 'px'}"
            @mousedown="startPanelDrag"
        >
            mdi-drag-vertical
        </v-icon>
    </v-navigation-drawer>
</template>
<script lang="typescript">
import {mapWritableState, mapActions, mapState} from "pinia";
import {useStore as useInputStore} from "@plastic-io/graph-editor-vue3-input";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
export default {
    name: "navigation-drawer",
    data: () => {
        return {
            lastNodePanel: 'Node',
            lastGraphPanel: 'Graph',
            mouse: {
                x: 0,
                y: 0,
            },
            defaultWidth: 400,
            dragIconWidth: 28,
            panelDefault: 450,
            panelMin: 10,
            navWidths: {},
            panelTopTabs: null,
            localVersion: 0,
            iconGutterSize: 43,
            graphVue: null,
            graphSet: null,
            graphJSON: null,
            panelDragging: null,
            panel: "none",
            panelOpen: true,
            localGraph: null,
        };
    },
    watch: {
        "mouse.y"() {
            this.mouseTranslate();
        },
        "mouse.x"() {
            this.mouseTranslate();
        },
        graph: {
            handler: function() {
                this.localGraph = this.graph;
            },
            deep: true
        },
    },
    computed: {
        ...mapWritableState(usePreferencesStore, [
          'preferences',
        ]),
        ...mapWritableState(useOrchestratorStore, [
          'navWidth',
        ]),
        ...mapState(useOrchestratorStore, [
          'log',
          'showHelp',
          'historyPosition',
          'plugins',
          'selectedPanel',
        ]),
        ...mapState(useGraphStore, [
          'selectRect',
          'selectedConnectors',
          'selectedNode',
          'selectedNodes',
          'hoveredConnectors',
          'hoveredNodes',
          'hoveredPorts',
          'view',
          'translating',
        ]),
        ...mapState(useInputStore, [
          'keys',
        ]),
        currentWidth() {
            return this.navWidths[this.panelTopTabs] || this.defaultWidth;
        },
        navStyle() {
            return {
                transition: 'none',
                width: this.panel ? (this.currentWidth + "px") : "250px",
            };
        }
    },
    methods: {
        ...mapActions(useOrchestratorStore, [
          'getPluginsByType',
        ]),
        mousemove(e) {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        },
        mouseTranslate() {
            if (this.panelDragging) {
                this.navWidths[this.panelTopTabs] =
                    Math.max(this.panelDragging.w + (this.mouse.x - this.panelDragging.x), this.panelMin);
            }
        },
        startPanelDrag() {
            const el = document.getElementsByClassName('graph-nav-drawer')[0];
            el.style.transition = 'none';
            this.panelDragging = {
                x: this.mouse.x,
                y: this.mouse.y,
                w: this.currentWidth || this.navWidth,
            };
            const dragEnd = () => {
                this.panelDragging = false;
                el.style.transition = undefined;
                this.navWidth = this.currentWidth;
                usePreferencesStore().$patch({
                    preferences: {
                        uiSize: {
                            [this.panelTopTabs]: this.currentWidth,
                        },
                    },
                });
                document.removeEventListener("mouseup", dragEnd);
            };
            document.addEventListener("mouseup", dragEnd);
        },
    },
    mounted() {
        this.localGraph = this.graph;
        this.navWidths = JSON.parse(JSON.stringify(this.preferences.uiSize));
        document.addEventListener('mousemove', this.mousemove);
        this.$nextTick(() => {
            this.navWidth = this.navWidths[this.panelTopTabs];
        });
        this.panelTopTabs = 'Graph';
    },
    unmounted() {
        document.removeEventListener('mousemove', this.mousemove);
    },
};
</script>
<style>
.graph-nav-drawer {
    height: calc(100vh - 48px) !important;
}
.nav-drawer-resizer {
    position: fixed;
    cursor: ew-resize;
    bottom: 7px;
}
</style>
