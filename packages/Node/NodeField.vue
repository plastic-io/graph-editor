<template>
    <div
        v-if="!presentation"
        @mouseover="hoverPort"
        :style="connectorWarn ? 'cursor: not-allowed;' : ''"
    >
        <div
            help-topic="node-edge"
            ref="edge"
            :style="nodeFieldStyle"
            class="node-field"
            :title="field.name"
            :key="preferences.showLabels"
            :id="`node-${type}-${node.id}-${field.name}`"
        ></div>
        <div
            v-if="preferences.showLabels || isHovered"
            :style="nodeNameStyle"
            :class="(type === 'output' ? 'node-field-output' : 'node-field-input')">
                {{field.name}}
        </div>
    </div>
</template>
<script>
import {mapWritableState, mapActions, mapState} from "pinia";

import {Node} from "@plastic-io/plastic-io";

import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";

export default {
    name: "node-field",
    computed: {
        ...mapWritableState(usePreferencesStore, [
            'preferences',
        ]),
        ...mapWritableState(useGraphStore, [
            'hoveredPort',
        ]),
        ...mapState(useOrchestratorStore, [
            'connectorWarn',
            'presentation',
        ]),
        isHovered() {
            return this.hoveredPort && this.hoveredPort.node.id === this.node.id
                && this.hoveredPort.field.name === this.field.name
                && this.type === this.hoveredPort.type;
        },
        nodeFieldStyle() {
            return {
                background: this.type === "output" ? "var(--v-info-lighten2)" : "var(--v-info-lighten2)",
                outline: this.isHovered ? "solid 1px var(--v-info-lighten2)" : undefined,
            };
        },
        nodeNameStyle() {
            return {
                outline: this.isHovered ? "solid 1px var(--v-info-lighten2)" : undefined,
            };
        },
        edge() {
            return this.node.edges.find((edge) => {
                return edge.field === this.field.name;
            });
        },
    },
    methods: {
        hoverPort() {
            this.hoveredPort = {
                field: this.field,
                node: this.node,
                edge: this.edge,
                type: this.type,
            };
        },
    },
    props: {
        field: Object,
        node: Node,
        type: String,
    }
};
</script>
<style>
.node-field {
    height: 15px;
    width: 15px;
    margin-bottom: 5px;
}
.node-field-output, .node-field-input {
    position: absolute;
    white-space: nowrap;
    transform: translate(0, -23px);
    text-shadow: 0 0 1px rgba(255,255,255,.1), 0 0 1px rgba(0,0,0,.5);
}
.node-field-output {
    color: var(--v-primary-base);
    left: 200%;
}
.node-field-input {
    color: var(--v-accent-darken1);
    right: 200%;
}
</style>
