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
        <v-container class="nav-panel-top-gutter">
            <v-icon
                v-for="(plugin, index) in getPlugins('nav-panel-top-gutter-icons')"
                :value="plugin.name"
                :icon="plugin.icon"
                :color="tabSet == plugin.props.tabSet ? 'primary' : ''"
                @click="tabSet = plugin.props.tabSet;"
                v-bind="plugin.props"
            />
        </v-container>

        <v-container
            class="pa-0 nav-panel-main"
            style="z-index: 1; overflow: hidden;">
            <v-window v-model="tabSet">
                <v-window-item v-for="pluginPanel in getWindows"
                    :value="pluginPanel.props.tabSet"
                    :reverse-transition="false"
                    :transition="false"
                >
                    <keep-alive>
                        <v-tabs v-model="tabSetTabs[tabSet]">
                              <v-tab
                                v-for="(plugin, index) in getPlugins(tabSet)"
                                :value="plugin.name"
                              >
                                <span v-if="preferences.textLabels">{{plugin.name}}</span>
                                <v-icon v-if="!preferences.textLabels" :icon="plugin.icon"/>
                            </v-tab>
                        </v-tabs>
                    </keep-alive>
                    <v-window v-model="tabSetTabs[tabSet]">
                      <v-window-item
                        v-for="(plugin, index) in windowPlugins"
                        :value="plugin.name"
                        :reverse-transition="false"
                        :transition="false"
                      >
                        <keep-alive>
                            <component :is="plugin.component" v-bind="plugin.props"/>
                        </keep-alive>
                      </v-window-item>
                    </v-window>

                </v-window-item>
            </v-window>

        </v-container>
        <v-container class="nav-panel-bottom-gutter">
            <v-icon
                v-for="(plugin, index) in getPlugins('nav-panel-bottom-gutter-icons')"
                :value="plugin.name"
                :icon="plugin.icon"
                v-bind="plugin.props"
                :color="tabSet == plugin.props.tabSet ? 'primary' : ''"
                @click="this.tabSet = plugin.props.tabSet"
            />
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
            dragIconWidth: 32,
            panelDefault: 450,
            panelMin: 10,
            navWidths: {},
            tabSetTabs: {},
            tabSet: null,
            panelTopTabs: null,
            panelTopGutterTabs: null,
            panelBottomGutterTabs: null,
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
        tabSet() {
            if (this.tabSetTabs[this.tabSet]) {
                return;
            }
            this.tabSetTabs[this.tabSet] = this.getPlugins(this.tabSet)[0].name;
        },
        selectedTabSet() {
            this.tabSet = this.selectedTabSet;
        },
        selectedPanel() {
            this.tabSetTabs[this.tabSet] = this.selectedPanel;
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
          'selectedPanel',
        ]),
        ...mapState(useOrchestratorStore, [
          'log',
          'showHelp',
          'historyPosition',
          'plugins',
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
        windowPlugins() {
            return [
                ...this.getPlugins(this.tabSet),
            ];
        },
        getPlugins() {
            return (id) => {
                return this.getPluginsByType(id);
            }
        },
        getWindows() {
            return [
                ...this.getPlugins('nav-panel-top-gutter-icons'),
                ...this.getPlugins('nav-panel-bottom-gutter-icons'),
            ]
        },
        currentWidth() {
            return Math.max(this.navWidths[this.panelTopTabs], 40) || this.defaultWidth;
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
        this.tabSet = 'nav-panel-graph-tabs';
        this.tabSetTabs['nav-panel-graph-tabs'] = 'Graph';
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
.nav-panel-main {
    width: calc(100% - 38px) !important;
    margin-right: auto;
    margin-left: 0;
}
.nav-drawer-resizer {
    position: fixed;
    cursor: ew-resize;
    bottom: 7px;
}
.nav-panel-top-gutter, .nav-panel-bottom-gutter {
    position: absolute;
    width: 30px;
    right: 15px;
}
.nav-panel-bottom-gutter {
    bottom: 37px;
}
</style>
