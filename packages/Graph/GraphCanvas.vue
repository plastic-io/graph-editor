<template>
    <div>
        <component
            :is="graphPresentationComponent"
            v-if="graphSnapshot && presentation"
            :graph="graphSnapshot"
        />
        <component
            v-for="(style, index) in styles"
            :is="'style'"
            v-if="graphSnapshot && presentation"
            v-html="style"
            :key="index"
        />
        <canvas
            class="grid"
            :style="{backgroundColor: this.color(this.preferences!.appearance.backgroundColor)}"
            v-if="preferences!.appearance.showGrid"
            ref="grid"/>
        <div
            x-graph-canvas
            :style="graphCanvasStyle"
            v-if="graphSnapshot && !presentation"
            :key="graphUpdateVersion"
            @drop="drop($event)"
            @dragover="dragOver($event)"
        >
            <node-edge-connector
                v-for="c in connectors"
                :key="c.connector.id"
                :connector="c.connector"
                :edge="c.edge"
                :node="c.node"
            />
            <node
                v-for="node in sortedNodes"
                :key="node.id + graphUpdateVersion"
                :node="node"
                :graph="graphSnapshot"
                :presentation="presentation"
            />
            <div v-if="selectionRect.visible && !presentation" class="selection-rect" :style="selectionRectStyle"></div>
            <div v-if="selectedNodes.length !== 0 && !presentation" class="bounding-rect" :style="boundingRectStyle"></div>
        </div>
        <div style="position: fixed; top: 33px;left: 10px;" v-if="showGraphCodeEditor" v-show="!presentation">
            <monaco-code-editor
                style="opacity: 0.98"
                templateType="vue"
                language="html"
                :graphId="graphSnapshot.id"
                :errors="errors.filter(e => e.type === 'graph')"
                :value="graphTemplateValue"
                helpLink="https://plastic-io.github.io/plastic-io/interfaces/NodeInterface.html"
                @close="showGraphCodeEditor = false"
                @dirty="setIsDirty = $event"
                @save="saveGraphTemplate($event)"
            />
        </div>
        <div class="graph-errors" v-if="errors.length > 0">
            <v-alert color="error" @click="showGraphCodeEditor = true">
                <pre v-for="error in errors">{{error}}</pre>
            </v-alert>
        </div>

    </div>
