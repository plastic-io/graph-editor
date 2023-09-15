<template>
    <div ref="node-root">
        <div
            v-if="loaded[nodeComponentName] && visible"
            ref="node"
            class="node"
            :key="localNode.id"
            :x-node-id="localNode.id"
            :style="nodeStyle">
            <node-error :nodeId="localNode.id"/>
            <div class="node-inputs" v-if="!hostNode">
                <node-field
                    v-for="field in inputs"
                    :key="'input_' + field.name"
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
                <node-component
                    v-if="!broken"
                    :component="component"
                    :graph="localNode.linkedGraph ? localNode.linkedGraph.graph : null"
                    :node="localNode"
                    :scheduler="scheduler"
                    :state="scheduler.state"
                    :nodeProps="nodeProps"
                    :hostNode="hostNode"
                    @dataChange="dataChange"
                    @set="set"
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
                    :key="'output_' + field.name"
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
import NodeError from "./NodeError.vue";
import NodeComponent from "./NodeComponent.vue";

import {diff} from "deep-diff";

import {markRaw, shallowRef, h} from "vue";
export default {
    name: "graph-node",
    components: {NodeField, NodeError, NodeComponent},
    props: {
        node: Node,
        hostNode: Node,
        graph: Graph,
        presentation: Boolean,
    },
    watch: {
        compiledTemplate: {
            handler: function () {
                this.compiledTemplate.errors.forEach((err) => {
                    this.raiseError(this.localNode.id, err);
                });
                this.broken = this.compiledTemplate.errors.length > 0;
                this.component = this.compiledTemplate.component;
            },
            deep: true,
        },
        nodeProps: {
            handler: function () {
                const changes = diff(this.localNodeDataSnapshot, this.node.data);
                this.localNodeDataSnapshot = JSON.parse(JSON.stringify(this.node.data));
                if (changes) {
                    this.updateNodeData({
                        nodeId: this.node.id,
                        data: this.node.data,
                    });
                }
            },
            deep: true,
        },
        localNode: {
            handler: function () {
                const changes = diff(this.localNodeDataSnapshot, this.node.data);
                this.localNodeDataSnapshot = JSON.parse(JSON.stringify(this.node.data));
                if (changes) {
                    this.updateNodeData({
                        nodeId: this.node.id,
                        data: this.node.data,
                    });
                }
            },
            deep: true,
        },
        hoveredNode: {
            handler: function () {
                this.localHoveredNode = this.hoveredNode;
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
            this.localNodeSnapshot = JSON.parse(JSON.stringify(this.node, this.replacer));
            if (changes) {
                this.styles = [];
                // recompile template after change
                this.compiledTemplate = 
                    await compileTemplate(this, this.localNode.id, this.localNode.template.vue, true);
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
            broken: true,
            longLoadingTimer: null,
            longLoading: false,
            loaded: {} as any,
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
            compileCount: 0,
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
        this.updateContextId();
        this.bindNodeEvents(this.localNode);
        this.bindNodeProps(this.localNode);
        this.localNodeSnapshot = JSON.parse(JSON.stringify(this.node, this.replacer));
        this.localNodeDataSnapshot = JSON.parse(JSON.stringify(this.node.data));
        this.localSelectedNodes = this.selectedNodes;
        this.longLoadingTimer = setTimeout(() => {
            this.longLoading = true;
        }, 500);
        this.clearErrors(this.localNode.id);
        await this.importRoot(this.localNode);
        this.loaded[this.nodeComponentName] = true;
    },
    methods: {
        ...mapActions(useStore, [
            "replacer",
        ]),
        ...mapActions(useOrchestratorStore, [
            "clearErrors",
            "raiseError",
        ]),
        ...mapActions(useGraphStore, [
            "getNodeById",
            "setArtifact",
            "updateNodeData",
            "clearArtifact",
        ]),
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
        updateContextId() {
            this.gaphReferences[this.localNode.__contextId] = this;
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
        async importRoot(vect) {
            if (vect.artifact) {
                let v;
                if (/^https?:\/\//.test(vect.artifact)) {
                    try {
                        const seralizedV = await fetch(vect.artifact);
                        v = await seralizedV.json();
                    } catch (err) {
                        this.raiseError(new Error(`Cannot load remote resource. ${err}.`));
                    }
                } else {
                    v = await this.dataProviders.publish.get(vect.artifact);
                }
                const l = {
                    key: vect.artifact,
                    value: v,
                };
                this.setArtifact(l);
                if (v.nodes) {
                    await this.importGraph(v);
                } else {
                    await this.importNode(v, this.artifactKey(vect.artifact));
                }
            } else {
                const l = {
                    key: vect.id,
                    value: vect,
                };
                this.setArtifact(l);
                this.compiledTemplate = await compileTemplate(this, vect.id, vect.template.vue);
            }
        },
        async importGraph(g) {
            this.compiledTemplate = await compileTemplate(this, this.nodeComponentName, g.properties.presentationTemplate);
            this.loaded[this.nodeComponentName] = true;
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
        },
    },
    computed: {
        ...mapWritableState(useInputStore, [
            'mouse',
        ]),
        ...mapState(useOrchestratorStore, [
            'dataProviders',
            'scheduler',
        ]),
        ...mapState(useGraphStore, [
            'hoveredNode',
            'selectedNodes',
            'translating',
            'view',
        ]),
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
        nodeStyle: function () {
            const hovered = this.hoveredNode && this.hoveredNode.id === this.localNode.id;
            const selected = !!this.selectedNodes.find(v => v.id === this.localNode.id);
            const hoveredAndSelected = hovered && selected;
            let borderColor = "transparent";
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
        left: -10px;
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
