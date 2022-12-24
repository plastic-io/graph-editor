<template>
    <div class="map-view no-select" :style="mapStyle" @wheel.stop @click.stop v-if="graphSnapshot">
        <v-card elevation="7">
            <div class="map-system-bar" :style="{backgroundColor: $vuetify.theme.current.colors['on-surface-variant']}"  @mousedown.stop="startTranslate">
                <v-icon title="Close Map" size="small" @click="preferences.showMap = false">
                    mdi-map
                </v-icon>
                <span help-topic="viewportLocation" title="Viewport localtion" class="viewport-location" @click="resetView">
                    x:{{ view.x.toFixed(0) }} y:{{ view.y.toFixed(0) }}
                </span>
                <span>
                  <v-icon size="small" title="Zoom Out (^ + -)" style="cursor: pointer;" @click="zoomOut">mdi-magnify-minus-outline</v-icon>
                  <span
                      help-topic="viewportZoom"
                      @click="resetZoom"
                      title="Zoom Level"
                      style="padding-right: 5px;cursor: crosshair;">
                      {{ (view.k * 100).toFixed(2) }}%
                  </span>
                  <v-icon
                      size="small"
                      @click="zoomIn"
                      title="Zoom In (^ + +)"
                      style="cursor: pointer;"
                      >mdi-magnify-plus-outline</v-icon>
                </span>
                <v-icon size="small" title="Close Map" class="float-right pa-2" @click="preferences.showMap = false">
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
            margin: 20,
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
        endTranslate() {
          const preferencesStore = usePreferencesStore();
          preferencesStore.$patch({
            ['mini-map-location']: this.pos,
          });
          document.body.style = "";
          window.removeEventListener('mousemove', this.translate);
          window.removeEventListener('mouseup', this.endTranslate);
        },
        translate(e) {
          this.pos.x = Math.min(this.translating.x - (e.clientX - this.translating.mx), window.innerWidth - this.margin);
          this.pos.y = Math.min(this.translating.y + (e.clientY - this.translating.my), window.innerHeight - this.margin);
        },
        startTranslate(e) {
          this.translating = {
            x: this.pos.x,
            y: this.pos.y,
            mx: e.clientX,
            my: e.clientY,
          };
          document.body.style = "cursor: grabbing";
          window.addEventListener('mousemove', this.translate);
          window.addEventListener('mouseup', this.endTranslate);
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
        window.addEventListener("resize", this.updateScale);
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
.viewport-location {
  display: inline-block;
  width: 110px;
  padding-right: 10px;
  cursor: crosshair;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.map-system-bar {
    cursor: grab;
    width: 280px;
    height: 22px;
    font-size: 12px;
    padding-left: 5px;
}
.graph-map {
    overflow: hidden;
    padding: 0;
    width: 280px;
    height: 120px;
}
</style>
