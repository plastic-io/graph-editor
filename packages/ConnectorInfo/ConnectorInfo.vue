<template>
    <div class="connector-info-container" @wheel.stop @mousedown.stop @mouseup.stop @click.stop>
        <v-card min-width="400px" class="pa-2" height="100%">
            <v-card-actions class="py-0">
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
                    <i v-if="selectedConnectors.length > 0 && selectedActivity.empty">No Activity</i>
                </div>
            </v-card-title>
            <v-card-text class="pt-1 connector-meta-info-sub">
                <div v-show="selectedActivity.event.time">
                    Occured {{fromNow(selectedActivity.event.time)}}
                </div>
                <div v-if="!selectedActivity.empty" class="connector-info-typeof">
                    typeof {{typeof selectedActivity.event.value}}
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
        copy(val) {
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
        fromNow(e) {
            return moment(new Date(e)).fromNow();
        },
        formatActivityValue(val) {
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
        ]),
        selectedActivity() {
            const activity = this.activity[this.selectedIndex] || this.emptyActivity;
            return activity;
        },
        selectedActivityEnd() {
            const end = (this.activityConnectors[this.activityKey] || [])
                .find(a => a.activityType === 'end' && this.selectedActivity.key === a.key);
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
        activity() {
            if (!this.activityKey || (!this.hoveredConnector && this.selectedConnectors.length === 0)) {
                return [];
            }
            return (this.activityConnectors[this.activityKey] || [])
                .filter(a => a.activityType === 'start');
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
