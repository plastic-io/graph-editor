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
            <v-tabs v-model="currentTabs">
                  <v-tab
                    v-for="(plugin, index) in currentTabGroup"
                    :value="plugin.name"
                  >
                    {{plugin.name}}
                </v-tab>
            </v-tabs>
            <v-window v-model="currentTabs">
              <v-window-item
                v-for="(plugin, index) in panelPlugins"
                :value="plugin.name">
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
            panelTopGraphTabs: null,
            panelTopNodeTabs: null,
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
        selectedPanel() {
            if (this.selectedPanel) {
                this.currentTabs = this.selectedPanel;
            }
        },
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
            return this.navWidths[this.currentTabs] || this.defaultWidth;
        },
        panelPlugins() {
            return [
                ...this.getPluginsByType('nav-panel-graph-tabs'),
                ...this.getPluginsByType('nav-panel-node-tabs'),
                ...this.getPluginsByType('nav-panel-tabs'),
            ];
        },
        currentTabGroup() {
            if (this.selectedNodes.length === 0) {
                return [
                    ...this.getPluginsByType('nav-panel-graph-tabs'),
                    ...this.getPluginsByType('nav-panel-tabs'),
                ];
            }
            return [
                ...this.getPluginsByType('nav-panel-node-tabs'),
                ...this.getPluginsByType('nav-panel-tabs'),
            ];
        },
        currentTabs: {
            get() {
                if (this.selectedNodes.length === 0) {
                    return this.panelTopGraphTabs;
                }
                return this.panelTopNodeTabs;
            },
            set(val) {
                if (this.selectedNodes.length === 0) {
                    return this.panelTopGraphTabs = val;
                }
                return this.panelTopNodeTabs = val;
            }
        },
        navStyle() {
            return {
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
                this.navWidths[this.currentTabs] =
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
                            [this.currentTabs]: this.currentWidth,
                        },
                    },
                });
                document.removeEventListener("mouseup", dragEnd);
            };
            document.addEventListener("mouseup", dragEnd);
        },
        selectPanel(panel) {
            if (this.panel === panel) {
                this.panel = "";
                return;
            }
            this.panel = panel;
            this.localVersion += 1;
        }
    },
    mounted() {
        this.localGraph = this.graph;
        this.navWidths = JSON.parse(JSON.stringify(this.preferences.uiSize));
        document.addEventListener('mousemove', this.mousemove);
        this.$nextTick(() => {
            this.navWidth = this.navWidths[this.currentTabs];
        });
        this.panelTopGraphTabs = 'Graph';
        this.panelTopNodeTabs = 'Node';
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
