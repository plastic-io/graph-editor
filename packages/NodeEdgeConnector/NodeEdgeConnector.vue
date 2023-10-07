<template>
    <div>
        <div :class="{'connector-info-value': true, 'connector-info-value-expanded': expand}"
            v-if="preferences.showConnectorActivity && activityValue"
            @mousemove.stop
            @mousedown.stop
            @mouseover="expand = true;"
            @mouseout="expand = false;"
            :style="connectorValueStyle"
        >
            <div :class="{drop: activeConnector}"></div>
            {{activityValue}}
        </div>
        <div
            v-if="!presentation"
            :class="connectorClass"
            :style="connectorStyle">
            <canvas
                ref="canvas"
                :height="height * ratio"
                :width="width * ratio"/>
        </div>
    </div>
</template>
<script lang="ts">
import {Connector, Node, Edge} from "@plastic-io/plastic-io";
import {mapState} from "pinia";
import bezier from "./bezier";
import {diff} from "deep-diff";
import {useStore as useInputStore} from "@plastic-io/graph-editor-vue3-input";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
export default {
    name: "edge-connector",
    props: {
        connector: Connector,
        node: Node,
        edge: Edge,
    },
    data() {
        return {
            connectorTimeout: null,
            graphStore: useGraphStore(),
            durations: [],
            duration: 0,
            expand: false,
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
        ...mapState(usePreferencesStore, ['preferences',]),
        ...mapState(useInputStore, ['mouse']),
        ...mapState(useOrchestratorStore, [
          'inRewindMode',
          'presentation',
          'historyPosition',
        ]),
        ...mapState(useGraphStore, [
          'hoveredPort',
          'addingConnector',
          'graph',
          'graphSnapshot',
          'view',
          'translating',
          'ltrPct',
          'selectedConnectors',
          'hoveredConnector',
          'errorConnectors',
          'watchConnectors',
          'activityConnectors',
          'movingConnector',
        ]),
        activityValue() {
            return (this.activityInfo && this.activityInfo[0])
                ? this.activityInfo[0].event.value
                : ''
        },
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
            const node = (this.localGraph || this.graph).nodes.find((v) => {
                return v.id === this.connector.nodeId;
            }) ;
            const field = this.node.properties.outputs.find((output) => {
                return this.edge && this.edge.field === output.name;
            });
            const index = this.node.properties.outputs.indexOf(field);
            return {
                index,
                node: this.node,
                field
            };
        },
        input() {
            const node = (this.localGraph || this.graph).nodes.find((v) => {
                return v.id === this.connector.nodeId;
            }) ;
            const field = node ? node.properties.inputs.find((input) => {
                return this.connector.field === input.name;
            }) : null;
            const index = node ? node.properties.inputs.indexOf(field) : null;
            return {
                index,
                node,
                field,
            };
        },
        connectorClass() {
            if (this.activeConnector === null) {
                return "edge-connector";
            }
            return this.activeConnector ? "edge-connector edge-active" : "edge-connector edge-inactive";
        },
        connectorValueStyle() {
            const w = this.width * this.ratio;
            const h = this.height * this.ratio;
            return {
                position: "absolute",
                left: this.x + ((w / 2) - 75) + "px",
                top: this.y + (h / 1.8) + "px",
            };
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
        activityConnectors: {
            handler: function () {
                const key = this.connector.id;
                const activity = this.activityConnectors[key];
                if (activity && activity.length > 0) {
                    if (activity[activity.length - 1].activityType === "start") {
                        this.activeConnector = true;
                        this.redraw();
                        clearTimeout(this.connectorTimeout);
                        this.connectorTimeout = setTimeout(() => {
                            this.activeConnector = false;
                        }, 3000);
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
        node: {
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
            if (this.presentation || !this.$refs.canvas) {
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
        // in rewwind mode, nodes are a bit animated
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
    .connector-info-value {
        pointer-events: all;
        position: absolute;
        height: 40px;
        width: 150px;
        min-height: 25px;
        min-width: 150px;
        border-radius: 5px;
        background: rgba(var(--v-theme-info));
        border-color: rgba(var(--v-border-color));
        border-style: solid;
        border-width: 1px;
        overflow: scroll;
        z-index: 2;
        transition: all 0.3s ease-out;
        opacity: 0.8;
        padding: 7px;
        padding-left: 10px;
    }
    .connector-info-value-expanded {
        height: inherit;
        width: inherit;
        transition: all 0.3s ease-in;
        opacity: 1;
    }
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

    .drop {
      width: 10px;
      height: 10px;
      background-color: white;
      position: absolute;
      top: 50%;
      left: 50%;
      border-radius: 50%;
      animation: dropAnimation 1.5s;
      animation-timing-function: cubic-bezier(0.1, 0.7, 0.1);
      transform: translate(-20px, -60px) scale(2);
    }

    @keyframes dropAnimation {
      0% {
        width: 10px;
        height: 10px;
        top: 50%;
        left: 50%;
        opacity: 1;
      }
      100% {
        width: 200px;
        height: 200px;
        top: 0;
        left: 0;
        opacity: 0;
      }
}
</style>
