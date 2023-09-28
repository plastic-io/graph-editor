<template>
    <div style="height: calc(80vh - 220px);">
        <v-text-field placeholder="Search" class="pr-3" v-model="search" help-topic="importLocalSearch">
            <template v-slot:prepend>
                <v-icon>mdi-magnify</v-icon>
            </template>
        </v-text-field>
        <v-list v-if="list">
            <v-divider class="ma-3" help-topic="importLocalList"/>
            <v-list-item
                v-for="item in items"
                :key="item.title"
                :prepend-icon="item.action"
                draggable="true"
                style="cursor: copy;"
                @dragstart="dragStart($event, item)"
            >
                <v-list-item-media>
                    <v-icon
                        :title="item.type === 'publishedGraph' ? 'Graph' : 'Vector'"
                    >
                        {{item.icon || iconType(item.type)}}
                    </v-icon>
                </v-list-item-media>
                <v-list-item-title>
                    {{item.title || "Untitled"}}
                </v-list-item-title>
                <v-list-item-subtitle>
                    {{item.description || "No Description"}}
                </v-list-item-subtitle>
            </v-list-item>
        </v-list>
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
            }[item] || "";
        },
    },
    computed: {
        ...mapState(useOrchestratorStore, [
            'toc',
        ]),
        list() {
          return Object.keys(this.toc || {}).map(i => this.toc[i]);
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
<style></style>