</template>
<script lang="ts">
import {markRaw} from "vue";
import {mapWritableState, mapActions} from "pinia";
import {useStore as useGraphStore} from "./store";
import compileTemplate from "@plastic-io/graph-editor-vue3-compile-template";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import colors from "vuetify/lib/util/colors";
export default {
  name: 'graph-canvas',
  data: () => {
    return {
      compiledTemplate: null,
      errors: [],
      styles: [],
      innerHeight: 0,
      innerWidth: 0,
      positionLocationSaveTimeout: 750,
      positionTimeout: 0,
      graphUpdateVersion: 0,
    }
  },
  watch: {
    'preferences.appearance.showGrid'() {
        this.$nextTick(() => {
            this.updateGrid();
        });
    },
    'graphSnapshot.properties.template'() {
        this.loadTemplate();
    },
    graphSnapshot: {
        handler() {
            // force updates in rewind mode
            if (this.inRewindMode) {
                this.graphUpdateVersion += 1;
            }
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
            }, this.positionLocationSaveTimeout);
            this.updateGrid();
        },
        deep: true,
    },
  },
  methods: {
    ...mapActions(useGraphStore, [
        'drop',
        'updateGraphFromSnapshot',
    ]),
    color(color) {
        if (!colors[color]) {
            console.warn('Color selected that does not exist.  Returning default color shades.', color);
            return colors['shades'];
        }
        return colors[color] ? colors[color].base : colors['shades'];
    },
    drawGrid(canvas, context, translateX, translateY, scale) {
        const largeGridSize = scale > 1 ? 100 : 1000;
        const txPct = scale > 1 ? scale : scale + 1;
        const smallGridSize = largeGridSize / 10;
        const startOffset = scale > 1 ? 50 : 0;
        const majorLineInterval = 10; // Every 10th line is a major (thicker) line
        const majorLineWidth = 2 / scale; // Scaling the line width as well
        const minorLineWidth = 1 / scale; // Scaling the line width as well
        const width = canvas.width;
        const height = canvas.height;
        context.clearRect(0, 0, width, height);
        context.save();
        context.scale(scale, scale);
        const offsetX = translateX;
        const offsetY = translateY;
        // make the grid more transparent as you zoom out so not to overwhelm the user
        const tcp = Math.max(16, Math.floor(150 - (150 / txPct))).toString(16);
        const fcp = Math.max(90, Math.floor(255 - (255 / txPct))).toString(16);
        context.strokeStyle = this.color(this.preferences!.appearance.gridMinor) + tcp;
        context.beginPath();
        for (let x = (offsetX / scale) % smallGridSize; x < width / scale; x += smallGridSize) {
            context.lineWidth = minorLineWidth;
            context.moveTo(x, 0);
            context.lineTo(x, height / scale);
        }
        for (let y = (offsetY / scale) % smallGridSize; y < height / scale; y += smallGridSize) {
            context.lineWidth = minorLineWidth;
            context.moveTo(0, y);
            context.lineTo(width / scale, y);
        }
        context.stroke();
        context.strokeStyle = this.color(this.preferences!.appearance.gridMajor) + fcp;
        context.beginPath();
        for (let x = startOffset + (largeGridSize / 2) +  ((offsetX / scale) % largeGridSize); x < width / scale; x += largeGridSize) {
            context.lineWidth = minorLineWidth;
            context.moveTo(x, 0);
            context.lineTo(x, height / scale);
        }
        for (let y = startOffset + (largeGridSize / 2) + ((offsetY / scale) % largeGridSize); y < height / scale; y += largeGridSize) {
            context.lineWidth = minorLineWidth;
            context.moveTo(0, y);
            context.lineTo(width / scale, y);
        }
        context.stroke();
        context.restore();
    },
    updateGrid() {
        const canvas = this.$refs.grid;
        if (!canvas) { return; }
        canvas.height = window.innerHeight;
        canvas.width = window.innerWidth;
        const context = canvas.getContext('2d');
        this.drawGrid(canvas, context, this.view.x, this.view.y, this.view.k);
    },
    async loadTemplate() {
        const comp = await compileTemplate(this, this.graphSnapshot.id,
            this.graphSnapshot.properties.template);
        this.compiledTemplate = markRaw(comp);
        this.errors = comp.errors;
        this.styles = this.compiledTemplate.styles;
        this.errors.forEach((err) => {
            useOrchestratorStore().raiseError(this.graphSnapshot.id, err, 'vue');
        });
    },
    async saveGraphTemplate(val) {
        this.graphSnapshot.properties.template = val;
        await this.updateGraphFromSnapshot('Update Graph Presentation Template');
    },
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
  async mounted() {
    const resize = () => {
        this.innerWidth = window.innerWidth;
        this.innerHeight = window.innerHeight;
    };
    const view = JSON.parse(JSON.stringify(this.preferences.uiSize['view-location-' + this.graphSnapshot.id] || {x: 0, y: 0, k: 1}));
    if (this.graphSnapshot.properties.startInPresentationMode) {
        this.presentation = true;
    }
    this.view = view;
    document.addEventListener('resize', resize);
    resize();
    if (!this.graphSnapshot.properties.template) {
        this.graphSnapshot.properties.template = this.preferences!.defaultNewGraphTemplate;
    }
    await this.loadTemplate();
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
        'inRewindMode',
        'showGraphCodeEditor',
    ]),
    graphPresentationComponent() {
        return this.compiledTemplate ? this.compiledTemplate.component : 'div';
    },
    sortedNodes() {
        return this.graphSnapshot.nodes.sort((a, b) => {
            return (a.properties.presentation.sort || 0)
                - (b.properties.presentation.sort || 0);
        });
    },
    graphTemplateValue() {
        return this.graphSnapshot.properties.template;
    },
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
            borderColor: this.color(this.preferences!.appearance.selectionRectColor),
        };
    },
    boundingRectStyle: function() {
        const b = {
            borderWidth: 0.5 / this.view.k + "px",
            left: this.boundingRect.x + "px",
            top: this.boundingRect.y + "px",
            width: this.boundingRect.width + "px",
            height: this.boundingRect.height + "px",
            borderColor: this.color(this.preferences!.appearance.boundingRectColor),
        }
        return b;
    },
    graphCanvasStyle: function () {
        if (this.presentation) {
            return {
                overflow: "auto",
                height: "100vh",
                width: "100vw",
            };
        }
        return {
            transform: `translate(${this.view.x}px, ${this.view.y}px) scale(${this.view.k})`
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
.grid {
    pointer-events: none;
    height: 100vh;
    width: 100vw;
    position: absolute;
    top: 0;
    left: 0;
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
.graph-errors {
    position: fixed;
    right: 10px;
    top: 33px;
    width: 33%;
    min-width: 500px;
}
</style>