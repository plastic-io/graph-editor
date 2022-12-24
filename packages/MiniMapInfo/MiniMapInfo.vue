<template>
    <div class="map-view no-select" :style="mapStyle" @wheel.stop @click.stop v-if="graphSnapshot">
        <v-card elevation="7">
            <div class="map-system-bar" @mousedown.stop="startTranslate">
                <v-icon title="Close Map" @click="preferences.showMap = false">
                    mdi-map
                </v-icon>
                <div help-topic="viewportLocation" title="Viewport localtion" style="padding-right: 10px;cursor: crosshair;" @click="resetView">
                    x:{{ view.x.toFixed(0) }} y:{{ view.y.toFixed(0) }}
                </div>
                <v-spacer/>
                <v-icon title="Zoom Out (^ + -)" style="cursor: pointer;" @click="zoomOut">mdi-magnify-minus-outline</v-icon>
                <div
                    help-topic="viewportZoom"
                    @click="resetZoom"
                    title="Zoom Level"
                    style="padding-right: 5px;cursor: crosshair;">
                    {{ (view.k * 100).toFixed(2) }}%
                </div>
                <v-icon
                    @click="zoomIn"
                    title="Zoom In (^ + +)"
                    style="cursor: pointer;"
                    >mdi-magnify-plus-outline</v-icon>
                <v-icon title="Close Map" @click="preferences.showMap = false">
                    mdi-close
                </v-icon>
            </div>
            <v-card-text class="pa-0">
                <div class="graph-map" ref="map">
                    <div style="position: relative;">
                        <div class="graph-map-view-port" :style="viewMapStyle"></div>
                        <div class="graph-map-node" :style="nodeMapStyle(node)" v-for="node in graphSnapshot.nodes" :key="node.id"></div>
                    </div>
                </div>
            </v-card-text>
        </v-card>
    </div>
</template>
<script>
import {mapState, mapWritableState, mapActions} from "pinia";
import {useStore as useInputStore} from "@plastic-io/graph-editor-vue3-input";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
export default {
    name: "mini-map-info",
    data() {
        return {
            pos: {
              x: 10,
              y: 30,
            },
            translating: {
              x: 0,
              y: 0
            },
            min: {},
            max: {},
            scale: 1,
            mapPosOffset: {
                x: 0,
                y: 0,
            },
        };
    },
    watch: {
        view() {
            this.updateScale();
        },
        graphSnapshot: {
            handler() {
                this.updateScale();
            },
            deep: true,
        },
    },
    methods: {
        ...mapActions(useGraphStore, [
            'zoomIn',
            'zoomOut',
            'resetZoom',
            'resetView',
        ]),
        startTranslate() {
          console.log("start translate");
          // window.addEventListener('mousemove', translate);
          // window.addEventListener("resize", this.updateScale);
        },
        updateScale() {
            if (!this.$refs.map) {
                return;
            }
            const rect = this.$refs.map.getBoundingClientRect();
            this.mapPosOffset = {
                x: (rect.width / 2) - 20,
                y: rect.height / 2 - 20,
            };
            this.min = {
                x: Math.min.apply(null, this.graphSnapshot.nodes.map(v => v.properties.x)),
                y: Math.min.apply(null, this.graphSnapshot.nodes.map(v => v.properties.y)),
            };
            this.max = {
                x: Math.max.apply(null, this.graphSnapshot.nodes.map(v => v.properties.x)),
                y: Math.max.apply(null, this.graphSnapshot.nodes.map(v => v.properties.y)),
            };
            const ratio = Math.max((-Math.min((this.min.y - this.max.y), (this.min.x - this.max.x)) / 50), 10);
            this.scale = ratio;
            this.mapScale = this.scale;
        },
    },
    mounted() {
        [1, 100, 1000, 2000, 4000].forEach((n) => {
            setTimeout(() => {
                this.updateScale();
            }, n);
        });
    },
    unmounted() {
        window.removeEventListener("resize", this.updateScale);
    },
    computed: {
        ...mapState(useInputStore, [
            'buttonMap',
            'mouse',
        ]),
        ...mapWritableState(usePreferencesStore, [
            'preferences',
        ]),
        ...mapWritableState(useGraphStore, [
            'mapScale',
        ]),
        ...mapState(useGraphStore, [
            'graphSnapshot',
            'view',
        ]),
        mapStyle() {
          return {
            top: this.pos.y + 'px',
            right: this.pos.x + 'px',
          };
        },
        viewMapStyle() {
            return {
                background: this.$vuetify.theme.current.colors.primary,
                opacity: 0.4,
                outline: `solid 0.5px ${this.$vuetify.theme.current.colors.accent}EE`,
                left: ((-this.view.x / this.scale) / this.view.k) + this.mapPosOffset.x + "px",
                top: ((-this.view.y / this.scale) / this.view.k) + this.mapPosOffset.y + "px",
                height: (window.innerHeight / this.scale) / this.view.k + "px",
                width: (window.innerWidth / this.scale) / this.view.k + "px",
            };
        },
        nodeMapStyle() {
            return (vect) => {
                const el = document.getElementById("node-" + vect.id);
                if (!el) {
                    return {};
                }
                const rect = el.getBoundingClientRect();
                return {
                    opacity: 1,
                    background: this.$vuetify.theme.current.colors.accent,
                    outline: `solid 0.5px ${this.$vuetify.theme.current.colors.secondary}EE`,
                    left: (vect.properties.x / this.scale) + this.mapPosOffset.x + "px",
                    top: (vect.properties.y / this.scale) + this.mapPosOffset.y + "px",
                    height: (rect.height / this.scale) / this.view.k + "px",
                    width: (rect.width / this.scale) / this.view.k + "px",
                };
            };
        },
    },
};
</script>
<style>
.graph-map-view-port {
    position: absolute;
}
.graph-map-node {
    position: absolute;
}
.map-view {
    position: fixed;
}
.map-system-bar {
    width: 280px;
    height: 24px;
    background: navy;
}
.graph-map {
    overflow: hidden;
    padding: 0;
    width: 280px;
    height: 120px;
}
</style>
