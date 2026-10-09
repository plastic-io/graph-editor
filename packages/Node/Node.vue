<template>
    <div ref="node-root" v-if="localNode && mountedForExecution" v-show="visible">
        <node-editor
            v-if="!presentation"
            :style="editorStyle"
            :nodeId="node.id"
            :hovered="!!localHoveredNode"/>
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
                :class="{
                    'no-select': translating && mouse.lmb,
                    'cloudformation-node-content': !!localNode.properties?.iac?.stack,
                }"
                :style="localNode.properties?.iac?.stack ? cfPanelStyle : undefined"
                @wheel="localNode.properties?.iac?.stack && $event.stopPropagation()"
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
                <deployment-progress v-if="localNode.properties?.iac?.stack" :graph-id="currentGraph.id" :node-id="localNode.id" :recovery-controls="false"/>
                <component
                    v-for="(style, index) in styles"
                    :is="'style'"
                    v-html="style"
                    :key="index"
                />
            </div>
            <button v-if="localNode.properties?.iac?.stack && !presentation && !readOnly" class="cf-resize-handle no-graph-target" type="button" aria-label="Resize CloudFormation node" title="Drag to resize; arrow keys resize, Shift for larger steps" @pointerdown.stop.prevent="startCfResize" @pointermove.stop="moveCfResize" @pointerup.stop="finishCfResize" @pointercancel.stop="cancelCfResize" @mousedown.stop @mouseup.stop @keydown.stop.prevent="keyCfResize"><v-icon icon="mdi-resize-bottom-right" size="small"/></button>
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
import type {PropType} from "vue";
import {authorizedFetch} from "@plastic-io/graph-editor-vue3-authentication-provider";
import compileTemplate from "@plastic-io/graph-editor-vue3-compile-template";

import {useStore as useInputStore} from "@plastic-io/graph-editor-vue3-input";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";

import {useStore} from "./store"; // eslint-disable-line

import type {Node, Graph} from "@plastic-io/plastic-io";

import {mapWritableState, mapActions, mapState} from "pinia";

import NodeField from "./NodeField.vue";
import NodeComponent from "./NodeComponent.vue";
import NodeEditor from "./NodeEditor.vue";
import DeploymentProgress from "../DeploymentStatus/DeploymentProgress.vue";

import {deepEqual} from "@plastic-io/graph-crdt";

import {markRaw, shallowRef, h, watch} from "vue";

/** How long to wait after the last keystroke before rebuilding a node. */
const RECOMPILE_DEBOUNCE = 600;

