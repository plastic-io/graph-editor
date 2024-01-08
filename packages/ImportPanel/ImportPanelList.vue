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
    data: () => {
        return {
            localToc: null,
            search: "",
            selectedItem: null,
        };
    },
    mounted() {
        this.getToc();
    },
    methods: {
        ...mapActions(useOrchestratorStore, [
            "getToc",
            "download",
        ]),
        dragStart(e, item) {
            e.dataTransfer.setData("application/json+plastic-io", JSON.stringify(item));
            e.dataTransfer.dropEffect = "link";
        },
        iconType(item) {
            return {
                publishedVector: "mdi-network",
                publishedGraph: "mdi-switch",
            }[item] || "mdi-graph";
        },
        groupByPrefix(toc) {
            const {id, ...arts } = toc;
            const group = {};
            Object.values(arts)
                .filter(item => /published/.test(item.type))
                .forEach((item) => {
                    const [prefix, suffix] = item.id.split('.');
                    group[prefix] = group[prefix] || [];
                    group[prefix].push(item);
                });
            Object.keys(group).forEach((prefix) => {
                group[prefix].sort((a, b) => {
                    return new Date(a) - new Date(b);
                });
            });
            return group;
        },
    },
    computed: {
        ...mapState(useOrchestratorStore, [
            'toc',
        ]),

        list() {
            return this.groupByPrefix(this.toc);
        },
        artifacts() {
            return (id) => {
                const regEx = new RegExp(this.search, "ig");
                return this.list.filter((item) => {
                    return /published/.test(item.type) && item.id === id
                        && (this.search === ""
                            || (regEx.test(item.name)
                            || regEx.test(item.description)
                            || item.tags.split(",").find((tag) => regEx.test(tag)))
                        );
                });
            };
        },
        items() {
            const items = {};
            const regEx = new RegExp(this.search, "ig");
            this.list.filter((item) => {
                return (this.search === "" || item.tags.split(",").find((tag) => regEx.test(tag)) || (regEx.test(item.name) || regEx.test(item.description)));
            }).sort((a, b) => {
                return (a.name || '').localeCompare(b.name);
            }).forEach((item) => {
                if (/published/.test(item.type)) {
                    if (!items[item.id] || items[item.id].version < item.version) {
                        items[item.id] = item;
                    }
                }
            });
            return Object.keys(items).map(key => items[key]);
        }
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
