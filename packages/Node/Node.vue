<template>
    <div ref="node-root" v-if="localNode && visible">
        <node-editor
            v-if="!presentation"
            :style="editorStyle"
            :nodeId="node.id"
            :hovered="localHoveredNode"/>
        <div
            v-if="loaded"
            ref="node"
            class="node"
            :key="localNode.id"
            :x-node-id="localNode.id"
            :style="nodeStyle">
            <div class="node-inputs" v-if="!hostNode">
                <node-field
                    v-for="field in inputs"
                    :key="field.name"
                    :field="field"
                    :node="localNode"
                    type="input"
                />
            </div>
            <div
                help-topic="nodeInstance"
                :id="'node-' + localNode.id"
                :class="translating && mouse.lmb ? 'no-select' : ''"
            >
                <v-card v-if="broken">
                    <v-card-title>
                        <v-icon icon="mdi-robot-dead-outline" color="warning" size="xx-large"/>
                        <pre v-if="errorMessage">{{errorMessage}}</pre>
                    </v-card-title>
                </v-card>
                <node-component
                    v-if="!broken"
                    :component="component"
                    :hostGraph="graph"
                    :graph="currentGraph"
                    :presentation="presentation"
                    :node="localNode"
                    :scheduler="scheduler"
                    :state="scheduler.state"
                    v-bind="nodeProps"
                    :hostNode="isLinked ? localNode : hostNode"
                    @mountError="mountError"
                    @data="dataChange"
                    @set="set"
                    :key="renderVersion"
                />
                <component
                    v-for="(style, index) in styles"
                    :is="'style'"
                    v-html="style"
                    :key="index"
                />
            </div>
            <div class="node-outputs" v-if="!hostNode">
                <node-field
                    v-for="field in outputs"
                    :key="field.name"
                    :field="field"
                    :node="localNode"
                    type="output"
                />
            </div>
        </div>
    </div>
</template>
<script lang="ts">
import compileTemplate from "@plastic-io/graph-editor-vue3-compile-template";

import {useStore as useInputStore} from "@plastic-io/graph-editor-vue3-input";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";

import {useStore} from "./store"; // eslint-disable-line

import {Node, Graph} from "@plastic-io/plastic-io";

import {mapWritableState, mapActions, mapState} from "pinia";

import NodeField from "./NodeField.vue";
import NodeComponent from "./NodeComponent.vue";
import NodeEditor from "./NodeEditor.vue";

import {diff} from "deep-diff";

