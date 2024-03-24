<template>
    <div class="map-view no-select no-graph-target" :style="mapStyle" @wheel.passive.stop @click.stop v-if="graphSnapshot">
        <v-card elevation="7">
            <div class="map-system-bar no-graph-target" :style="{backgroundColor: $vuetify.theme.current.colors['on-surface-variant']}"  @mousedown.stop="startTranslate">
                <v-icon title="Reset Minimap Settings" size="small" @click="resetLocation">
                    mdi-map
                </v-icon>
                <span class="pa-2">
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
                <span help-topic="viewportLocation" title="Viewport localtion" class="viewport-location" @click="resetView">
                    x:{{ view.x.toFixed(0) }} y:{{ view.y.toFixed(0) }}
                </span>

                <v-icon size="small" title="Close Map" class="float-right ma-1" @click="preferences.showMap = false">
                    mdi-close
                </v-icon>
            </div>
            <v-card-text class="pa-0">
                <div class="graph-map" :style="{height: mapStyle.height}" ref="map">
                    <div style="position: relative;">
                        <div class="graph-map-view-port" :style="viewMapStyle"></div>
                        <div class="graph-map-node" :style="nodeMapStyle(node)" v-for="node in graphSnapshot.nodes" :key="node.id"></div>
                    </div>
                </div>
            </v-card-text>
            <v-icon title="Resize" color="secondary" size="small" class="mini-map-resize no-graph-target" @mousedown="startResize">
              mdi-resize-bottom-right
            </v-icon>
        </v-card>
    </div>
</template>
<script lang="ts">
import {mapState, mapWritableState, mapActions} from "pinia";
import {useStore as useInputStore} from "@plastic-io/graph-editor-vue3-input";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
export default {
    name: "mini-map-info",
    data() {
        return {
            stopScaleLooping: false,
            minHeight: 20,
            minWidth: 250,
            margin: 20,
            rect: {
              x: 10,
              y: 30,
              h: 150,
              w: 250,
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
        graph: {
            handler() {
                this.updateScale();
            },
            deep: true,
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
        resetLocation() {
          this.rect = {
              x: 10,
              y: 30,
              h: 150,
              w: 250,
          };
        },
        updatePrefStore() {
          const preferencesStore = usePreferencesStore();
          preferencesStore.$patch({
            preferences: {
              uiSize: {
                ['mini-map-location']: this.rect,
              },
            },
          });
        },
        endTranslate() {
          this.updatePrefStore();
          document.body.style = "";
          this.stopScaleLooping = true;
          window.removeEventListener('mousemove', this.translate);
          window.removeEventListener('mouseup', this.endTranslate);
          this.updateScale();
        },
        validateSize(size) {
          return {
            w: Math.max(this.minWidth, Math.min(size.w, window.innerWidth - this.margin)),
            h: Math.max(this.minHeight, Math.min(size.h, window.innerHeight - this.margin)),
          };
        },
        validatePos(pos) {
          return {
            x: Math.max(0, Math.min(pos.x, window.innerWidth - this.margin)),
            y: Math.max(0, Math.min(pos.y, window.innerHeight - this.margin)),
          };
        },
        translate(e) {
          const x = this.translating.x - (e.clientX - this.translating.mx);
          const y = this.translating.y + (e.clientY - this.translating.my);
          this.rect = {
            ...this.rect,
            ...this.validatePos({x, y}),
          };
        },
        endResize() {
          this.updatePrefStore();
          document.body.style = "";
          this.stopScaleLooping = true;
          window.removeEventListener('mousemove', this.resizing);
          window.removeEventListener('mouseup', this.endResize);
          this.updateScale();
        },
        resizing(e) {
          const w = this.translating.w - (e.clientX - this.translating.mx);
          const h = this.translating.h + (e.clientY - this.translating.my);
          this.rect = {
            ...this.rect,
            ...this.validateSize({h, w}),
          };
        },
        startResize(e) {
          this.translating = {
            w: this.rect.w,
            h: this.rect.h,
            mx: e.clientX,
            my: e.clientY,
          };
          this.updateScaleLoop();
          document.body.style = "cursor: nesw-resize";
          window.addEventListener('mousemove', this.resizing);
          window.addEventListener('mouseup', this.endResize);
        },
        startTranslate(e) {
          this.translating = {
            x: this.rect.x,
            y: this.rect.y,
            mx: e.clientX,
            my: e.clientY,
          };
          this.updateScaleLoop();
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
        updateScaleLoop() {
            if (this.stopScaleLooping) {
              this.stopScaleLooping = false;
              return;
            }
            this.updateScale();
            setTimeout(() => {
                this.updateScaleLoop();
            }, 50);
        },
        validate(){
          this.rect = {
            ...this.validatePos(this.rect),
            ...this.validateSize(this.rect),
          };
        }
    },
    mounted() {
        this.updateScaleLoop();
        setTimeout(() => {
            this.stopScaleLooping = true;
        }, 4000);
        const rect = JSON.parse(JSON.stringify(this.preferences.uiSize['mini-map-location'] || this.rect));
        this.rect = {
          ...this.validatePos(rect),
          ...this.validateSize(rect),
        };
        window.addEventListener("resize", () => {
          this.updateScale();
          this.validate();
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
            top: this.rect.y + 'px',
            right: this.rect.x + 'px',
            width: this.rect.w + 'px',
            height: this.rect.h + 'px',
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
    z-index: 1007;
}
.mini-map-resize {
  transform: scaleX(-1);
  margin-top: -18px;
  float: left;
  cursor: nesw-resize;
}
.viewport-location {
  display: inline-block;
  padding-right: 10px;
  cursor: crosshair;
  text-overflow: ellipsis;
}
.map-system-bar {
    cursor: grab;
    height: 22px;
    font-size: 12px;
    padding-left: 5px;
    white-space: nowrap;
}
.graph-map {
    overflow: hidden;
    padding: 0;
}
</style>
