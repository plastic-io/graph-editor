<template>
    <div style="height: calc(80vh - 220px); overflow: scroll;">
        <v-expansion-panels v-if="list" flat accordion>
            <v-expansion-panel v-for="item in list">
                <v-expansion-panel-title>
                    <div draggable="true" @dragstart.stop="dragStart($event, item[0])" style="cursor: copy;" class="import-item">
                        <p><v-icon :icon="item[0].icon || iconType(item[0].type)"/>{{item[0].name}}</p>
                        <i>{{item[0].description || "No Description"}}</i>
                    </div>
                </v-expansion-panel-title>
                <v-expansion-panel-text class="pb-0">
                    <v-list>
                        <v-list-item
                            v-for="subItem in item"
                            :key="subItem.title"
                            :prepend-icon="subItem.action"
                            draggable="true"
                            style="cursor: copy;"
                            @dragstart="dragStart($event, subItem)"
                        >
                            <v-list-item-title>
                               <v-icon :title="subItem.type === 'publishedGraph' ? 'Graph' : 'Node'">
                                    {{subItem.icon || iconType(subItem.type)}}
                                </v-icon>
                                {{subItem.title || subItem.name || "Untitled"}} - v{{subItem.version}}
                            </v-list-item-title>
                        </v-list-item>
                    </v-list>
                </v-expansion-panel-text>
            </v-expansion-panel>
        </v-expansion-panels>
    </div>
</template>
<script lang="ts">
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {mapActions, mapState} from "pinia";
export default {
    name: "import-panel-list",
    mounted() {
        this.getToc();
    },
    methods: {
        ...mapActions(useOrchestratorStore, [
            "getToc",
        ]),
        dragStart(e: any, item: any) {
            e.dataTransfer.setData("application/json+plastic-io", JSON.stringify(item));
            e.dataTransfer.dropEffect = "link";
        },
        iconType(item: string) {
            return {
                publishedVector: "mdi-network",
                publishedNode: "mdi-network",
                publishedGraph: "mdi-switch",
            }[item] || "mdi-graph";
        },
        groupByPrefix(toc: any) {
            const {id, ...arts } = toc || {};
            const group: Record<string, any[]> = {};
            (Object.values(arts) as any[])
                .filter((item: any) => /published/.test(item.type))
                .forEach((item: any) => {
                    const [prefix, suffix] = item.id.split('.');
                    group[prefix] = group[prefix] || [];
                    group[prefix].push(item);
                });
            Object.keys(group).forEach((prefix) => {
                group[prefix].sort((a, b) => {
                    return b.version - a.version;
                });
            });
            return group;
        },
    },
    computed: {
        ...mapState(useOrchestratorStore, [
            'toc',
        ]),

        list(): Record<string, any[]> {
            return this.groupByPrefix(this.toc);
        },
    },
};
</script>
<style>
.import-item {
    background: rgba(var(--v-theme-info));
    width: 100%;
    border-radius: 5px;
    padding: 6px;
}
</style>
