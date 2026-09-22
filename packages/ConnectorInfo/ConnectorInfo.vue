<template>
    <div class="connector-info-container" @wheel.stop @mousedown.stop @mouseup.stop @click.stop>
        <v-card min-width="400px" class="pa-2" height="100%">
            <v-card-actions class="py-0">
                <v-btn-toggle v-model="source" density="compact" variant="outlined" divided mandatory class="mr-2">
                    <v-btn value="live" size="x-small" title="What crossed this connector in this browser, since the graph was opened">
                        here {{ liveActivity.length }}
                    </v-btn>
                    <v-btn value="recorded" size="x-small" :loading="loadingRecorded" title="What crossed it in any execution the server kept, including ones that ran elsewhere">
                        kept {{ recorded.length }}
                    </v-btn>
                </v-btn-toggle>
                <div :key="activity.length" class="py-0">
                    <v-icon
                        color="secondary"
                        class="ml-1" title="Previous"
                        :disabled="selectedIndex <= 0"
                        @click="goPrevious">
                        mdi-arrow-left-drop-circle-outline
                    </v-icon>
                    <div class="px-2 d-inline-block">
                        {{selectedIndex + 1}}/{{activity.length}}
                    </div>
                    <v-icon
                        color="secondary"
                        class="ml-1"
                        title="Next"
                        :disabled="!(selectedIndex < activity.length - 1)"
                        @click="goNext">
                        mdi-arrow-right-drop-circle-outline
                    </v-icon>
                </div>
            </v-card-actions>
            <v-card-title class="ml-3 pa-0 connector-meta-info">
                <div v-if="!selectedActivity.empty" class="w-33 mx-0  d-inline-block pl-1">
                    <v-icon v-if="!selectedActivityEnd.empty" icon="mdi-arrow-right" color="info"/>
                    {{selectedActivityEnd.event.duration}}ms
                    <v-icon v-if="selectedActivityEnd.empty" icon="mdi-clock" color="primary"/>
                    <v-icon v-if="!selectedActivityEnd.empty" icon="mdi-arrow-right" color="info"/>
                    {{selectedActivity.event.connector.field}}
                </div>
                <div v-else>
                    <i v-if="selectedConnectors.length === 0">No Connector Selected</i>
                    <i v-else-if="source === 'recorded' && loadingRecorded">Looking through what was kept</i>
                    <i v-else-if="source === 'recorded'">Nothing kept for this connector</i>
                    <i v-else>No Activity</i>
                </div>
            </v-card-title>
            <v-card-text class="pt-1 connector-meta-info-sub">
                <div v-show="selectedActivity.event.time">
                    Occured {{fromNow(selectedActivity.event.time)}}
                    <span v-if="selectedActivity.recorded" class="text-disabled">
                        · {{selectedActivity.domain}} · {{selectedActivity.executionId.slice(-6)}}
                    </span>
                </div>
                <div v-if="!selectedActivity.empty" class="connector-info-typeof">
                    <span v-if="selectedActivity.valueKept">typeof {{typeof selectedActivity.event.value}}</span>
                    <span v-else-if="selectedActivity.recorded">
                        {{shapeOf(selectedActivity)}} — this graph keeps the shape of what crosses here, not the value
                    </span>
                    <span v-else>typeof {{typeof selectedActivity.event.value}}</span>
                </div>
            </v-card-text>
            <v-card-text class="pa-0 connector-info-system-bar no-graph-target" elevation="7">
                <v-icon
                    @click="copy(selectedActivity.event.value)"
                    icon="mdi-content-copy"
                    size="x-small"
                    style="float: right;margin-left: -25px;z-index: 2;"
                />
                <pre class="connector-info-value dont-propagate-copy"
                    v-html="formatActivityValue(selectedActivity.event.value)"/>
                
            </v-card-text>
        </v-card>
    </div>
