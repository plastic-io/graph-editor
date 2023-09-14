<template>
    <div @wheel.stop @mousedown.stop @mouseup.stop @click.stop>
        <v-card class="connector-info" v-if="activity" elevation="7">
        <div class="connector-info-system-bar no-graph-target" :key="activity.length">
            <v-icon title="Connector Information">
                mdi-information-outline
            </v-icon>
            [{{selectedIndex + 1}}/{{activity.length}}]
            <v-spacer></v-spacer>
            <v-icon style="margin-left: 3px;" title="Previous" :disabled="selectedIndex <= 0" @click="goPrevious">
                mdi-arrow-left-drop-circle-outline
            </v-icon>
            <v-icon title="Next" :disabled="!(selectedIndex < activity.length - 1)" @click="goNext">
                mdi-arrow-right-drop-circle-outline
            </v-icon>
            <v-tooltip top>
                <template v-slot:activator="{ props }">
                    <span v-bind="props" style="padding: 5px;">{{selectedActivity.event.connector.field}}</span>
                </template>
                Field
            </v-tooltip>
            <v-tooltip top>
                <template v-slot:activator="{ props }">
                    <span v-bind="props" style="padding: 5px;">{{selectedActivity.activityType}}</span>
                </template>
                Event Type
            </v-tooltip>
            <v-tooltip top>
                <template v-slot:activator="{ props }">
                    <span v-bind="props" style="padding: 5px;">{{typeof selectedActivity.event.value}}</span>
                </template>
                typeof
            </v-tooltip>
            <v-tooltip top>
                <template v-slot:activator="{ props }">
                    <span v-bind="props" style="padding: 5px;">{{fromNow(selectedActivity.event.time)}}</span>
                </template>
                Occured
            </v-tooltip>
            <v-divider/>
            <v-icon @click="$emit('close');">
                mdi-close
            </v-icon>
        </div>
            <v-card-text>
                <div class="connector-info-value">
                    <pre class="dont-propagate-copy">{{selectedActivity.event.value}}</pre>
                </div>
            </v-card-text>
        </v-card>
    </div>
</template>
<script>
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {mapWritableState, mapActions, mapState} from "pinia";
import moment from "moment";
export default {
    name: "connector-info",
    watch: {
        activity: {
            handler() {
                this.changeVersion += 1;
            },
            deep: true,
        },
    },
    methods: {
        goPrevious() {
            if (this.selectedIndex > 0) {
                this.selectedIndex -= 1;
            }
        },
        goNext() {
            console.log("Go next");
            if (this.selectedIndex < this.activity.length - 1) {
                this.selectedIndex += 1;
            }
        },
        fromNow(e) {
            return moment(new Date(e)).fromNow();
        }
    },
    computed: {
        ...mapState(useGraphStore, [
            'hoveredConnector',
            'selectedConnectors',
            'activityConnectors',
        ]),
        selectedActivity() {
            return this.activity[this.selectedIndex];
        },
        activity: function() {
            if (!this.hoveredConnector && this.selectedConnectors.length === 0) {
                return null;
            }
            const key = this.hoveredConnector ? this.hoveredConnector.connector.id : this.selectedConnectors[0].id;
            return this.activityConnectors[key];
        },
    },
    data: () => ({
        selectedIndex: 0,
        changeVersion: 0,
    }),
};
</script>
<style>
.connector-info-value {
    max-width: 50vw;
    max-height: 50vh;
    overflow: auto;
}
.connector-info {
    position: fixed;
    bottom: 30px;
    right: 10px;
}

.connector-info-system-bar {
    cursor: grab;
    height: 22px;
    font-size: 12px;
    padding-left: 5px;
    white-space: nowrap;
}
</style>
