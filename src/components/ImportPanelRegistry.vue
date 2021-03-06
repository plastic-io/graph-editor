<template>
    <v-card style="height: calc(100vh - 220px);">
        <v-card-title>
            <v-combobox
                help-topic="importPublicRegistryList"
                v-model="selectedRegistry"
                :items="registryList"
            />
        </v-card-title>
        <v-tabs :key="selectedRegistry">
            <v-tab v-for="(category, index) in selectedRegistryCollection" :key="index" help-topic="importPublicTopLevel">
                {{category.name}}
            </v-tab>
            <v-tab-item v-for="(category, index) in selectedRegistryCollection" :key="index" style="overflow-y: auto; height: calc(100vh - 370px);">
                <v-expansion-panels flat accordion v-if="registry[category.artifact] !== undefined">
                    <v-expansion-panel v-for="(subCategory, index) in registry[category.artifact].toc.items" :key="index" help-topic="importPublicSecondLevel">
                        <v-expansion-panel-header>
                            {{subCategory.name}}
                        </v-expansion-panel-header>
                        <v-expansion-panel-content class="pb-0" v-for="(item, index) in groupItems(subCategory.items)" :key="index">
                            <v-list dense help-topic="importPublicList">
                                <v-list-group>
                                    <template v-slot:activator>
                                        <v-list-item-icon draggable="true" style="cursor: copy;" @dragstart="dragStart($event, item)">
                                            <v-icon :title="item.type === 'publishedGraph' ? 'Graph' : 'Vector'">
                                                {{item.icon || iconType(item.type)}}
                                            </v-icon>
                                        </v-list-item-icon>
                                        <v-list-item-content>
                                            {{item.name || "Untitled"}}
                                            <v-list-item-subtitle>
                                                <span v-if="item.description">{{item.description}}</span>
                                                <span v-else><i>No description</i></span>
                                            </v-list-item-subtitle>
                                        </v-list-item-content>
                                        <v-list-item-icon>
                                            <v-tooltip bottom>
                                                <template v-slot:activator="{ on: tooltip }">
                                                    <v-icon v-on="{ ...tooltip }">mdi-information-outline</v-icon>
                                                </template>
                                                <div>Latest Version: {{item.version}}</div>
                                                <div>Last Updated: {{item.lastUpdate}}</div>
                                                <div>Total Versions: {{artifacts(item.id).length}}</div>
                                                <div v-if="item.description">{{item.description}}</div>
                                                <div v-else><i>No description</i></div>
                                            </v-tooltip>
                                        </v-list-item-icon>
                                    </template>
                                    <v-list-item dense v-for="(artifact, index) in detailItems(subCategory.items, item)" :key="index">
                                        <v-list-item-icon draggable="true" style="cursor: copy; margin-left: 25px;" @dragstart="dragStart($event, artifact)">
                                            <v-icon>{{artifact.icon}}</v-icon>
                                        </v-list-item-icon>
                                        <v-list-item-content>
                                            <v-list-item-title>v{{artifact.version}}</v-list-item-title>
                                            <v-list-item-subtitle>
                                                <div v-if="item.description">{{item.description}}</div>
                                                <div v-else><i>No description</i></div>
                                            </v-list-item-subtitle>
                                        </v-list-item-content>
                                    </v-list-item>
                                </v-list-group>
                            </v-list>
                        </v-expansion-panel-content>
                    </v-expansion-panel>
                </v-expansion-panels>
            </v-tab-item>
        </v-tabs>
    </v-card>
</template>
<script>
import {mapActions, mapState} from "vuex";
export default {
    name: "import-panel-registry",
    data: () => {
        return {
            search: "",
            selectedItem: null,
            selectedRegistry: null,
        };
    },
    watch: {
        registry: {
            handler: function () {
                this.selectedRegistry = Object.keys(this.registry)[0];
            },
            deep: true,
        },
    },
    mounted() {
        this.getPublicRegistry({
            url: this.publicGraphRegistries[this.publicGraphRegistries.length -1],
            parent: "root",
        });
    },
    methods: {
        ...mapActions([
            "getPublicRegistry",
        ]),
        detailItems(items, item) {
            const detailItems = items.filter(i => i.id === item.id);
            return detailItems;
        },
        groupItems(items) {
            const list = {};
            items.forEach((item) => {
                if (!list[item.id]) {
                    list[item.id] = item;
                    return;
                }
                if (list[item.id].version < item.version) {
                    list[item.id] = item;
                }
            });
            const groupItems = Object.keys(list).map(key => list[key]);
            return groupItems;
        },
        dragStart(e, item) {
            e.dataTransfer.setData("application/json+plastic-io", JSON.stringify(item));
            e.dataTransfer.dropEffect = "link";
        },
        iconType(item) {
            return {
                newVector: "mdi-shape-rectangle-plus",
                publishedVector: "mdi-network",
                publishedGraph: "mdi-switch",
            }[item] || "";
        },
    },
    computed: {
        ...mapState({
            publicGraphRegistries: state => state.publicGraphRegistries,
            registry: state => state.registry,
        }),
        artifacts() {
            return () => {
                return [];
            };
        },
        registryList() {
            return this.publicGraphRegistries;
        },
        selectedRegistryCollection() {
            if (Object.keys(this.registry).length === 0) {
                return [];
            }
            const selectedCollection = Object.keys(this.registry)
                .filter(r => r === this.selectedRegistry).map(r => this.registry[r])
                .filter(r => r.parent === "root");
            if (!selectedCollection || !selectedCollection[0] || !selectedCollection[0].toc) {
                return;
            }
            return selectedCollection[0].toc.items;
        }
    },
};
</script>
<style></style>
