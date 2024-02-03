<template>
    <v-overlay v-model="help">
      <div
          v-for="(topic, index) in topics"
          :key="index + '_canvas'"
          :style="topicStyle(topic)" @mouseover="setTopic(topic)">
          <v-icon size="x-small" color="white" style="transform: translate(-20px, -20px);">
              mdi-help-circle
          </v-icon>
      </div>
      <canvas ref="canvas" class="help-topic-canvas"></canvas>
      <v-alert
          :style="helpCardStyle"
          class="help-card"
          ref="card"
          icon="mdi-help-circle-outline"
          v-model="open"
          dismissible
          @wheel.stop>
          <h3 class="headline" v-html="topicTitle"></h3>
          <div v-html="topicText"></div>
      </v-alert>
      <v-card class="help-keyboard">
          <v-card-text>
              <v-expansion-panels>
                  <v-expansion-panel>
                      <v-expansion-panel-title style="white-space: nowrap;">
                        <v-icon icon="mdi-keyboard" class="mr-2"/> Keyboard Help
                      </v-expansion-panel-title>
                      <v-expansion-panel-text>
                          <table style="width: 380px;">
                              <tr>
                                  <th style="width: 150px;">Key</th>
                                  <th>Action</th>
                              </tr>
                          </table>
                          <div style="max-height: 65vh;overflow: auto;">
                              <table style="width: 380px;">
                                  <tr><td><v-icon x-small>mdi-apple-keyboard-control</v-icon> + =</td><td>Zoom in</td></tr>
                                  <tr><td><v-icon x-small>mdi-apple-keyboard-control</v-icon> + -</td><td>Zoom out</td></tr>
                                  <tr><td>Delete</td><td>Delete selection</td></tr>
                                  <tr><td>Arrow Keys</td><td>Nudge selected vectors</td></tr>
                                  <tr><td>\</td><td>Toggle presentation visibility</td></tr>
                                  <tr><td><v-icon x-small>mdi-apple-keyboard-control</v-icon> + ]</td><td>Bring forward</td></tr>
                                  <tr><td><v-icon x-small>mdi-apple-keyboard-control</v-icon> + <v-icon x-small>mdi-apple-keyboard-shift</v-icon> + ]</td><td>Bring to front</td></tr>
                                  <tr><td><v-icon x-small>mdi-apple-keyboard-control</v-icon> + [</td><td>Send back</td></tr>
                                  <tr><td><v-icon x-small>mdi-apple-keyboard-control</v-icon> + <v-icon x-small>mdi-apple-keyboard-shift</v-icon> + [</td><td>Send to back</td></tr>
                                  <tr><td><v-icon x-small>mdi-apple-keyboard-control</v-icon> + Z</td><td>Undo</td></tr>
                                  <tr><td><v-icon x-small>mdi-apple-keyboard-control</v-icon> + <v-icon x-small>mdi-apple-keyboard-shift</v-icon> + Z</td><td>Redo</td></tr>
                                  <tr><td><v-icon x-small>mdi-apple-keyboard-control</v-icon> + <v-icon x-small>mdi-apple-keyboard-shift</v-icon> + D</td><td>Duplicate selected</td></tr>
                                  <tr><td>ALT + `</td><td>Toggle presentation mode</td></tr>
                                  <tr><td>Space + Left Mouse Button</td><td>Hold to move graph view</td></tr>
                                  <tr><td>Middle Mouse Button</td><td>Hold to move graph view</td></tr>
                              </table>
                          </div>
                      </v-expansion-panel-text>
                  </v-expansion-panel>
              </v-expansion-panels>
          </v-card-text>
      </v-card>
    </v-overlay>
</template>
<script>
import {mapWritableState, mapActions, mapState} from "pinia";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
import colors from "vuetify/lib/util/colors";
import helpTopics from "./helpTopics";

export default {
    name: "help-overlay",
    props: {},
    mounted() {
        window.removeEventListener("resize", this.resize);
        this.drawHelp();
        window.addEventListener("resize", this.resize);
        const missing = [];
        this.topics.forEach((topic) => {
            if (!helpTopics[topic]) {
                missing.push(topic);
            }
        });
        if (missing.length > 0) {
            console.warn("missing topics", missing);
        }
    },
    data() {
        return {
            showHelp: true,
            localVersion: 1,
            ratio: 1,
            ctx: null,
            topic: null,
            open: true,
            lineRects: {},
        };
    },
    computed: {
        help: {
          get() {
            return useOrchestratorStore().showHelp;
          },
          set(val) {
            useOrchestratorStore().showHelp = val;
          }
        },
        helpCardStyle() {
          const source = this.topicEl(this.topic || 'openGraph').getBoundingClientRect();
          const coord = this.moveToCenter(source.x, source.y);
          return {
            position: 'absolute',
            left: coord.x + 'px',
            top: coord.y + 'px',
          };
        },
        preferences(){
            // return usePreferencesStore().preferences;
        },
        topicTitle() {
            if (!helpTopics[this.topic]) {
                return "Sorry!"; 
            }
            return helpTopics[this.topic].title || this.topic;
        },
        topicText() {
            if (!helpTopics[this.topic]) {
                return "No help topic currently exists for this item.";
            }
            return helpTopics[this.topic].html;
        },
        topics() {
            this.localVersion;
            return [...document.querySelectorAll("*[help-topic]")].map(e => e.getAttribute("help-topic"));
        },
        topicEl() {
            return (topic) => {
                this.localVersion;
                return document.querySelector(`*[help-topic='${topic}']`);
            };
        },
        topicRect() {
            return (topic) => {
                this.localVersion;
                return this.topicEl(topic).getBoundingClientRect();
            };
        },
        topicStyle() {
            return (topic) => {
                const rect = this.topicRect(topic);
                return {
                    cursor: "help",
                    padding: "10px",
                    position: "fixed",
                    top: rect.y + "px",
                    left: rect.x + "px",
                };
            };
        },
    },
    watch: {
        open() {
            this.$emit("close");
        },
        topic() {
            if (this.topic === "vueTemplate") {
                this.topic = "template";
            }
            if (this.topic === "setTemplate") {
                this.topic = "set";
            }
        },
        view: {
            handler() {
                this.localVersion += 1;
            },
            deep: true,
        },
    },
    methods: {
        moveToCenter(x, y) {
            const maxWidth = 700, maxHeight = window.innerHeight * 0.8;
            const [centerX, centerY] = [window.innerWidth / 2, window.innerHeight / 2];
            let newX = Math.max(0, Math.min(window.innerWidth - maxWidth, x
              < centerX ? x + (centerX - x) / 2 : x - (x - centerX) / 2));
            let newY = Math.max(0, Math.min(window.innerHeight - maxHeight, y
              < centerY ? y + (centerY - y) / 2 : y - (y - centerY) / 2));
            return { x: newX, y: newY };
        },
        resize() {
            this.drawHelp();
            this.localVersion += 1;
        },
        setTopic(e) {
            this.topic = e;
            this.drawHelp();
        },
        drawHelp() {
            setTimeout(() => {
                this.topics.forEach((topic) => {
                    if (topic === this.topic && this.$refs.canvas && this.$refs.card && this.topicEl(topic)) {
                        this.localGraph = this.graph;
                        this.ctx = this.$refs.canvas.getContext("2d");
                        this.$refs.canvas.height = window.innerHeight;
                        this.$refs.canvas.width = window.innerWidth;
                        this.ctx.scale(this.ratio, this.ratio);
                        const source = this.topicEl(topic).getBoundingClientRect();
                        const target = this.$refs.card.$el.getBoundingClientRect();
                        this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
                        this.ctx.strokeStyle = colors["pink"].base;
                        this.ctx.lineWidth = 3;
                        this.ctx.beginPath();
                        this.ctx.moveTo(source.x + 5, source.y + 5);
                        this.ctx.lineTo(target.x + (target.width / 2), target.y + 5);
                        this.ctx.stroke();
                        this.ctx.closePath();
                    }
                });
            }, 10);
        }
    },
};
</script>
<style>
.help-keyboard {
  position: absolute;
  top: 37px;
  left: 10px;
}
.help-card {
  min-width: 500px;
  max-width: 700px;
  max-height: 80vh;
  overflow: auto;
}
.help-overlay-table td {
    padding: 3px;
}
.help-overlay-table {
    border-collapse: collapse;
}
.help-overlay-table tr:nth-child(even) {
    background: rgba(255, 255, 255, 0.1);
}
.help-overlay-table tr:nth-child(odd) {
    background: rgba(255, 255, 255, 0.05);
}
.help-topic-canvas {
    pointer-events: none;
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    width: 100vw;
}
</style>