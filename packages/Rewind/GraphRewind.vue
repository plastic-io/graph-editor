<template>
  <teleport to=".v-application__wrap">
    <div class="rewind" @click.stop>
        <div class="rewind-input">
          Version <input v-model="displayVersion"/>
        </div>
        <i class="rewind-title">Rewind</i>
        <p class="t-120">T-120</p>
        <v-btn-toggle mandatory v-model="transportSelection" class="rewind-buttons">
            <v-btn @click="restart">
              <v-icon>mdi-step-backward-2</v-icon>
            </v-btn>
            <v-btn @click="stepBack">
              <v-icon>mdi-step-backward</v-icon>
            </v-btn>
            <v-btn :color="rewinding ? '' : 'accent'" @click="rewind">
              <v-icon>mdi-rewind</v-icon>
            </v-btn>
            <v-btn :color="!playing ? 'accent' : ''" @click="stop">
              <v-icon>mdi-stop</v-icon>
            </v-btn>
            <v-btn :color="playing ? 'accent' : ''" @click="play">
              <v-icon>mdi-play</v-icon>
            </v-btn>
            <v-btn @click="commitRewind">
              <v-icon color="red">mdi-record</v-icon>
            </v-btn>
            <v-btn
              :color="fastForwarding ? 'accent' : ''"
              @click="fastForward">
              <v-icon>mdi-fast-forward</v-icon>
            </v-btn>
            <v-btn  @click="stepForward">
              <v-icon>mdi-step-forward</v-icon>
            </v-btn>
            <v-btn @click="reset">
              <v-icon>
                mdi-step-forward-2
              </v-icon>
            </v-btn>
            <v-btn @click="discardRewind">
              <v-icon>mdi-eject</v-icon>
            </v-btn>
        </v-btn-toggle>
        <v-slider
          class="rewind-slider"
          v-model="sliderVersion"
          step="1"
          :min="1"
          :max="maxVersion"
        >
        </v-slider>
    </div>
  </teleport>
</template>
<script>
import {mapWritableState, mapActions} from "pinia";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {deref} from "@plastic-io/graph-editor-vue3-utils";
import {applyChange, diff} from "deep-diff";

