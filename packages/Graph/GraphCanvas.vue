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
        <div
            x-graph-canvas
            :style="graphCanvasStyle"
            v-if="graphSnapshot && !presentation"
            :key="graphUpdateVersion"
            @drop="drop($event)"
            @dragover="dragOver($event)"
        >
            <div
                :style="preferences!.appearance.theme === 'dark' ? '' : 'filter: invert(1);'"
                :class="graphCanvasClasses"
            ></div>
            <node-edge-connector
                v-for="c in connectors"
                :key="c.connector.id + graphUpdateVersion"
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
        <keep-alive>
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
        </keep-alive>
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
            }, this.positionLocationSaveTimeout)
        },
        deep: true,
    },
  },
  methods: {
    ...mapActions(useGraphStore, [
        'drop',
        'updateGraphFromSnapshot',
    ]),
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
                overflow: "auto",
                height: "100vh",
                width: "100vw",
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
.graph-errors {
    position: fixed;
    right: 10px;
    top: 33px;
    width: 33%;
    min-width: 500px;
}
</style>