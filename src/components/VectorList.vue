<template>
    <v-card class="ma-0 pa-0" flat style="overflow-y: scroll; height: calc(100vh - 97px);">
        <v-card-text class="ma-0 pa-0">
            <v-list help-topic="graphVectorList" three-line v-if="graphSnapshot.vectors.length > 0">
                <v-list-item-group v-model="selectedList" color="primary" multiple>
                    <v-list-item v-for="vector in graphSnapshot.vectors" :key="'select_' + vector.id">
                        <template v-slot:default="{ active }">
                            <v-list-item-content>
                                <v-list-item-title :title="vector.id">
                                    <v-checkbox title="Selected" style="transform: translate(0, 4px);" class="d-inline-block" :value="active"/>
                                    <v-icon v-text="vector.properties.icon"></v-icon>
                                    {{vector.properties.name || 'Untitled Vector'}}
                                </v-list-item-title>
                            </v-list-item-content>
                        </template>
                    </v-list-item>
                </v-list-item-group>
            </v-list>
            <i v-else class="ma-5">No Vectors</i>
        </v-card-text>
    </v-card>
</template>
<script>
import {mapState, mapMutations, mapActions} from "vuex";
export default {
    name: "vector-list",
    props: {

    },
    methods: {
        ...mapActions([
            "raiseError",
            "save",
        ]),
        ...mapMutations([
            "updateVectorUrl",
            "selectVectors",
            "showInfoDialog",
        ]),
        copyVectorUrl(e, url) {
            navigator.clipboard.writeText(url).then(() => {
                this.showInfoDialog("URL Copied!");
            }, (err) => {
                this.raiseError(new Error("Clipboard write failed" + err));
            });
        },
        updateUrl(vectorId, url) {
            // console.log("updateUrl", vectorId, url);
            this.updateVectorUrl({
                vectorId,
                url,
            });
        },
    },
    computed: {
        ...mapState({
            preferences: state => state.preferences,
            graphSnapshot: state => state.graphSnapshot,
            selectedVectors: state => state.selectedVectors,
        }),
        selectedList: {
            get() {
                const selectedVectorsIds = this.selectedVectors.map(v => v.id);
                return this.graphSnapshot.vectors.map((vector, index) => {
                    return selectedVectorsIds.indexOf(vector.id) === -1 ? undefined : index;
                }).filter(v => v !== undefined);
            },
            set(val) {
                const ids = val.map((index) => {
                    return this.graphSnapshot.vectors[index].id;
                });
                this.selectVectors(ids);
            },
        },
    },
    data: () => {
        return {
            vectorList: 0,
        };
    },
};
</script>
<style></style>
