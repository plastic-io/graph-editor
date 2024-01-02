<template>
    <div>
        <div
            x-graph-canvas
            :style="graphCanvasStyle"
            v-if="graphSnapshot"
            @drop="drop($event)"
            @dragover="dragOver($event)"
        >
            <div
                :style="preferences!.appearance.theme === 'dark' ? '' : 'filter: invert(1);'"
                :class="graphCanvasClasses"
            ></div>
            <node-edge-connector
                v-for="c in connectors"
                :key="c.connector.id + graphSnapshot.version"
                :connector="c.connector"
                :edge="c.edge"
                :node="c.node"
            />
            <node
                v-for="node in graphSnapshot.nodes"
                :key="node.id"
                :node="node"
                :graph="graphSnapshot"
                :presentation="presentation"
            />
            <div v-if="selectionRect.visible && !presentation" class="selection-rect" :style="selectionRectStyle"></div>
            <div v-if="selectedNodes.length !== 0 && !presentation" class="bounding-rect" :style="boundingRectStyle"></div>
        </div>
    </div>
</template>
<script lang="ts">
import {mapWritableState, mapActions} from "pinia";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as useGraphStore} from "./store";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
import colors from "vuetify/lib/util/colors";
export default {
  name: 'graph-canvas',
  data: () => {
    return {
      innerHeight: 0,
      innerWidth: 0,
      positionLocationSaveTimeout: 750,
      positionTimeout: 0,
    }
  },
  watch: {
    graphSnapshot: {
        handler() {
            this.updateBoundingRect();
        },
        deep: true,
    },
    selectedNodes() {
        this.updateBoundingRect();
    },
    view: {
        handler() {
            clearTimeout(this.positionTimeout);
            this.positionTimeout = setTimeout(() => {
                this.updatePrefStore();
            }, this.positionLocationSaveTimeout)
        },
        deep: true,
    },
  },
  methods: {
    ...mapActions(useGraphStore, [
        'drop',
    ]),
    dragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "link";
    },
    updatePrefStore() {
      const preferencesStore = usePreferencesStore();
      preferencesStore.$patch({
        preferences: {
          uiSize: {
            ['view-location-' + this.graphSnapshot.id]: this.view,
          },
        },
      });
    },
  },
  mounted() {
    const resize = () => {
        this.innerWidth = window.innerWidth;
        this.innerHeight = window.innerHeight;
    };
    const view = JSON.parse(JSON.stringify(this.preferences.uiSize['view-location-' + this.graphSnapshot.id] || {x: 0, y: 0, k: 1}));
    this.view = view;
    document.addEventListener('resize', resize);
    resize();
  },
  computed: {
    ...mapWritableState(usePreferencesStore, ['preferences']),
    ...mapWritableState(useGraphStore, [
        'addingConnector',
        'updateBoundingRect',
        'systemBarOffset',
        'graphSnapshot',
        'view',
        'selectionRect',
        'selectedNodes',
        'el',
        'boundingRect',
        'presentation',
    ]),
    connectors: function () {
        let connectors = [];
        this.graphSnapshot.nodes.forEach((node) => {
            node.edges.forEach((edge) => {
                edge.connectors.filter(c => !!c).forEach((connector) => {
                    connectors.push({
                        connector,
                        edge,
                        node,
                    });
                });
            });
        });
        if (this.addingConnector) {
            connectors.push({
                connector: this.addingConnector.connector,
                edge: this.addingConnector.edge,
                node: this.addingConnector.node,
            });
        }
        return connectors;
    },
    selectionRectStyle: function() {
        return {
            borderWidth: 0.5 / this.view.k + "px",
            left: this.selectionRect.x + "px",
            top: this.selectionRect.y + "px",
            width: this.selectionRect.width + "px",
            height: this.selectionRect.height + "px",
            borderColor: colors[this.preferences!.appearance.selectionRectColor].base,
        };
    },
    boundingRectStyle: function() {
        const b = {
            borderWidth: 0.5 / this.view.k + "px",
            left: this.boundingRect.x + "px",
            top: this.boundingRect.y + "px",
            width: this.boundingRect.width + "px",
            height: this.boundingRect.height + "px",
            borderColor: colors[this.preferences!.appearance.boundingRectColor].base,
        }
        return b;
    },
    graphCanvasClasses: function () {
        const classes = [];
        if (!this.presentation) {
            classes.push("graph-canvas-container");
            if (this.preferences!.appearance.showGrid) {
                classes.push("grid");
            }
        }
        return classes.join(" ");
    },
    graphCanvasStyle: function () {
        if (this.presentation) {
            return {
                display: "flex"
            };
        }
        return {
            transform: `translate(${this.view.x}px, ${this.view.y}px) scale(${this.view.k})`,
        };
    },
  },
}
</script>
<style scoped>
.bounding-rect {
    pointer-events: none;
    position: absolute;
    border-style: solid;
    z-index: 2;
}
.selection-rect {
    position: absolute;
    border-style: dotted;
}
.graph-canvas-container {
    position: absolute;
    width: 10000vw;
    height: 10000vh;
    top: -5000vh;
    left: -5000vw;
    z-index: -1597463007;
}
.grid {
    /* creates grid pattern at 10px */
    background:
        linear-gradient(-90deg, rgba(128, 128, 128, .1) 1px, transparent 1px),
        linear-gradient(rgba(128, 128, 128, .1) 1px, transparent 1px),
        linear-gradient(-90deg, rgba(128, 128, 128, .1) 1px, transparent 1px),
        linear-gradient(rgba(128, 128, 128, .1) 1px, transparent 1px),
        linear-gradient(transparent 3px, #111 3px, #111 98px, transparent 98px),
        linear-gradient(-90deg, #222 1px, transparent 1px),
        linear-gradient(-90deg, transparent 3px, #111 3px, #111 98px, transparent 98px),
        linear-gradient(#222 1px, transparent 1px),
        #111;
    background-size:
        10px 10px,
        10px 10px,
        100px 100px,
        100px 100px,
        100px 100px,
        100px 100px,
        100px 100px,
        100px 100px;
}
</style>