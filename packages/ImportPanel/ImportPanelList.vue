<template>
    <v-list v-if="list">
        <v-list-subheader help-topic="importLocalSearch">
            <v-text-field placeholder="Search" v-model="search">
                <template v-slot:prepend>
                    <v-icon>mdi-magnify</v-icon>
                </template>
            </v-text-field>
        </v-list-subheader>
        <v-divider class="ma-3" help-topic="importLocalList"/>
        <v-list-item
            v-model="selectedItem"
            style="overflow-y: auto; height: calc(100vh - 305px);margin-right: 3px;margin-bottom: -5px;">
            <v-list-item
            v-for="item in items"
            :key="item.title"
            v-model="item.active"
            :prepend-icon="item.action"
            >
                <template v-slot:activator>
                    <v-list-img draggable="true" style="cursor: copy;" @dragstart="dragStart($event, item)">
                        <v-icon :title="item.type === 'publishedGraph' ? 'Graph' : 'Vector'">
                            {{item.icon || iconType(item.type)}}
                        </v-icon>
                    </v-list-img>
                    <div>
                        {{item.name || "Untitled"}}
                        <v-list-item-subtitle>
                            <span v-if="item.description">{{item.description}}</span>
                            <span v-else><i>No description</i></span>
                        </v-list-item-subtitle>
                        <v-list-item-subtitle>
                            <span v-if="item.tags" class="font-italic font-weight-thin"><i>{{item.tags.split(',').join(', ')}}</i></span>
                            <span v-else><i>No Tags</i></span>
                        </v-list-item-subtitle>
                    </div>
                    <v-list-img>
                        <v-tooltip bottom>
                            <template v-slot:activator="{ on: tooltip }">
                                <v-icon v-on="{ ...tooltip }">mdi-information-outline</v-icon>
                            </template>
                            <div>Latest Version: {{item.version}}</div>
                            <div>Id: {{item.id}}</div>
                            <div>Last Updated: {{item.lastUpdate}}</div>
                            <div>Total Versions: {{artifacts(item.id).length}}</div>
                            <div v-if="item.description">{{item.description}}</div>
                            <div v-else><i>No description</i></div>
                        </v-tooltip>
                    </v-list-img>
                </template>
                <template>
                    <v-list-item v-for="(artifact, index) in artifacts(item.id)" :key="index">
                        <v-list-img draggable="true" style="cursor: copy; margin-left: 25px;" @dragstart="dragStart($event, artifact)">
                            <v-icon>{{artifact.icon}}</v-icon>
                        </v-list-img>
                        <div>
                            <v-list-item-title>v{{artifact.version}}</v-list-item-title>
                            <v-list-item-subtitle>
                                <div v-if="item.description">{{item.description}}</div>
                                <div v-else><i>No description</i></div>
                            </v-list-item-subtitle>
                        </div>
                        <v-list-img>
                            <v-btn @click.stop="download(item)" title="Download">
                                 <v-icon>
                                    mdi-download
                                </v-icon>
                         </v-btn>
                        </v-list-img>
                    </v-list-item>
                </template>
            </v-list-item>
        </v-list-item>
    </v-list>
</template>
<script>
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
            const t = Object.keys(this.toc || {}).map(i => this.toc[i]);
            console.log('t', t);
          return ;
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
                return a.name.localeCompare(b.name);
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