</template>
<script lang="ts">
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {mapWritableState, mapActions, mapState} from "pinia";
import {fromJSON} from 'flatted';
import moment from "moment";
export default {
    name: "connector-info",
    data: () => ({
        selectedIndex: 0,
        changeVersion: 0,
        /** "here" is what this browser saw; "kept" is what the server holds. */
        source: "live" as "live" | "recorded",
        recorded: [] as any[],
        loadingRecorded: false,
        recordedFor: "",
        emptyActivity: {
            empty: true,
            activityType: 'No activity',
            event: {
                time: 0,
                value: 'No value',
                connector: {
                    field: ''
                }
            }
        },
    }),
    watch: {
        activityKey() {
            this.selectedIndex = 0;
            this.recorded = [];
            this.recordedFor = "";
            if (this.source === "recorded") {
                this.loadRecorded();
            }
        },
        source() {
            this.selectedIndex = 0;
            if (this.source === "recorded") {
                this.loadRecorded();
            }
        },
        activity: {
            handler() {
                this.changeVersion += 1;
            },
            deep: true,
        },
    },
    methods: {
        ...mapActions(useOrchestratorStore, ['copyToClipboard']),
        copy(val: any) {
            try {
                this.copyToClipboard(fromJSON(val));
            } catch (err) {
                console.error("Unable to copy to clipboard:", err);
            }
        },
        goPrevious() {
            if (this.selectedIndex > 0) {
                this.selectedIndex -= 1;
            }
        },
        goNext() {
            if (this.selectedIndex < this.activity.length - 1) {
                this.selectedIndex += 1;
            }
        },
        fromNow(e: any) {
            return moment(new Date(e)).fromNow();
        },
        /**
         * What crossed this connector in executions this browser did not run
         * (plan §4.5.3, PB-114).  A hop that happened on the server, in
         * somebody else's session, or before this page was opened leaves no
         * trace here; the server kept it, so ask.
         */
        async loadRecorded() {
            const orchestrator: any = useOrchestratorStore();
            const provider = (orchestrator.syncProviders || []).find((p: any) => typeof p.observations === "function");
            const graphId = this.graph && this.graph.id;
            const connectorId = this.activityKey;
            if (!provider || !graphId || !connectorId || this.recordedFor === connectorId) {
                return;
            }
            this.loadingRecorded = true;
            try {
                const answer = await provider.observations(graphId, {connectorId, kind: "route", limit: 50});
                this.recorded = ((answer && answer.observations) || []).map((o: any) => this.asActivity(o));
                this.recordedFor = connectorId;
            } catch (err: any) {
                console.warn("Cannot ask what crossed this connector.", err);
                this.recorded = [];
            } finally {
                this.loadingRecorded = false;
            }
        },
        /** One kept observation, in the shape this panel already knows how to show. */
        asActivity(observation: any) {
            const payload = observation.payload || {};
            const kept = payload.value !== undefined;
            return {
                empty: false,
                activityType: "start",
                recorded: true,
                valueKept: kept,
                domain: observation.domain || "server",
                executionId: observation.executionId || "",
                meta: payload.meta,
                redacted: payload.redacted,
                event: {
                    time: new Date(observation.at).getTime(),
                    value: kept ? payload.value : undefined,
                    connector: {field: observation.edgeField || ""},
                },
            };
        },
        /** What is known about a value that was not kept whole. */
        shapeOf(activity: any): string {
            if (activity.redacted === "payload") {
                return "kept, but reading values needs graph:inspect-payloads";
            }
            if (activity.redacted === "secret") {
                return "a secret";
            }
            const meta = activity.meta || {};
            return [meta.type, meta.bytes !== undefined ? `${meta.bytes} bytes` : ""].filter(Boolean).join(" · ") || "no shape recorded";
        },
        formatActivityValue(val: any) {
            let out;
            if (typeof val === 'object') {
                return JSON.stringify(val)
            }
            try {
                out = JSON.stringify(JSON.parse(val), null, '  ');
            } catch (_) {
                out = val
            }
            return val;
        }
    },
    computed: {
        ...mapState(useGraphStore, [
            'hoveredConnector',
            'selectedConnectors',
            'activityConnectors',
            'graph',
        ]),
        selectedActivity() {
            const activity = this.activity[this.selectedIndex] || this.emptyActivity;
            return activity;
        },
        selectedActivityEnd() {
            if (this.selectedActivity.recorded) {
                return this.emptyActivity;      // a kept observation has no end of its own
            }
            const end = (this.activityConnectors[this.activityKey] || [])
                .find((a: any) => a.activityType === 'end' && this.selectedActivity.key === a.key);
            return end || this.emptyActivity;
        },
        firstSelectedConnectorId() {
            return this.selectedConnectors.length > 0 ? this.selectedConnectors[0].id : '';
        },
        activityKey() {
            return this.hoveredConnector
                ? this.hoveredConnector.connector.id
                : this.firstSelectedConnectorId;
        },
        liveActivity(): any[] {
            if (!this.activityKey || (!this.hoveredConnector && this.selectedConnectors.length === 0)) {
                return [];
            }
            return (this.activityConnectors[this.activityKey] || [])
                .filter((a: any) => a.activityType === 'start');
        },
        activity(): any[] {
            if (!this.activityKey || (!this.hoveredConnector && this.selectedConnectors.length === 0)) {
                return [];
            }
            return this.source === "recorded" ? this.recorded : this.liveActivity;
        },
    },
};
</script>
<style>
.connector-info-typeof {
    color: rgba(var(--v-theme-info));
}
.connector-meta-info {
    height: 25px;
    overflow: hidden;
}
.connector-meta-info-sub {
    height: 50px;
    overflow: hidden;
}
.connector-info-value {
    overflow: auto;
    height: 295px;
    background: #00000055;
}
.connector-info-container {
    position: fixed;
    bottom: 35px;
    right: 10px;
    height: 440px;
    width: 400px;
}
.connector-info-system-bar {
    cursor: grab;
    font-size: 12px;
    padding-left: 5px;
    white-space: nowrap;
}
</style>
