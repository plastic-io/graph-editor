<template>
    <v-navigation-drawer
        disable-resize-watcher
        permanent
        :style="navStyle"
        class="graph-nav-drawer"
        ref="nav"
        app
        flat
        :key="localVersion"
        style="height: calc(100vh - 48px);">
        <v-container
            class="flex-d align-stretch pa-0"
            fill-height
            style="z-index: 1; overflow: hidden;">
            <v-tabs v-model="panelTopTabs">
              <v-tab
                v-for="(plugin, index) in getPluginsByType('nav-panel-top-tabs')"
                :value="plugin.name"
              >
                <v-icon :icon="plugin.icon"/>
              </v-tab>
            </v-tabs>
            <v-window v-model="panelTopTabs">
              <v-window-item v-for="(plugin, index) in getPluginsByType('nav-panel-top-tabs')" :value="plugin.name"  style="height: calc(100vh - 148px);">
                <component :is="plugin.component"/>
              </v-window-item>
            </v-window>
        </v-container>
        <div style="position: absolute; bottom: 5px; width: 100%;" class="control-panel-bottom">
          <v-divider style="margin-bottom: 15px;margin-right: 5px;"/>
          <template
            v-for="(plugin, index) in getPluginsByType('nav-panel-bottom-icons')"
            :value="plugin.name"
          >
            <v-icon :icon="plugin.icon"/>
          </template>
          <v-icon
              help-topic="dragResizePanel"
              class="control-panel-icon mb-2"
              title="Use this slider to resize the control panel for some tabs"
              style="cursor: ew-resize; float: right;"
              color="secondary"
              @mousedown="startPanelDrag">
              mdi-drag-vertical
          </v-icon>
        </div>
    </v-navigation-drawer>
</template>
<script lang="typescript">
import {mapWritableState, mapActions, mapState} from "pinia";
import {useStore as useInputStore} from "@plastic-io/graph-editor-vue3-input";
import {useStore as useCanvasStore} from "@plastic-io/graph-editor-vue3-canvas";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
export default {
    name: "control-panel",
    watch: {
        "mouse.y"() {
            this.mouseTranslate();
        },
        "mouse.x"() {
            this.mouseTranslate();
        },
        panelTopTabs() {
            if (!this.navWidths[this.panelTopTabs]) {
                this.navWidths[this.panelTopTabs] = 400;
            }
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
          'events',
          'plugins',
          'panelPlugins',
        ]),
        ...mapState(useCanvasStore, [
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
        gutterStyle: function () {
            return {
                width: (this.navWidth - this.iconGutterSize) + "px",
            };
        },
        navStyle: function() {
            return {
                width: this.panel ? (this.navWidths[this.panelTopTabs] + "px") : "250px",
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
                    this.panelDragging.w +
                    (this.mouse.x - this.panelDragging.x);
            }
        },
        startPanelDrag() {
            const el = document.getElementsByClassName('graph-nav-drawer')[0];
            el.style.transition = 'none';
            this.panelDragging = {
                x: this.mouse.x,
                y: this.mouse.y,
                w: this.navWidths[this.panelTopTabs]
            };
            const dragEnd = () => {
                this.panelDragging = false;
                el.style.transition = undefined;
                usePreferencesStore().$patch({
                    preferences: {
                        uiSize: {
                            [this.panelTopTabs]: this.navWidths[this.panelTopTabs],
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
        document.onmousemove = this.mousemove;
    },
    data: () => {
        return {
            mouse: {
                x: 0,
                y: 0,
            },
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
    }
};
</script>
<style>
.main-nav {
    padding-right: 18px;
    width: 100%;
}
.icon-nav .v-icon.v-icon:after {
    display: none;
}
.icon-nav {
    border: solid 1px black;
    width: 43px;
    right: 0;
    position: absolute;
    height: calc(100vh - 48px);
    padding: 8px;
}
.control-panel-icon {
    margin-bottom: 10px;
}
.control-panel-bottom .control-panel-icon:last-child {
    margin-bottom: 0;
}
</style>