export default {
  data() {
    return {
      maxVersion: 0,
      transportSelection: 3,
      currentSelectedVersion: 0,
      playbackTimeout: 0,
      transport: true,
      minPlaybackRate: 250,
      playbackRate: 250,
      playing: false,
      playForward: true,
      rewinding: true,
      fastForwarding: true,
      graphStore: useGraphStore(),
    }
  },
  async mounted() {
    this.localGraph = deref(this.graphSnapshot);
    this.currentSelectedVersion = this.localGraph.version;
    this.maxVersion = this.localGraph.version;
    this.events = await this.getEvents(this.graphSnapshot.id);
  },
  computed: {
    ...mapWritableState(useGraphStore, ['graphSnapshot', 'rewindVersion', 'inRewindMode']),
    sliderVersion: {
      get() {
        return this.currentSelectedVersion;
      },
      set(val) {
        this.setVersion(val);
      }
    },
    displayVersion() {
      // Convert the version number to a string
      let versionString = this.currentSelectedVersion.toString();
      // Ensure the string is at least 6 characters long, padding with zeros if necessary
      versionString = versionString.padStart(6, '0');
      // Insert colons to resemble an LCD clock display, e.g., "00:00:01"
      return versionString.slice(0, 2) + ":" + versionString.slice(2, 4) + ":" + versionString.slice(4, 6);
    }
  },
  methods: {
    ...mapActions(useOrchestratorStore, ['getEvents']),
    ...mapActions(useGraphStore, ['transact']),
    async stepForward() {
      this.setVersion(this.currentSelectedVersion + 1);
      this.stop();
    },
    async stepBack() {
      this.setVersion(this.currentSelectedVersion - 1);
      this.stop();
    },
    async restart() {
      await this.setVersion(1);
      this.stop();
    },
    async reset() {
      console.log('reset');
      await this.setVersion(this.maxVersion);
      this.stop();
    },
    play() {
      this.playbackRate = 1000;
      this.playing = true;
      this.playForward = true;
      this.transportSelection = 4;
      this.startPlayback();
    },
    rewind() {
      this.playing = true;
      this.playbackRate = 250;
      this.playForward = false;
      this.transportSelection = 2;
      this.startPlayback();
    },
    fastForward() {
      this.playbackRate = 250;
      this.playForward = true;
      this.transportSelection = 6;
      this.startPlayback();
    },
    stop() {
      this.playing = false;
      this.rewinding = false;
      this.fastForwarding = false;
      this.transportSelection = 3;
      clearTimeout(this.playbackTimeout);
    },
    async discardRewind() {
      await this.setVersion(this.maxVersion);
      this.inRewindMode = false;
    },
    async setVersion(version) {
      if (!(version <= this.maxVersion && version > 0)) {
        return;
      }
      this.currentSelectedVersion = version;
      const graph = await this.projectGraphEvents(this.currentSelectedVersion);
      const changes = diff(deref(graph), deref(this.graphSnapshot));
      if (changes) {
        this.graphStore.$patch((state) => {
          state.graphSnapshot = graph;
        });
        this.localGraph = deref(this.graphSnapshot);
      }
    },
    async projectGraphEvents(version) {
        const start = performance.now();
        const state = {};
        this.events.sort((a, b) => {
          return a.version - b.version;
        }).forEach((event) => {
          if (event.version > version) {
            return;
          }
          event.changes.forEach((change) => {
            applyChange(state, true, change);
          });
        });
        return state;
    },
    async commitRewind() {
      this.inRewindMode = false;
      this.$nextTick(async () => {
        const revertedGraph = await this.projectGraphEvents(this.currentSelectedVersion);
        this.graphStore.$patch((state) => {
          state.graphSnapshot = revertedGraph;
        });
        this.graphStore.updateGraphFromSnapshot("Revert");
      });
    },
    startPlayback() {
      clearTimeout(this.playbackTimeout);
      const nextFrame = () => {
          if (this.playForward) {
              if (this.currentSelectedVersion < this.maxVersion) {
                  this.currentSelectedVersion += 1;
                  this.setVersion(this.currentSelectedVersion);
                  this.startPlayback();
                  return;
              }
          } else {
              if (this.currentSelectedVersion > 1) {
                  this.currentSelectedVersion -= 1;
                  this.setVersion(this.currentSelectedVersion);
                  this.startPlayback();
                  return;
              }
          }
          this.stop();
      };
      this.playbackTimeout = setTimeout(nextFrame, this.playbackRate);
    },
  }
}
</script>
<style scoped>
  .rewind-buttons {
    opacity: 0.812351;
  }
  .rewind-input {
    display: block;
    clear: both;
    float: right;
    color: #777;
    text-shadow: inset0px 2px 3px;
  }
  .rewind-input input {
    border-radius: 5px;
    box-shadow: inset 2.125px 2.125px 2.5px #000;
    width: 100.1px;
    font-size: 14.01px;
    margin-top: 10.2px;
    background: #333;
    text-align: center;
    color: #CAFEBABE;
    font-family: monospace;
    padding-top: 1.5px;
  }
  .rewind-slider {
    margin-top: 5px;
  }
  .rewind-title {
    font-weight: bold;
  }
  .t-120 {
    font-size: 18.1px;
    font-weight: bold;
    margin-top: -10.01px;
    margin-bottom: 30.17px;
  }
  .rewind {
    border-radius: 10.666666666666px;
    color: #222;
    position: fixed;
    left: 50%;
    transform: translate(-50%);
    bottom: 25px;
    height: 200.01px;
    width: 680.55px;
    padding: 0 20px 0 20px;
    z-index: 1;
    border: solid 1.25px #555;
    box-shadow: 1.175px 1.175px 3px #00000055;
    background: linear-gradient(to top,
      #d7cdb1 0%,
      #d7cdb1 15%,
      #321432 15%,
      #321432 27.5%,
      #702424 27.5%,
      #702424 40%,
      #a03821 40%,
      #a03821 52.5%,
      #ae4e27 52.5%,
      #ae4e27 65%,
      #c5973d 65%,
      #c5973d 77.5%,
      #d7cdb1 77.5%,
      #d7cdb1 100%);
  }
</style>