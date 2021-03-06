<template>
    <div
        v-if="!presentation"
        :class="connectorClass"
        :style="connectorStyle">
        <canvas
            ref="canvas"
            :height="height * ratio"
            :width="width * ratio"/>
    </div>
</template>
<script>
import {Connector, Vector, Edge} from "@plastic-io/plastic-io";
import {mapState} from "vuex";
import bezier from "./bezier";
import {diff} from "deep-diff";
export default {
    name: "edge-connector",
    props: {
        connector: Connector,
        vector: Vector,
        edge: Edge,
    },
    data() {
        return {
            durations: [],
            duration: 0,
            activeConnector: null,
            localGraph: null,
            connections: null,
            sourceRect: null,
            targetRect: null,
            source: null,
            target: null,
            height: 20,
            width: 20,
            x: 0,
            y: 0,
            ctx: null,
            ratio: 1,
            calls: 0,
        };
    },
    computed: {
        ...mapState({
            inRewindMode: state => state.inRewindMode,
            presentation: (state) => state.presentation,
            historyPosition: (state) => state.historyPosition,
            addingConnector: (state) => state.addingConnector,
            graph: (state) => state.graph,
            graphSnapshot: (state) => state.graphSnapshot,
            view: (state) => state.view,
            mouse: (state) => state.mouse,
            translating: (state) => state.translating,
            preferences: (state) => state.preferences,
            selectedConnectors: state => state.selectedConnectors,
            hoveredConnector: state => state.hoveredConnector,
            errorConnectors: state => state.errorConnectors,
            watchConnectors: state => state.watchConnectors,
            activityConnectors: state => state.activityConnectors,
            movingConnector: state => state.movingConnector,
        }),
        activityInfo() {
            return this.activityConnectors[this.connector.id];
        },
        watched() {
            return this.watchConnectors.map((i) => i.id).indexOf(this.connector.id) !== -1;
        },
        selected() {
            return this.selectedConnectors.map((i) => i.id).indexOf(this.connector.id) !== -1;
        },
        errored() {
            return this.errorConnectors.map((i) => i.id).indexOf(this.connector.id) !== -1;
        },
        hovered() {
            return this.hoveredConnector && this.hoveredConnector.connector.id === this.connector.id;
        },
        output() {
            const field = this.vector.properties.outputs.find((output) => {
                return this.edge.field === output.name;
            });
            const index = this.vector.properties.outputs.indexOf(field);
            return {
                index,
                vector: this.vector,
                field
            };
        },
        input() {
            const vector = (this.localGraph || this.graph).vectors.find((v) => {
                return v.id === this.connector.vectorId;
            });
            const field = vector ? vector.properties.inputs.find((input) => {
                return this.connector.field === input.name;
            }) : null;
            const index = vector ? vector.properties.inputs.indexOf(field) : null;
            return {
                index,
                vector,
                field
            };
        },
        connectorClass() {
            if (this.activeConnector === null) {
                return "edge-connector";
            }
            return this.activeConnector ? "edge-connector edge-active" : "edge-connector edge-inactive";
        },
        connectorInfoStyle() {
            return {
                position: "fixed",
                width: "500px",
                left: ((this.mouse.x - this.view.x) / this.view.k) + 10 + "px",
                top: ((this.mouse.y - this.view.y) / this.view.k) + 10 + "px",
            };
        },
        connectorStyle() {
            return {
                display: this.presentation ? "none" : "block",
                height: (this.height * this.ratio) + "px",
                width: (this.width * this.ratio) + "px",
                left: this.x + "px",
                top: this.y + "px",
            };
        },
    },
    watch: {
        activeConnector() {
            this.redraw();
        },
        activityConnectors: {
            handler: function () {
                const key = this.connector.id;
                const activity = this.activityConnectors[key];
                if (activity && activity.length > 0) {
                    if (activity[activity.length - 1].activityType === "start") {
                        this.activeConnector = true;
                    } else {
                        this.activeConnector = false;
                    }
                }
            },
            deep: true,
        },
        graphSnapshot: {
            handler: function () {
                this.localGraph = this.graphSnapshot;
                this.redraw();
            },
            deep: true,
        },
        graph: {
            handler: function () {
                this.localGraph = this.graph;
                this.redraw();
            },
            deep: true,
        },
        translating: {
            handler: function () {
                this.redraw();
            },
            deep: true,
        },
        movingConnector: {
            handler: function () {
                this.redraw();
            },
            deep: true,
        },
        mouse: {
            handler: function () {
                if (this.movingConnector || this.addingConnector) {
                    this.redraw();
                }
            },
            deep: true,
        },
        selectedConnectors: {
            handler: function () {
                this.redraw();
            },
        },
        historyPosition: {
            handler: function () {
                this.redraw();
            },
        },
        hoveredConnector: {
            handler: function () {
                this.redraw();
            },
        },
        vector: {
            handler: function () {
                const o = {
                    input: this.input,
                    output: this.output,
                };
                if (diff(this.connections, o)) {
                    this.connections = JSON.parse(JSON.stringify(o));
                    this.redraw();
                }
            },
            deep: true,
        },
    },
    methods: {
        redraw() {
            this.$nextTick(() => {
                if (this.presentation) {
                    return;
                }
                this.calls += 1;
                this.setContext();
                bezier(this);
            });
        },
        setContext() {
            if (this.presentation) {
                return;
            }
            this.ctx = this.$refs.canvas.getContext("2d");
            this.ctx.scale(this.ratio, this.ratio);
        },
    },
    updated() {
        if (!this.inRewindMode) {
            return this.redraw();
        }
        // in rewwind mode, vectors are a bit animated
        // this requires a timeout to allow the dom to get
        // the correct position
        [0, 25, 100, 125, 250].forEach((n) => {
            setTimeout(() => {
                this.redraw();
            }, n);
        });
    },
    mounted() {
        this.localGraph = this.graph;
        this.connections = JSON.parse(JSON.stringify({
            input: this.input,
            output: this.output,
        }));
        this.setContext();
        this.redraw();
    },
};
</script>
<style>
    .edge-inactive {
        animation-duration: 0.5s;
        animation-name: edge-deactivate;
    }
    .edge-active {
        animation-duration: 0.5s;
        animation-name: edge-activate;
    }
    .edge-connector {
        pointer-events: none;
        position: absolute;
        z-index: -1597463006;
    }
    @keyframes edge-deactivate {
        from {
            opacity: 0.5;
        }
        to {
            opacity: 1;
        }
    }
    @keyframes edge-activate {
        from {
            opacity: 1;
        }
        to {
            opacity: 0.5;
        }
    }

</style>
