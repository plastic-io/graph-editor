<template>
    <div :style="graphCanvasStyle" v-if="localGraph" @drop="drop($event)" @dragover="dragOver($event)" :key="localVersion">
        <div
            :style="preferences.appearance.theme === 'dark' ? '' : 'filter: invert(1);'"
            :class="graphCanvasClasses"
        ></div>
        <edge-connector
            v-for="c in connectors"
            :key="c.connector.id + localGraph.version"
            :connector="c.connector"
            :edge="c.edge"
            :vector="c.vector"
        />
        <template v-if="!presentation">
            <graph-vector
                v-for="vector in localGraph.vectors"
                :key="vector.id"
                :vector="vector"
                :graph="localGraph"
                :presentation="false"
            />
        </template>
        <graph-presentation v-if="presentation"/>
        <div v-if="selectionRect.visible && !presentation" class="selection-rect" :style="selectionRectStyle"></div>
        <div v-if="selectedVectors.length > 0 && !presentation" class="bounding-rect" :style="boundingRectStyle"></div>
    </div>
</template>
<script>
import GraphPresentation from "./GraphPresentation";
import EdgeConnector from "./EdgeConnector";
import GraphVector from "./GraphVector";
import {mapState, mapActions, mapGetters, mapMutations} from "vuex";
import {diff} from "deep-diff";
import colors from "vuetify/lib/util/colors";
import {newId} from "../store/mutations"; 
export default {
    name: "graph-canvas",
    components: {GraphVector, EdgeConnector, GraphPresentation},
    props: {
        showGrid: Boolean
    },
    data() {
        return {
            localVersion: 0,
            dragged: null,
            localGraph: null,
        };
    },
    mounted() {
        this.$vuetify.theme.dark = this.preferences.appearance.theme === "dark";
        this.localGraph = this.graphSnapshot;
    },
    methods: {
        ...mapMutations([
            "addDroppedItem",
        ]),
        ...mapActions([
            "createNewVector",
            "addItem",
            "importItem",
        ]),
        dragOver(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "link";
        },
        drop(e) {
            if (e.dataTransfer.files.length > 0) {
                e.preventDefault();
                for (let x = 0; x < e.dataTransfer.files.length; x += 1) {
                    const file = e.dataTransfer.files[x];
                    if (file.type !== this.jsonMimeType) {
                        continue;
                    }
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        const parsedResult = JSON.parse(ev.target.result);
                        //  context.commit(e.type === "publishedVector" ? "addVectorItem" : "addGraphItem", e);
                        this.addDroppedItem({
                            x: e.clientX,
                            y: e.clientY,
                            ...{
                                id: newId(),
                                lastUpdate: file.lastModified,
                                description: file.name,
                                name: file.name.split("_")[0],
                                icon: parsedResult.properties.icon,
                                item: parsedResult,
                                version: parsedResult.version,
                                type: "droppedFile",
                            },
                        });
                    };
                    reader.readAsText(file);
                }
                return;
            }
            const jsonData = e.dataTransfer.getData(this.jsonMimeType);
            const plasticData = e.dataTransfer.getData(this.vectorMimeType);
            if (plasticData) {
                const data = JSON.parse(plasticData);
                if (data.type === "newVector") {
                    this.createNewVector({
                        x: e.clientX,
                        y: e.clientY,
                    });
                    return;
                }
                this.addItem({
                    x: e.clientX,
                    y: e.clientY,
                    ...data,
                });
            } else if (jsonData) {
                const data = JSON.parse(jsonData);
                this.importItem({
                    item: data,
                });
            }
        },
    },
    watch: {
        graphSnapshot: {
            handler: function () {
                // when this becomes unbound
                const changes = diff(this.localGraph, this.graphSnapshot);
                if (changes) {
                    this.localGraph = this.graphSnapshot;
                    this.localGraph.vectors.length;
                }
            },
            deep: true,
        },
    },
    computed: {
        ...mapGetters({
            getLoadingStatus: "getLoadingStatus",
        }),
        ...mapState({
            loading: state => state.loading,
            presentation: state => state.presentation,
            jsonMimeType: state => state.jsonMimeType,
            vectorMimeType: state => state.vectorMimeType,
            historyPosition: state => state.historyPosition,
            addingConnector: state => state.addingConnector,
            selectionRect: state => state.selectionRect,
            boundingRect: state => state.boundingRect,
            selectedVectors: state => state.selectedVectors,
            graphSnapshot: state => state.graphSnapshot,
            view: state => state.view,
            preferences: state => state.preferences,
        }),
        selectionRectStyle: function() {
            return {
                borderWidth: 0.5 / this.view.k + "px",
                left: this.selectionRect.x + "px",
                top: this.selectionRect.y + "px",
                width: this.selectionRect.width + "px",
                height: this.selectionRect.height + "px",
                borderColor: colors[this.preferences.appearance.selectionRectColor].base,
            };
        },
        boundingRectStyle: function() {
            return {
                borderWidth: 0.5 / this.view.k + "px",
                left: this.boundingRect.x + "px",
                top: this.boundingRect.y + "px",
                width: this.boundingRect.width + "px",
                height: this.boundingRect.height + "px",
                borderColor: colors[this.preferences.appearance.boundingRectColor].base,
            };
        },
        connectors: function () {
            let connectors = [];
            this.localGraph.vectors.forEach((vector) => {
                vector.edges.forEach((edge) => {
                    edge.connectors.forEach((connector) => {
                        connectors.push({
                            connector,
                            edge,
                            vector,
                        });
                    });
                });
            });
            if (this.addingConnector) {
                connectors.push({
                    connector: this.addingConnector.connector,
                    edge: this.addingConnector.edge,
                    vector: this.addingConnector.vector,
                });
            }
            return connectors;
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
        graphCanvasClasses: function () {
            const classes = [];
            if (!this.presentation) {
                classes.push("graph-canvas-container");
                if (this.showGrid) {
                    classes.push("grid");
                }
            }
            return classes.join(" ");
        },
    },
};
</script>
<style>
.bounding-rect {
    pointer-events: none;
    position: absolute;
    border-style: solid;
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
