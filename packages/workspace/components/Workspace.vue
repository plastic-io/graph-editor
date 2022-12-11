<template>
    <v-app class="graph-editor" :style="`background: ${bgColor};`">
        <error-interstitial v-if="notFound" />
        <template v-if="graph && !graph.err">
            <v-system-bar
                class="top-system-bar"
                v-if="!presentation && panelVisibility"
                ref="topBar"
                style="z-index: 2;white-space: nowrap; top: 0; position: fixed; width: 100vw;">
                <div
                    title="Graph ID"
                    style="padding-right: 10px;cursor: pointer;">
                    <v-icon help-topic="openGraph" @click="openGraph" title="Show open graph dialog (^ + O)">
                        mdi-folder
                    </v-icon>
                    <span v-if="inRewindMode">
                        Rewinding...
                    </span>
                    <i v-else style="display: inline-block; width: 75px; overflow: visible;" help-topic="saveStatus" v-html="pending ? 'Saving...' : 'Saved'"/>
                </div>
                <v-spacer style="margin-right: 5%;"/>
                <span help-topic="documentName" class="pa-1">
                    {{ graph.properties.name || "Untitled" }}
                </span>
                <span>-</span>
                <span help-topic="plastic" class="pa-1">Plastic-IO</span>
                <v-spacer/>
                <shared-users/>
                <span>
                    <v-divider vertical style="margin: 5px;"/>
                    <v-icon :disabled="historyPosition === 0 || events.length === 0"
                        @click="undo"
                        help-topic="undo"
                        title="Undo last action (^ + Z)">mdi-undo-variant</v-icon>
                    <v-icon :disabled="historyPosition === events.length"
                        @click="redo"
                        help-topic="redo"
                        title="Redo last undone action (^ + Shift + Z)">mdi-redo-variant</v-icon>
                    <v-divider vertical style="margin: 5px;"/>
                    <v-icon :disabled="selectedNodes.length === 0"
                        @click="duplicateSelection"
                        help-topic="duplicate"
                        title="Duplicate selected nodes (^ + Shift + D)">mdi-content-duplicate</v-icon>
                    <v-divider vertical style="margin: 5px;"/>
                    <v-icon :disabled="selectedNodes.length < 2"
                        @click="groupSelected"
                        help-topic="group"
                        title="Group (^ + G)">mdi-group</v-icon>
                    <v-icon :disabled="primaryGroup === null"
                        @click="ungroupSelected"
                        help-topic="ungroup"
                        title="Ungroup (^ + Shift + G)" >mdi-ungroup</v-icon>
                    <v-divider vertical style="margin: 5px;"/>
                    <v-icon
                        @click="bringForward"
                        help-topic="bringForward"
                        title="Bring forward (^ + ])">mdi-arrange-bring-forward</v-icon>
                    <v-icon
                        @click="bringToFront"
                        help-topic="bringToFront"
                        title="Bring to front (^ + Shift + ])">mdi-arrange-bring-to-front</v-icon>
                    <v-icon
                        @click="sendBackward"
                        help-topic="sendBackward"
                        title="Send backward (^ + [)">mdi-arrange-send-backward</v-icon>
                    <v-icon
                        @click="sendToBack"
                        help-topic="sendToBack"
                        title="Send to back (^ + Shift + [)">mdi-arrange-send-to-back</v-icon>
                    <v-divider vertical style="margin: 5px;"/>
                    <v-icon
                        help-topic="deleteSelected"
                        @click="deleteSelected"
                        title="Delete selected (delete)"
                        :disabled="selectedNodes.length === 0 && selectedConnectors === 0">mdi-delete</v-icon>
                    <v-divider vertical style="margin: 5px;"/>
                    <v-icon
                        @click="showHelp = !showHelp"
                        help-topic="toggleHelp"
                        :color="showHelp ? 'info' : ''"
                        title="Help">mdi-help-circle-outline</v-icon>
                </span>
                <user-panel :size="17"/>
            </v-system-bar>
            <div :style="showHelp ? 'pointer-events: none;' : ''">
                <workspace-control-panel v-if="!presentation && panelVisibility" ref="panel"/>
            </div>
            <div :class="presentation ? '' : 'graph-container'" :style="graphContainerStyle">
                <graph-canvas
                    :class="translating && mouse.lmb ? 'no-select' : ''"
                    :showGrid="preferences.appearance.showGrid && !presentation"
                ></graph-canvas>
            </div>
            <v-system-bar
                v-if="!presentation && panelVisibility"
                ref="bottomBar"
                style="position: absolute; z-index: 2; bottom: 0; width: 100vw; top: inherit !important;"
                class="no-select bottom-system-bar"
            >
                <div
                    help-topic="mouseCoordinates"
                    title="Mouse Coordinates"
                    style="width: 110px;cursor: crosshair;">
                    <v-icon>mdi-crosshairs-gps</v-icon>{{ Math.floor((mouse.x - view.x) / view.k) }} : {{ Math.floor((mouse.y - view.y) / view.k) }}
                </div>
                <div
                help-topic="selectionCoordinates"
                title="Selection Coordinates"
                style="width: 240px;cursor: crosshair;">
                    <v-icon>mdi-selection</v-icon>
                        x: {{Math.floor(selectionRect.x)}}
                        y: {{Math.floor(selectionRect.x)}}
                        h: {{Math.floor(selectionRect.height)}}
                        w: {{Math.floor(selectionRect.width)}}
                </div>
                <v-spacer/>
                <div help-topic="selectedNodes" title="Selected Nodes / Total Nodes" style="padding-right: 10px;cursor: pointer;">
                    <v-icon>mdi-network</v-icon>{{ selectedNodes.length }}/{{ graph.nodes.length }}
                </div>
                <div help-topic="viewportLocation" title="Viewport localtion" style="padding-right: 10px;cursor: crosshair;" @click="resetView">
                    <v-icon>mdi-crosshairs-gps</v-icon>x:{{ view.x.toFixed(0) }} y:{{ view.y.toFixed(0) }}
                </div>
                <v-icon title="Zoom Out (^ + -)" style="cursor: pointer;" @click="zoomOut">mdi-magnify-minus-outline</v-icon>
                <div
                    help-topic="viewportZoom"
                    @click="resetZoom"
                    title="Zoom Level"
                    style="padding-right: 5px;cursor: crosshair;">
                    {{ (view.k * 100).toFixed(2) }}%
                </div>
                <v-icon
                    @click="zoomIn"
                    title="Zoom In (^ + +)"
                    style="padding-right: 10px;cursor: pointer;"
                    >mdi-magnify-plus-outline</v-icon>
                <v-icon
                    help-topic="showConnectorView"
                    title="Show Connector Information"
                    @click="showConnectorView = !showConnectorView"
                    style="padding-right: 10px;cursor: pointer;"
                    :color="showConnectorView ? 'info' : ''"
                    >mdi-information-outline</v-icon>
                <v-icon
                    help-topic="toggleLabels"
                    title="Toggle Input/Output Labels"
                    @click="preferences.showLabels = !preferences.showLabels"
                    style="padding-right: 10px;cursor: pointer;"
                    :color="preferences.showLabels ? 'info' : ''"
                    >{{preferences.showLabels ? 'mdi-label' : 'mdi-label-off'}}</v-icon>
                <v-icon
                    title="Toggle Grid Visibility"
                    @click="preferences.appearance.showGrid = !preferences.appearance.showGrid"
                    help-topic="toggleGrid"
                    style="padding-right: 10px;cursor: pointer;"
                    :color="preferences.appearance.showGrid ? 'info' : ''"
                    >mdi-grid</v-icon>
                <v-icon
                    title="Toggle Map Visibility"
                    @click="preferences.showMap = !preferences.showMap"
                    help-topic="toggleMap"
                    style="padding-right: 10px;cursor: pointer;"
                    :color="preferences.showMap ? 'info' : ''"
                    >mdi-map</v-icon>
                <v-icon
                    title="Toggle Lock"
                    @click="locked = !locked"
                    help-topic="toggleLock"
                    :color="locked ? 'info' : ''"
                    style="padding-right: 10px;cursor: pointer;"
                    >{{locked ? 'mdi-lock' : 'mdi-lock-open'}}</v-icon>
                <v-icon
                    title="Toggle Presentation (Alt + `)"
                    @click="presentation = !presentation"
                    help-topic="togglePresentation"
                    :color="presentation ? 'info' : ''"
                    style="padding-right: 10px;cursor: pointer;"
                    >{{presentation ? 'mdi-presentation-play' : 'mdi-presentation'}}</v-icon>
            </v-system-bar>
        </template>
        <v-sheet hide-overlay inset :timeout="2000" v-show="presentationWarning" multi-line>
            <v-alert>
                <v-row>
                    <v-col>Press Alt + ` to toggle Presentation Mode</v-col>
                </v-row>
            </v-alert>
        </v-sheet>
        <v-snackbar :timeout="0" v-model="localShowError" :top="!graph" color="transparent">
            <v-alert class="pa-4" type="error" prominent>
                <v-row no-gutters>
                    <v-col class="d-flex">
                        <h2>Error</h2>
                        <v-spacer />
                        <v-icon class="error-close-btn mt-n8 mr-n3" @click="clearError">mdi-close-circle</v-icon>
                    </v-col>
                </v-row>
                <v-row no-gutters>
                    <v-col>{{localErrorMessage}}</v-col>
                </v-row>
            </v-alert>
        </v-snackbar>
        <v-progress-linear v-if="!graph && !localShowError" indeterminate></v-progress-linear>
        <help-overlay v-if="showHelp" @close="toggleHelp" style="z-index: 14;"/>
        <component :is="'style'" v-if="!presentation">
            html, body {
                overflow: hidden;
            }
        </component>
        <shared-mouse/>
        <node-edge-connector v-if="showConnectorView" @close="showConnectorView = false;" :activity="hoveredActivity"/>
        <v-snackbar :timeout="2000" :model-value="showInfo" @update:model-value="clearInfo">
            {{infoMessage}}
        </v-snackbar>
        <v-sheet hide-overlay inset v-show="showAnnoyingHelpMessage">
            <v-alert type="info" prominent color="primary" colored-border elevation="2" middle icon="mdi-help-circle-outline">
                <v-row>
                    <v-col>
                        <h2>Welcome to the Plastic-IO Graph Editor</h2>
                    </v-col>
                </v-row>
                <v-row>
                    <v-col>
                        Click the <v-icon>mdi-help-circle-outline</v-icon> in the upper right corner for contextual help.
                    </v-col>
                </v-row>
                <v-row>
                    <v-col>
                        To start building, select <v-icon>mdi-library</v-icon> on the left, then click and drag an item from the library onto your graph.
                    </v-col>
                </v-row>
                <v-row>
                    <v-col>
                        Or double click on the canvas to create a new node.
                    </v-col>
                </v-row>
                <v-row>
                    <v-col>
                        <i style="font-size: 0.8rem;">&bull; To disable this message, click on <v-icon>mdi-cogs</v-icon> settings, then click the "Graph" section, then turn off "Show Help Messages".</i>
                    </v-col>
                </v-row>
            </v-alert>
        </v-sheet>
        <graph-rewind v-if="rewindVisible"/>
        <mini-map-info v-if="preferences.showMap && !presentation"/>
    </v-app>
</template>
<script>
import {mapWritableState, mapActions, mapState} from "pinia";
import GraphMap from "@plastic-io/graph-editor-vue3-mini-map-info";
import ErrorPage from "@plastic-io/graph-editor-vue3-error-interstitial";
import GraphRewind from "@plastic-io/graph-editor-vue3-graph-rewind";
import {useStore as useInputStore} from "@plastic-io/graph-editor-vue3-input";
import {useStore as useGraphCanvasStore} from "@plastic-io/graph-editor-vue3-graph-canvas";
import {useStore as useGraphOrchestratorStore} from "@plastic-io/graph-editor-vue3-graph-orchestrator";
import { useTheme } from 'vuetify';
export default {
    name: "GraphEditor",
    props: {
        route: Object,
    },
    computed: {
        ...mapWritableState(useGraphOrchestratorStore, [
            'translating',
            'selectedNodes',
            'preferences',
        ]),
        ...mapWritableState(useInputStore, [
            'mouse',
            'keys',
            'buttonMap',
        ]),
        ...mapWritableState(useGraphCanvasStore, [
            'graph',
            'view',
            'selectionRect',
            'hoveredNode',
            'hoveredPort',
        ]),
        ...mapState(useGraphOrchestratorStore, [
            'notFound',
            'inRewindMode',
            'rewindVisible',
            'showInfo',
            'infoMessage',
            'dataProviders',
            'pendingEvents',
            'activityConnectors',
            'pathPrefix',
            'showHelp',
            'panelVisibility',
            'nodeMimeType',
            'showError',
            'error',
            'presentation',
            'locked',
            'events',
            'historyPosition',
            'primaryGroup',
            'groupNodes',
            'boundingRect',
            'selectionRect',
            'selectedConnectors',
            'hoveredConnector',
        ]),
        pending: function() {
            return Object.keys(this.pendingEvents).length;
        },
        hoveredActivity: function() {
            if (!this.hoveredConnector && this.selectedConnectors.length === 0) {
                return null;
            }
            const key = this.hoveredConnector ? this.hoveredConnector.connector.id : this.selectedConnectors[0].id;
            return this.activityConnectors[key];
        },
        graphContainerStyle: function() {
            let cursor = "";
            if ((this.mouse.lmb && this.translate) || this.mouse.mmb) {
                cursor = "grabbing";
            } else if (this.keys[this.spaceKeyCode]) {
                cursor = "grab";
            } else if (this.hoveredConnector) {
                cursor = "move";
            }
            return {
                pointerEvents: this.showHelp ? "none" : undefined,
                cursor
            };
        },
    },
    methods: {
        ...mapActions(useGraphCanvasStore, [
            'open',
            'createNewNode',
        ]),
        ...mapActions(useInputStore, [
            'keydown',
            'keyup',
        ]),
        ...mapActions(useGraphOrchestratorStore, [
            'clearInfo',
            'undo',
            'redo',
            'duplicateSelection',
            'groupSelected',
            'ungroupSelected',
            'bringForward',
            'bringToFront',
            'sendBackward',
            'sendToBack',
            'deleteSelected',
        ]),
        openGraph() {
            window.open(
                this.pathPrefix + "graphs",
                "_graphs",
            );
        },
        toggleGrid() {
            this.preferences = {
                ...this.preferences,
                ...{
                    appearance: {
                        ...this.preferences.appearance,
                        showGrid: !this.preferences.appearance.showGrid,
                    },
                },
            };
        },
        zoomOut() {
            this.view = {
              ...this.view,
              k: Math.max(this.view.k - .10, .10),
            };
        },
        zoomIn() {
            this.view = {
              ...this.view,
              k: Math.min(this.view.k + .10, 4),
            };
        },
        resetView() {
            this.view = {
              ...this.view,
              x: 0,
              y: 0,
            };
        },
        resetZoom() {
            this.view = {
                ...this.view,
                k: 1,
            };
        },
        isGraphTarget(e) {
            let parentNode = e.target;
            if (this.locked) {
                while (parentNode) {
                    if (parentNode.className === "node") {
                        return false;
                    }
                    parentNode = parentNode.parentNode;
                }
            }
            return (!/^(no-graph-target|v-list|v-menu)/.test(e.target.className)) &&
                !((this.$refs.panel && this.$refs.panel.$el.contains(e.target))
                    || (this.$refs.topBar && this.$refs.topBar.$el.contains(e.target))
                    || (this.$refs.bottomBar && this.$refs.bottomBar.$el.contains(e.target)));
        },
        getItemAt(e) {
            while (e.parentNode) {
                if (e.className === "node-inputs" || e.className === "node-outputs") {
                    return {port: true};
                }
                if (e.className === "node") {
                    const nodeId = e.getAttribute("x-node-id");
                    return {
                        node: this.graph.nodes.find((v) => {
                            return v.id === nodeId;
                        }),
                    };
                }
                e = e.parentNode;
            }
            return {};
        },
        mousemove(e) {
            if (this.showHelp || this.inRewindMode) {
                return;
            }
            const mouse = this.getMousePosFromEvent(e);
            const item = this.getItemAt(e.target);
            if (item.node) {
                this.hoveredNode = item.node;
            } else {
                this.hoveredNode = null;
            }
            if (!item.port) {
                this.hoveredPort = null;
            }
            this.mouse = {
                ...this.mouse,
                event: e,
                x: mouse.x,
                y: mouse.y,
            };
        },
        dblclick(e) {
            if (!/graph-canvas-container/.test(e.target.className)) {
                return;
            }
            this.createNewNode({
                x: e.clientX,
                y: e.clientY,
            });
        },
        mousedown(e) {
            let isMap = false;
            if (!this.graph || this.showHelp || this.inRewindMode) {
                return;
            }
            // do not track control panel inputs
            if (!this.isGraphTarget(e)) {
                return;
            }
            if (/graph-map-view-port|graph-map/.test(e.target.className)) {
                isMap = true;
            }
            const translating = {
                isMap,
                mouse: {
                    x: this.mouse.x,
                    y: this.mouse.y,
                    event: e,
                },
                view: {
                    y: this.view.y,
                    x: this.view.x,
                },
                nodes: this.graph.nodes.map((v) => {
                    return {
                        id: v.id,
                        properties: {
                            x: v.properties.x,
                            y: v.properties.y,
                            presentation: {
                                x: v.properties.presentation.x,
                                y: v.properties.presentation.y,
                            },
                            newX: 0,
                            newY: 0,
                        },
                    };
                }),
            };
            this.translating = translating;
            this.mouse = {
                ...this.mouse,
                event: e,
                [this.buttonMap[e.button]]: true,
            };
        },
        mouseup(e) {
            this.mouse = {
                ...this.mouse,
                event: e,
                [this.buttonMap[e.button]]: false,
            };
        },
        getMousePosFromEvent(e) {
            if (!this.$el) {
                return {
                    x: 0,
                    y: 0
                };
            }
            const rect = this.$el.getBoundingClientRect();
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        },
        scale(e) {
            // do not track control panel inputs
            if (!this.isGraphTarget(e) || this.showHelp || this.presentation) {
                return;
            }
            const mouse = this.getMousePosFromEvent(e);
            const ok = this.view.k;
            const delta =
                (e.wheelDelta ? e.wheelDelta / 120 : -e.deltaY / 3) * 0.01;
            let x = this.view.x;
            let y = this.view.y;
            let k = this.view.k;
            k += delta || 1;
            k = Math.min(Math.max(k, 0.1), 4);
            const target = {
                x: (mouse.x - x) / ok,
                y: (mouse.y - y) / ok
            };
            x = -target.x * k + mouse.x;
            y = -target.y * k + mouse.y;
            const view = {
                k,
                x: Math.floor(x),
                y: Math.floor(y),
            };
            this.view = view;
        },
        copyNodes(nodes) {
            nodes = JSON.parse(JSON.stringify(nodes));
            const nodeIds = nodes.map(v => v.id);
            // get rid of connectors that point to nodes not in this array
            nodes.forEach((node) => {
                node.edges.forEach((edge) => {
                    const dropConnectors = [];
                    edge.connectors.forEach((connector) => {
                        if (nodeIds.indexOf(connector.nodeId) === -1) {
                            dropConnectors.push(connector);
                        }
                    });
                    dropConnectors.forEach((connector) => {
                        edge.connectors.splice(edge.connectors.indexOf(connector), 1);
                    });
                });
            });
            return nodes;
        },
        evCut(e) {
            if (!this.isGraphTarget(e)
                || /dont-propagate-copy/.test(e.target.className)
                || this.selectedNodes.length === 0
                || /input|textarea/i.test(e.target.tagName)) {
                return;
            }
            console.warn("Clipboard cut captured by graph editor");
            e.clipboardData.setData(this.nodeMimeType, JSON.stringify(this.copyNodes(this.selectedNodes), null, "\t"));
            this.deleteSelected();
            e.preventDefault();
        },
        evCopy(e) {
            if (!this.isGraphTarget(e)
                    || /dont-propagate-copy/.test(e.target.className)
                    || this.selectedNodes.length === 0
                    || /input|textarea/i.test(e.target.tagName)) {
                return;
            }
            console.warn("Clipboard copy captured by graph editor");
            e.clipboardData.setData(this.nodeMimeType, JSON.stringify(this.copyNodes(this.selectedNodes), null, "\t"));
            e.preventDefault();
        },
        evPaste(e) {
            if (!this.isGraphTarget(e)
                || /dont-propagate-copy/.test(e.target.className)
                || /input|textarea/i.test(e.target.tagName)) {
                return;
            }
            console.warn("Clipboard paste captured by graph editor");
            const data = e.clipboardData.getData(this.nodeMimeType);
            this.tryPasteNodeString(data);
            e.preventDefault();
        },
        tryPasteNodeString(data) {
            const msg = "The text pasted onto the graph does not appear to be node data.";
            let nodes;
            const er = () => {
                this.raiseError(msg);
                console.warn(msg);
            };
            try {
                nodes = JSON.parse(data);
            } catch(err) {
                console.error(err);
                return er();
            }
            if (!Array.isArray(nodes)) {
                return er();
            }
            for (var x = 0; x < nodes.length; x += 1) {
                if(!this.validateNode(nodes[x])){
                    return er();
                }
            }
            this.pasteNodes(nodes);
        },
        validateNode(node) {
            if (
                !node.id ||
                !node.edges ||
                !Array.isArray(node.edges) ||
                typeof node.properties !== "object" ||
                node.properties.x === undefined ||
                node.properties.y === undefined ||
                node.properties.z === undefined ||
                typeof node.template !== "object" ||
                node.template.set === undefined ||
                node.template.vue === undefined
            ) {
                return false;
            }
            return true;
        },
        keyup(e) {
            if (e.target !== document.body) {
                return;
            }
            this.keyup = e;
        },
        keydown(e) {
            if (e.target !== document.body) {
                return;
            }
            this.keydown = e;
        }
    },
    created() {
        const isDark = this.preferences.appearance.theme === "dark";
        const theme = useTheme();
        theme.global.name.value = isDark ? 'dark' : 'light';
        this.bgColor = isDark ? "#000000" : "#FFFFFF";
    },
    mounted() {
        document.onwheel = e => {
            this.scale(e);
        };
        document.oncut = this.evCut;
        document.onpaste = this.evPaste;
        document.oncopy = this.evCopy;
        document.onmousedown = this.mousedown;
        document.ondblclick = this.dblclick;
        document.onmouseup = this.mouseup;
        document.onmousemove = this.mousemove;
        window.onkeyup = this.keyup;
        window.onkeydown = this.keydown;
        const graphId = window.location.pathname.substring(1);
        this.open(graphId);
    },
    data: () => {
        return {
            bgColor: "#000000",
            spaceKeyCode: 32,
            translate: false,
            showDialog: false,
            localErrorMessage: "",
            localShowError: false,
            localVersion: 0,
            graphLoaded: false,
            presentationWarning: false,
            hasSeenPresentationWarning: false,
            showAnnoyingHelpMessage: false,
            showConnectorView: false,
        };
    }
};
</script>
<style>
.graph-container, .graph-editor {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    width: 100vw;
}
.graph-container {
    top: 25px;
    height: calc(100vh - 25px);
}
.error-close-btn.v-icon.v-icon:after,
.bottom-system-bar .v-icon.v-icon:after,
.top-system-bar  .v-icon.v-icon:after {
    display: none;
}
.bottom-system-bar {
    white-space: nowrap;
}
.no-pointer-events {
    pointer-events: none;
}
.no-select {
    -webkit-touch-callout: none; /* iOS Safari */
    -webkit-user-select: none; /* Safari */
    -khtml-user-select: none; /* Konqueror HTML */
    -moz-user-select: none; /* Firefox */
    -ms-user-select: none; /* Internet Explorer/Edge */
    user-select: none; /* Non-prefixed version, currently supported by Chrome and Opera */
}
</style>