export default {
    name: "node",
    components: {NodeField, NodeComponent, NodeEditor, DeploymentProgress},
    props: {
        // These say what the prop is, rather than naming a type where Vue
        // expects a constructor: `node: Node` declared the DOM's Node, because
        // that is what the name means at runtime.
        node: {type: Object as PropType<Node>, required: true},
        hostGraph: {type: Object as PropType<Graph>, required: false},
        hostNode: {type: Object as PropType<Node>, required: false},
        graph: {type: Object as PropType<Graph>, required: false},
        presentation: Boolean,
    },
    errorCaptured(err) {
        this.mountError(err);
    },
    unmounted() {
        clearTimeout(this.recompileTimer);
        clearTimeout(this.longLoadingTimer);
    },
    watch: {
        compiledTemplate: {
            handler: function () {
                this.compiledTemplate.errors.forEach((err: any) => {
                    this.raiseError(this.localNode.id, err, 'vue');
                });
                this.renderVersion = this.renderVersion + 1;
                this.broken = this.compiledTemplate.errors.length > 0;
                this.component = this.compiledTemplate.component;
                // `this.nodeId` was never declared here, so this wrote every
                // node's inputs to the key `undefined`; the node's own id is
                // what the worker's state is keyed by
                this.webWorkerProxy.nodes[this.localNode.id] = {};
                this.localNode.properties.inputs.forEach((input: any) => {
                    this.webWorkerProxy.nodes[this.localNode.id] = {
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
        'node.template.vue'() {
            const changes = !deepEqual(this.localNodeSnapshot.template.vue, (this.node.template as any).vue);
            this.localNode = this.node;
            this.localNodeSnapshot = JSON.parse(JSON.stringify(this.node));
            if (!changes) {
                return;
            }
            // Template edits now arrive a keystroke at a time, from this user
            // and from anyone else on the graph.  Recompiling the component on
            // each one would rebuild the node on every character and fill the
            // error panel with half typed markup, so the rebuild waits for a
            // pause in the typing.
            clearTimeout(this.recompileTimer);
            this.recompileTimer = setTimeout(async () => {
                this.styles = [];
                this.compiledTemplate =
                    await compileTemplate(this, this.localNode.id, this.localNode.template.vue, true);
                this.styles = this.compiledTemplate.styles;
            }, RECOMPILE_DEBOUNCE);
        },
    },
    data() {
        return {
            component: markRaw({
                render() {
                    return h('div');
                },
            }),
            // what the node's template compiled to: a component, whatever it
            // failed with, and the styles it brought
            compiledTemplate: markRaw({
                component: {
                    render() {
                        return h('div');
                    },
                },
                errors: [],
            }) as any,
            showVueEditor: false,
            showSetEditor: false,
            longLoadingTimer: null as any,
            longLoading: false,
            loaded: false,
            errorMessage: "",
            // whether this node's template failed to compile; the card shows the
            // errors instead of the node when it did
            broken: null as any,
            localHoveredNode: null as any,
            localSelectedNodes: [],
            nodeEvents: {} as Record<string, any>,
            nodeProps: {} as Record<string, any>,
            dragged: null,
            recompileTimer: null as any,
            localNode: null as any,
            localNodeSnapshot: null as any,
            localNodeDataSnapshot: null as any,
            template: null,
            stateVersion: 0,
            renderVersion: 0,
            contextId: null,
            cfResize: null as any,
            cfDraftSize: null as any,
            artifactNodes: {} as Record<string, any>,
            styles: [] as any[],
            gaphReferences: {} as Record<string, any>,
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
        boundCfSize(width: number, height: number) { return {width:Math.round(Math.max(300,Math.min(1600,width))),height:Math.round(Math.max(200,Math.min(960,height)))}; },
        startCfResize(event: PointerEvent) {
            if(event.button!==0 || this.readOnly)return;
            const panel=document.getElementById('node-'+this.localNode.id)!;
            this.cfResize={x:event.clientX,y:event.clientY,width:panel.offsetWidth,height:panel.offsetHeight,scale:panel.getBoundingClientRect().width/panel.offsetWidth};
            (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        },
        moveCfResize(event: PointerEvent) {
            if(!this.cfResize)return;
            const r=this.cfResize;this.cfDraftSize=this.boundCfSize(r.width+(event.clientX-r.x)/r.scale,r.height+(event.clientY-r.y)/r.scale);
            this.redrawConnectorVersion++;
        },
        finishCfResize(event: PointerEvent) {
            if(!this.cfResize)return;this.moveCfResize(event);this.saveCfSize(this.cfDraftSize);this.cfResize=null;this.cfDraftSize=null;
            (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
        },
        cancelCfResize(){this.cfResize=null;this.cfDraftSize=null;},
        keyCfResize(event: KeyboardEvent){
            const delta=event.shiftKey?50:10,keys:any={ArrowLeft:[-delta,0],ArrowRight:[delta,0],ArrowUp:[0,-delta],ArrowDown:[0,delta]};
            if(keys[event.key])this.saveCfSize(this.boundCfSize(this.cfPanelSize.width+keys[event.key][0],this.cfPanelSize.height+keys[event.key][1]));
        },
        saveCfSize(size:any){
            if(this.readOnly||!size)return;
            const current=this.getNodeById(this.localNode.id);
            if(current)this.updateNodeProperties({nodeId:current.id,properties:{...current.properties,cfPanelSize:size}});
            this.redrawConnectorVersion++;
        },
        ...mapActions(useOrchestratorStore, [
            "clearErrors",
            "raiseError",
        ]),
        ...mapActions(useGraphStore, [
            "getNodeById",
            "updateNodeProperties",
            "updateNodeData",
            "clearArtifact",
        ]),
        setNodeData() {
            const changes = !deepEqual(this.localNodeDataSnapshot, this.node.data);
            this.localNodeDataSnapshot = JSON.parse(JSON.stringify(this.node.data));
            if (changes) {
                this.updateNodeData({
                    nodeId: this.node.id,
                    data: this.node.data,
                });
            }
        },
        mountError(err: any) {
            this.broken = true;
            this.raiseError(this.localNode.id, err, 'vue');
        },
        setLinkedNode(e: any) {
            console.log("setLinkedNode", e);
        },
        bindNodeEvents(vect: any) {
            const events: Record<string, any> = {};
            vect.properties.outputs.forEach((output: any) => {
                events[output.name] = (val: any) => {
                    this.scheduler.instance!.url(this.node.url, val, output.name, this.hostNode);
                };
            });
            this.nodeEvents = events;
        },
        bindNodeProps(vect: any) {
            const props: Record<string, any> = {};
            vect.properties.inputs.forEach((input: any) => {
                props[input.name] = undefined;
            });
            this.nodeProps = props;
        },
        dataChange(e: any) {
            this.updateNodeData({
                nodeId: this.node.id,
                data: e,
            });
        },
        set(e: any) {
            this.scheduler.instance!.url(this.node.url, e, "$url", this.hostNode);
        },
        artifactKey(key: any) {
            if (!key) {
                return;
            }
            return key.replace(/\/|\./g, "_").replace(/@/g, "_at_").replace(/:/g, "_col_");
        },
        async downloadNode(artifact: any) {
            if (artifact && /api\.github\.com/.test(artifact)) {
                const data = await authorizedFetch(artifact);
                const dataJson = await data.json();
                return JSON.parse(atob(dataJson.content));
            }
            const seralizedV = await authorizedFetch(artifact);
            return await seralizedV.json();
        },
        async importRoot(vect: any) {
            const l = {
                key: vect.id,
                value: vect,
            };
            this.compiledTemplate = await compileTemplate(this, vect.id, vect.template.vue);
            this.styles = this.compiledTemplate.styles;
            this.redrawConnectorVersion += 1;
        },
        async importGraph(g: any) {
            /**
             * A link the document does not carry: the graph is named, and the
             * runtime loads it when a value reaches this node (plastic-io 2.3).
             * There is nothing to draw for it here, and that is not an error —
             * a recursive graph is written exactly this way, because a document
             * cannot contain a copy of itself.
             */
            if (!g.linkedGraph.graph) {
                this.loaded = true;
                return;
            }
            if (!g.linkedGraph.graph.properties.template) {
                throw new Error('Linked Graph template is blank');
            }
            this.compiledTemplate = await compileTemplate(this, this.nodeComponentName, g.linkedGraph.graph.properties.template);
            this.styles = this.compiledTemplate.styles;
            this.loaded = true;
            this.redrawConnectorVersion += 1;
        },
        async importNode(v: any, artifactKey?: any) {
            v.artifact = (this.node as any).artifact;
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
            this.redrawConnectorVersion += 1;
        },
    },
    computed: {
        ...mapWritableState(useInputStore, [
            'mouse',
            'keys',
        ]),
        ...mapWritableState(useOrchestratorStore, [
            'redrawConnectorVersion',
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
            'readOnly',
        ]),
        cfPanelSize():any { const size=this.cfDraftSize||this.node?.properties?.cfPanelSize;return this.boundCfSize(Number(size?.width)||600,Number(size?.height)||480); },
        cfPanelStyle():any { return {width:this.cfPanelSize.width+'px',height:this.cfPanelSize.height+'px'}; },
        isLinked() {
            return !!(this.localNode.linkedGraph || this.localNode.linkedNode);
        },
        currentGraph() {
            return this.localNode.linkedGraph ? this.localNode.linkedGraph.graph : this.graph;
        },
        nodeComponentName() {
            const name = this.artifactKey((this.node as any).artifact) || this.node.id;
            return name;
        },
        mountedForExecution() {
            return this.visible || !!this.localNode?.properties?.runInBackground;
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
        nodeStyle: function (): any {
            const hovered = this.hoveredNode && this.hoveredNode.id === this.localNode.id;
            const selected = !!this.selectedNodes.find((v: any) => v.id === this.localNode.id);
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
    .cloudformation-node-content {
        box-sizing: border-box;
        width: 600px;
        height: 480px;
        max-width: 1600px;
        max-height: 960px;
        overflow: auto;
        overscroll-behavior: contain;
        scrollbar-gutter: stable;
    }
    .cf-resize-handle {position:absolute;right:0;bottom:0;z-index:5;cursor:nwse-resize;touch-action:none;background:rgb(var(--v-theme-surface));border:1px solid #8888;border-radius:4px;width:24px;height:24px;}
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