import {markRaw, shallowRef, h, watch} from "vue";
export default {
    name: "node",
    components: {NodeField, NodeComponent, NodeEditor},
    props: {
        node: Node,
        hostGraph: Node,
        hostNode: Node,
        graph: Object,
        presentation: Boolean,
    },
    errorCaptured(err) {
        this.mountError(err);
    },
    watch: {
        compiledTemplate: {
            handler: function () {
                this.compiledTemplate.errors.forEach((err) => {
                    this.raiseError(this.localNode.id, err, 'vue');
                });
                this.renderVersion = this.renderVersion + 1;
                this.broken = this.compiledTemplate.errors.length > 0;
                this.component = this.compiledTemplate.component;
                this.webWorkerProxy.nodes[this.nodeId] = {};
                this.localNode.properties.inputs.forEach((input) => {
                    this.webWorkerProxy.nodes[this.nodeId] = {
                        [input.name]: null,
                    };
                });
            },
            deep: true,
        },
        nodeProps: {
            handler: function () {
                this.setNodeData();
            },
            deep: true,
        },
        localNode: {
            handler: function () {
                this.setNodeData();
            },
            deep: true,
        },
        hoveredNode: {
            handler: function () {
                this.localHoveredNode = this.hoveredNode && this.hoveredNode.id === this.localNode.id;
            },
        },
        selectedNodes: {
            handler: function () {
                this.localSelectedNodes = this.selectedNodes;
            },
            deep: true,
        },
        async 'node.template.vue'() {
            const changes = diff(this.localNodeSnapshot.template.vue, this.node.template.vue);
            this.localNode = this.node;
            this.localNodeSnapshot = JSON.parse(JSON.stringify(this.node));
            if (changes) {
                this.styles = [];
                // recompile template after change
                this.compiledTemplate =
                    await compileTemplate(this, this.localNode.id, this.localNode.template.vue, true);
                this.styles = this.compiledTemplate.styles;

            }
        },
    },
    data() {
        return {
            component: markRaw({
                render() {
                    return h('div');
                },
            }),
            compiledTemplate: markRaw({
                component: {
                    render() {
                        return h('div');
                    },
                },
                errors: [],
            }),
            showVueEditor: false,
            showSetEditor: false,
            longLoadingTimer: null,
            longLoading: false,
            loaded: false,
            errorMessage: "",
            localHoveredNode: null,
            localSelectedNodes: [],
            nodeEvents: {},
            nodeProps: {},
            dragged: null,
            localNode: null as any,
            localNodeSnapshot: null,
            localNodeDataSnapshot: null,
            template: null,
            stateVersion: 0,
            renderVersion: 0,
            contextId: null,
            artifactNodes: {},
            styles: [],
            gaphReferences: {},
        };
    },
    async mounted() {
        this.styles = [];
        this.broken = null;
        this.localNode = this.node;
        this.bindNodeEvents(this.localNode);
        this.bindNodeProps(this.localNode);
        this.localNodeSnapshot = JSON.parse(JSON.stringify(this.node));
        this.localNodeDataSnapshot = JSON.parse(JSON.stringify(this.node.data));
        this.localSelectedNodes = this.selectedNodes;
        this.longLoadingTimer = setTimeout(() => {
            this.longLoading = true;
        }, 500);
        this.clearErrors(this.localNode.id);
        // should we load the local node?  An imported node?  Or an imported graph?
        if (this.localNode.linkedGraph) {
            await this.importGraph(this.localNode);
        } else if (this.localNode.linkedNode) {
            await this.importNode(this.localNode);
        } else {
            await this.importRoot(this.localNode);
        }
        this.loaded = true;
        watch(() => this.webWorkerProxy, () => {
            this.nodeProps = this.webWorkerProxy.nodes[this.localNode.id];
        }, { deep: true });
    },
    methods: {
        ...mapActions(useOrchestratorStore, [
            "clearErrors",
            "raiseError",
        ]),
        ...mapActions(useGraphStore, [
            "getNodeById",
            "updateNodeData",
            "clearArtifact",
        ]),
        setNodeData() {
            const changes = diff(this.localNodeDataSnapshot, this.node.data);
            this.localNodeDataSnapshot = JSON.parse(JSON.stringify(this.node.data));
            if (changes) {
                this.updateNodeData({
                    nodeId: this.node.id,
                    data: this.node.data,
                });
            }
        },
        mountError(err) {
            this.broken = true;
            this.raiseError(this.localNode.id, err, 'vue');
        },
        setLinkedNode(e) {
            console.log("setLinkedNode", e);
        },
        bindNodeEvents(vect) {
            const events = {};
            vect.properties.outputs.forEach((output) => {
                events[output.name] = (val) => {
                    this.scheduler.instance.url(this.node.url, val, output.name, this.hostNode);
                };
            });
            this.nodeEvents = events;
        },
        bindNodeProps(vect) {
            const props = {};
            vect.properties.inputs.forEach((input) => {
                props[input.name] = undefined;
            });
            this.nodeProps = props;
        },
        dataChange(e) {
            this.updateNodeData({
                nodeId: this.node.id,
                data: e,
            });
        },
        set(e) {
            this.scheduler.instance.url(this.node.url, e, "$url", this.hostNode);
        },
        artifactKey(key) {
            if (!key) {
                return;
            }
            return key.replace(/\/|\./g, "_").replace(/@/g, "_at_").replace(/:/g, "_col_");
        },
        async downloadNode(artifact) {
            if (artifact && /api\.github\.com/.test(artifact)) {
                const data = await fetch(artifact);
                const dataJson = await data.json();
                return JSON.parse(atob(dataJson.content));
            }
            const seralizedV = await fetch(artifact);
            return await seralizedV.json();
        },
        async importRoot(vect) {
            const l = {
                key: vect.id,
                value: vect,
            };
            this.compiledTemplate = await compileTemplate(this, vect.id, vect.template.vue);
            this.styles = this.compiledTemplate.styles;
        },
        async importGraph(g) {
            if (!g.linkedGraph.graph.properties.template) {
                throw new Error('Linked Graph template is blank');
            }
            this.compiledTemplate = await compileTemplate(this, this.nodeComponentName, g.linkedGraph.graph.properties.template);
            this.styles = this.compiledTemplate.styles;
            this.loaded = true;
        },
        async importNode(v, artifactKey) {
            v.artifact = this.node.artifact;
            v.url = this.node.url;
            v.artifactlId = v.id;
            v.id = this.node.id;
            v.properties.x = this.node.properties.x;
            v.properties.y = this.node.properties.y;
            v.properties.z = this.node.properties.z;
            v.properties.presentation.x = this.node.properties.presentation.x;
            v.properties.presentation.y = this.node.properties.presentation.y;
            v.properties.presentation.z = this.node.properties.presentation.z;
            this.compiledTemplate = await compileTemplate(this, artifactKey, v.template.vue);
            this.styles = this.compiledTemplate.styles;
        },
    },
    computed: {
        ...mapWritableState(useInputStore, [
            'mouse',
            'keys',
        ]),
        ...mapState(useOrchestratorStore, [
            'dataProviders',
            'webWorkerProxy',
            'scheduler',
        ]),
        ...mapState(useGraphStore, [
            'hoveredNode',
            'selectedNodes',
            'translating',
            'view',
            'movingNodes',
        ]),
        isLinked() {
            return !!(this.localNode.linkedGraph || this.localNode.linkedNode);
        },
        currentGraph() {
            return this.localNode.linkedGraph ? this.localNode.linkedGraph.graph : this.graph;
        },
        nodeComponentName() {
            const name = this.artifactKey(this.node.artifact) || this.node.id;
            return name;
        },
        visible: function () {
            if (this.presentation && !this.localNode.properties.appearsInPresentation) {
                return false;
            }
            return true;
        },
        inputs: function () {
            return this.localNode.properties.inputs;
        },
        outputs: function () {
            return this.localNode.properties.outputs;
        },
        editorStyle() {
            if (!this.localNode) {
                return {};
            }
            return {
                position: "absolute",
                left: this.localNode.properties.x + "px",
                top: this.localNode.properties.y + "px",
                zIndex: 1000,
            }
        },
        nodeStyle: function () {
            const hovered = this.hoveredNode && this.hoveredNode.id === this.localNode.id;
            const selected = !!this.selectedNodes.find(v => v.id === this.localNode.id);
            const hoveredAndSelected = hovered && selected;
            let borderColor = "transparent";
            let transition = "all 0.25s";
            if (this.movingNodes.length > 0) {
                transition = "";
            }
            if (this.presentation) {
                borderColor = "transparent";
            } else if (hoveredAndSelected) {
                borderColor = "var(--vt-c-text-dark-1)";
            } else if (selected) {
                borderColor = "var(--vt-c-text-dark-2)";
            } else if (hovered) {
                borderColor = "var(--vt-c-text-dark-2)";
            }
            if (this.presentation || this.hostNode) {
                if (this.localNode.properties.positionAbsolute) {
                    return {
                        position: "absolute",
                        transition,
                        outline: "solid 1px " + borderColor,
                        left: this.localNode.properties.presentation.x + "px",
                        top: this.localNode.properties.presentation.y + "px",
                        zIndex: this.localNode.properties.presentation.z,
                    };
                }
                return {
                    outline: "solid 1px " + borderColor,
                };
            }
            return {
                position: "absolute",
                transition,
                outline: "solid 1px " + borderColor,
                left: this.localNode.properties.x + "px",
                top: this.localNode.properties.y + "px",
                zIndex: this.localNode.properties.z,
            }; 
        },
    },
};
</script>
<style>
    .node-inputs {
        position: absolute;
        left: -15px;
        top: 0;
        width: 10px;
    }
    .node-outputs {
        position: absolute;
        right: -10px;
        top: 0;
        width: 10px;
    }
</style>
