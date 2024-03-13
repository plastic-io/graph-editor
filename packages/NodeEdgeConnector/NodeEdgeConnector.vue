<template>
    <div v-if="!presentation" @mousemove.stop>
        <div @mousemove.stop
            @mousedown.stop
            @mouseover="expand = true;"
            @mouseout="expand = false;">
            <div :style="connectorValueStyle" v-show="expand">
                <div class="connector-controls">
                    
                    <div>
                        <div class="d-inline-block" @wheel="scrollIndex($event)">
                            <v-icon @click="setIndex(index - 1)" icon="mdi-arrow-left-bold-box-outline" title="Previous Event"/>
                            {{index + 1}}/{{activityCounts.started}}
                            <v-icon @click="setIndex(index + 1)" icon="mdi-arrow-right-bold-box-outline" title="Next Event"/>
                        </div>
                        <v-icon @click="clearActivity" icon="mdi-text-box-remove-outline" title="Clear events for this node"/>
                        <div class="d-inline-block" style="width: 150px;">
                            <span class="rounded-pill connector-meta-info">
                                {{activityTime}}ms
                            </span>
                            <span class="rounded-pill connector-meta-info">
                                typeof {{typeof activityValue}}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            <div :class="{'connector-info-value': true, 'connector-info-value-expanded': expand, drop: activeConnector}"
                v-if="preferences.showConnectorActivity && activityValue !== undefined"
                :style="connectorValueStyle">
                <div>
                    <div class="connector-value-info">
                        {{formattedValue}}
                    </div>
                </div>

            </div>
        </div>
        <div
            v-if="!presentation"
            class="edge-connector"
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
import {toJSON} from 'flatted';
import {useStore as useInputStore} from "@plastic-io/graph-editor-vue3-input";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
import colors from "vuetify/lib/util/colors";
function getColor(key: string) {
    return (colors as {[key: string]: any})[key].base;
}
export default {
    name: "edge-connector",
    props: {
        connector: Connector,
        node: Node,
        edge: Edge,
    },
    data() {
        return {
            dropTimer: null,
            drawTimeout: null,
            connectorTimeout: null,
            graphStore: useGraphStore(),
            durations: [],
            index: 0,
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
          'historyPosition',
          'startTime',
          'redrawConnectorVersion',
        ]),
        ...mapState(useGraphStore, [
          'presentation',
          'hoveredPort',
          'addingConnector',
          'graphSnapshot',
          'view',
          'translating',
          'inRewindMode',
          'ltrPct',
          'selectedConnectors',
          'hoveredConnector',
          'errorConnectors',
          'watchConnectors',
          'activityConnectors',
          'movingConnector',
        ]),
        startEvents() {
            return this.activityInfo.filter((i) => i.activityType === "start");
        },
        endEvents() {
            return this.activityInfo.filter((i) => i.activityType === "end");
        },
        activityCounts() {
            if (!this.activityInfo) {
                return {
                    total: 0,
                    started: 0,
                    ended: 0,
                    pending: 0,
                    pct: 0,
                };
            }
            const total = this.activityInfo.length;
            const started = this.startEvents.length;
            const ended = this.endEvents.length;
            return {
                total,
                started,
                ended,
                pct: (ended / started) * 100,
            }
        },
        formattedValue() {
            let v;
            try {
                v = JSON.stringify(this.activityValue, null, '\t');
            } catch {
                v = this.activityValue;
            };
            return v;
        },
        activity() {
            return (this.activityInfo && this.startEvents[this.index] !== undefined)
                ? this.startEvents[this.index] : {event: { value: undefined, time: 0}};
        },
        activityTime() {
            return this.activity.event.time - this.startTime;
        },
        activityValue() {
            return this.activity.event.value;
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
            return this.hoveredConnector && this.hoveredConnector.connector.id === this.connector.id || this.expand;
        },
        output() {
            const node = (this.localGraph || this.graphSnapshot).nodes.find((v) => {
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
            const node = (this.localGraph || this.graphSnapshot).nodes.find((v) => {
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
        connectorCountStyle() {
            const w = this.width * this.ratio;
            const h = this.height * this.ratio;
            return {
                position: "absolute",
                textAlign: 'center',
                borderRadius: '20px',
                width: '35px',
                overflow: 'visible',
                fontWeight: 'bold',
                fontSize: '10px',
                transform: 'translate(-50%)',
                background: getColor(this.preferences.appearance.connectors.controlFillStyle),
                left: this.x + (w / 2) + 7 + "px",
                top: this.y + (h / 2) + 15 + "px",
            };
        },
        connectorValueStyle() {
            const w = this.width * this.ratio;
            const h = this.height * this.ratio;
            return {
                transform: 'translate(-50%)',
                position: "absolute",
                left: this.x + ((w / 2)) + "px",
                top: this.y + (h / 2) + 23 + "px",
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
        redrawConnectorVersion() {
            this.redraw();
        },
        activityConnectors: {
            handler: function () {
                const key = this.connector.id;
                const activity = this.activityConnectors[key];
                if (activity && activity.length > 0) {
                    if (activity[activity.length - 1].activityType === "start") {
                        this.activeConnector = true;
                    }
                    if (activity[activity.length - 1].activityType === "end") {
                        this.dropTimer = setTimeout(() => {
                            this.activeConnector = false;
                        }, 150);
                    }
                    // if the index is set to the last event, keep it at the last event
                    if (this.index === this.startEvents.length - 2) {
                        this.setIndex(this.startEvents.length - 1);
                    }
                    this.redraw();
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
        translating: {
            handler: function () {
                this.redraw();
            },
            deep: true,
        },
        view: {
            handler: function () {
                clearTimeout(this.drawTimeout);
                this.drawTimeout = setTimeout(() => {
                    this.redraw();
                }, 100);
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
        scrollIndex(e) {
            const delta =
                ((e as any).wheelDelta ? (e as any).wheelDelta / 120 : -e.deltaY / 3) * 0.01;
            this.setIndex(this.index + (delta > 0 ? 1 : -1));
            e.preventDefault();
            e.stopPropagation();
        },
        clearActivity() {
            this.activityConnectors[this.connector.id] = [];
            this.expand = false;
        },
        setIndex(val) {
            this.index = Math.max(0, Math.min(this.startEvents.length - 1, val));
        },
        getColor(key) {
            return getColor(key);
        },
        redraw() {
            if (this.presentation) {
                return;
            }
            this.calls += 1;
            this.setContext();
            if (this.isInViewport()) {
                bezier(this);
            }
        },
        setContext() {
            if (this.presentation || !this.$refs.canvas) {
                return;
            }
            this.ctx = this.$refs.canvas.getContext("2d");
            this.ctx.scale(this.ratio, this.ratio);
        },
        isInViewport() {
            return true;
            if (!this.$refs.canvas) {
                return true;
            }
            const rect = this.$refs.canvas.getBoundingClientRect();
            return (
                rect.top < window.innerHeight && rect.bottom > 0 &&
                rect.left < window.innerWidth && rect.right > 0
            );
        }
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
        this.localGraph = this.graphSnapshot;
        this.connections = JSON.parse(JSON.stringify({
            input: this.input,
            output: this.output,
        }));
        this.setContext();
        this.redraw();
    },
};
</script>
<style scoped>
    .connector-controls {
        text-align: left;
        white-space: nowrap;
        top: -30px;
        left: 50%;
        height: 100px;
        transform: translate(-50%);
        position: absolute;
    }
    .connector-value-info {
        background: rgba(var(--v-theme-background));
        padding: 2px 10px;
        margin: 2px 6px 3px 6px;
        border-radius: 3px;
    }
    .connector-meta-info {
        background: rgba(var(--v-theme-info));
        padding: 2px 10px;
        margin: 2px 6px;
    }
    .connector-info-value {
        white-space: nowrap;
        pointer-events: all;
        position: absolute;
        height: inherit;
        width: inherit;
        border-radius: 5px;
        background: rgba(var(--v-theme-info));
        border-color: rgba(var(--v-border-color));
        border-style: solid;
        border-width: 1px;
        overflow: scroll;
        z-index: 2;
        transition: all 0.3s ease-out;
        padding: 7px;
        padding-left: 10px;
        max-width: 70vw;
        max-height: 40vh;
    }
    .connector-info-value-expanded {
        height: inherit;
        width: inherit;
        overflow: auto;
        transition: height, width, opacity 0.3s ease-out;
        z-index: 3;
    }
    .edge-connector {
        pointer-events: none;
        position: absolute;
        z-index: -1597463006;
    }
    .drop {
        background: rgba(var(--v-theme-warning));
    }
</style>
