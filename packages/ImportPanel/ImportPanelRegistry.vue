<template>
    <v-card style="height: calc(80vh - 220px);">
        <v-card-title>
            <v-combobox
                help-topic="importPublicRegistryList"
                v-model="selectedRegistry"
                :items="registryList"
            />
        </v-card-title>
        <v-tabs :key="selectedRegistry" v-model="tabs">
            <v-tab v-for="(category, index) in selectedRegistryCollection" :key="index" help-topic="importPublicTopLevel">
                {{category.name}}
            </v-tab>
        </v-tabs>
        <v-window v-model="tabs">
          <v-window-item v-for="(category, index) in selectedRegistryCollection" :key="index" style="overflow-y: auto;">
              <v-expansion-panels flat accordion v-if="registry[category.artifact] !== undefined">
                  <v-expansion-panel v-for="(subCategory, index) in registry[category.artifact].toc.items" :key="index" help-topic="importPublicSecondLevel">
                      <v-expansion-panel-title>
                          {{subCategory.name}}
                      </v-expansion-panel-title>
                      <v-expansion-panel-text class="pb-0" >
                        <div v-for="(item, index) in groupItems(subCategory.items)" :key="index">
                          <v-list dense help-topic="importPublicList">
                              <v-list-group>
                                  <template v-slot:activator>
                                      <div class="import-item" draggable="true" style="cursor: copy;" @dragstart.stop="dragStart($event, item)">
                                          <v-list-item-subtitle style="opacity: 1;">
                                                <p>
                                                    <v-icon :title="item.type === 'publishedGraph' ? 'Graph' : 'Node'">
                                                        {{item.icon || iconType(item.type)}}
                                                    </v-icon>
                                                    {{item.name || "Untitled"}}
                                                </p>
                                                <i v-if="item.description">{{item.description}}</i>
                                                <i v-else>No description</i>
                                          </v-list-item-subtitle>
                                      </div>
                                  </template>
                                  <v-list-item dense v-for="(artifact, index) in detailItems(subCategory.items, item)" :key="index">
                                      <span draggable="true" style="cursor: copy; margin-left: 25px;" @dragstart.stop="dragStart($event, artifact)">
                                          <v-icon>{{artifact.icon}}</v-icon>
                                      </span>
                                      <div>
                                          <v-list-item-title>v{{artifact.version}}</v-list-item-title>
                                          <v-list-item-subtitle>
                                              <div v-if="item.description">{{item.description}}</div>
                                              <div v-else><i>No description</i></div>
                                          </v-list-item-subtitle>
                                      </div>
                                  </v-list-item>
                              </v-list-group>
                          </v-list>
                        </div>
                      </v-expansion-panel-text>
                  </v-expansion-panel>
              </v-expansion-panels>
          </v-window-item>
        </v-window>
    </v-card>
</template>
<script lang="ts">
import {mapActions, mapState} from "pinia";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
export default {
    name: "import-panel-registry",
    data: () => {
        return {
            search: "",
            selectedItem: null,
            selectedRegistry: null,
            tabs: null,
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
            url: this.registryList[this.registryList.length -1],
            parent: "root",
        });
    },
    methods: {
        ...mapActions(useOrchestratorStore, [
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
                newNode: "mdi-shape-rectangle-plus",
                publishedNode: "mdi-network",
                publishedGraph: "mdi-switch",
            }[item] || "";
        },
    },
    computed: {
        ...mapState(usePreferencesStore, [
            'preferences',
        ]),
        ...mapState(useOrchestratorStore, [
            'registry',
        ]),
        artifacts() {
            return () => {
                return [];
            };
        },
        registryList() {
            return this.preferences.registries.split(',');
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
<style>
.import-item {
    background: rgba(var(--v-theme-info));
}
</style>