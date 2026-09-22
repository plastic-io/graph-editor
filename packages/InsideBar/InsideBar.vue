<template>
    <div v-if="insideInstance" class="inside-bar">
        <v-icon size="small" icon="mdi-magnify-expand" class="mr-1"/>
        <a href="#" @click.prevent="out()" :title="'Back to ' + insideInstance.hostName">{{ insideInstance.hostName }}</a>
        <template v-for="(step, i) in insideInstance.trail" :key="step.nodeId">
            <span class="sep">›</span>
            <a v-if="i < insideInstance.trail.length - 1" href="#" @click.prevent="upTo(i)">{{ step.name }}</a>
            <span v-else class="here">{{ step.name }}</span>
        </template>
        <span class="note">read only — this is {{ insideInstance.name }}</span>
        <a class="note source" href="#" @click.prevent="editSource()">Edit the source graph</a>
    </div>
</template>
<script lang="ts">
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {mapState} from "pinia";
/**
 * Where you are standing, when you are standing inside a call (PB-115).
 *
 * A call is named by the chain of hosts it was reached through, and that chain
 * is the only thing that says *which* call — the component is the same
 * document in all of them.  So the bar shows the chain, each step a way back to
 * it, and says plainly that what is on the canvas is read only and whose it is.
 */
export default {
    name: "inside-bar",
    computed: {
        ...mapState(useGraphStore, ['insideInstance']),
        ...mapState(useOrchestratorStore, ['pathPrefix']),
    },
    methods: {
        out() {
            this.$router.push(`${this.pathPrefix}${this.insideInstance.hostDocumentId}`);
        },
        upTo(index: number) {
            const path = this.insideInstance.path.slice(0, index + 1);
            this.$router.push(`${this.pathPrefix}${this.insideInstance.hostDocumentId}/inside/${path.join("/")}`);
        },
        /** The component's own document, where it can be changed and published. */
        editSource() {
            this.$router.push(`${this.pathPrefix}${this.insideInstance.graphId}`);
        },
    },
}
</script>
<style scoped>
.inside-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    padding: 2px 8px;
    opacity: 0.85;
}
.sep { opacity: 0.5; }
.here { font-weight: 600; }
.note { opacity: 0.7; margin-left: 12px; }
.source { text-decoration: underline; }
</style>
