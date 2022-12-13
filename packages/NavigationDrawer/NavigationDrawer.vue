<template>
    <v-navigation-drawer
        disable-resize-watcher
        permanent
        :style="navStyle"
        class="nav-drawer"
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
              <v-window-item v-for="(plugin, index) in getPluginsByType('nav-panel-top-tabs')" :value="plugin.name">
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
import {useStore as useGraphCanvasStore} from "@plastic-io/graph-editor-vue3-graph-canvas";
import {useStore as useGraphOrchestratorStore} from "@plastic-io/graph-editor-vue3-graph-orchestrator";
export default {
    name: "control-panel",
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
        ...mapWritableState(useGraphOrchestratorStore, [
          'navWidth',
        ]),
        ...mapState(useGraphOrchestratorStore, [
          'log',
          'showHelp',
          'historyPosition',
          'events',
          'plugins',
          'preferences',
          'panelPlugins',
        ]),
        ...mapState(useGraphCanvasStore, [
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
            let navWidth = this.navWidths[this.panelTopTabs];
            if (!navWidth) {
                navWidth = this.navWidth + "px";
            }
            return {
                // zIndex: this.showHelp ? 5 : undefined,
                width: this.panel ? navWidth : "250px",
                transition: 'none !important',
            };
        }
    },
    methods: {
        ...mapActions(useGraphOrchestratorStore, [
          'getPluginsByType',
        ]),
        mousemove(e) {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        },
        mouseTranslate() {
            if (this.panelDragging) {
                // this.$refs.nav.$el.style.transition = "none";
                this.navWidth =
                    this.panelDragging.w +
                    (this.mouse.x - this.panelDragging.x);
                // this.$refs.nav.$el.style.transition = undefined;
            }
        },
        startPanelDrag() {
            this.panelDragging = {
                x: this.mouse.x,
                y: this.mouse.y,
                w: this.navWidth
            };
            const dragEnd = () => {
                this.panelDragging = false;
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
.nav-drawer {
/*    margin-top: 24px;*/
/*    transition: width 0.25s;*/
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
