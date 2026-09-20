<template>
  <v-app class="graph-editor">
    <v-app-bar>
      <v-toolbar-title>
        <router-link to="/">
          <v-avatar size="40px" color="primary" class="ma-5">
            <v-img src="https://avatars1.githubusercontent.com/u/60668496?s=200&v=4"/>
          </v-avatar>
        </router-link>
        <template v-for="(plugin, index) in getPluginsByType('manager-top-bar-title')" :value="plugin.name">
            <component :is="plugin.component" v-bind="plugin.props"/>
        </template>
      </v-toolbar-title>
      <v-spacer/>
      <template v-for="(plugin, index) in getPluginsByType('manager-top-bar-right')" :value="plugin.name">
          <component :is="plugin.component" v-bind="plugin.props"/>
      </template>
    </v-app-bar>
    <v-container fluid class="graphs-container">
      <v-btn  variant="tonal" color="secondary" @click="create" class="mb-5">
        New Graph
        <v-icon right class="ml-2">
          mdi-plus-circle-outline
        </v-icon>
      </v-btn>
      <v-row align="center" justify="center">
        <v-col v-for="graph in filteredToc" :key="graph.id" cols="4">
          <v-card :color="deletingGraph.id === graph.id ? 'warning' : ''">
            <v-card-item>
              <v-card-title>
                <v-icon
                  height="20px"
                  width="20px"
                  class="float-left mr-3 mt-1"
                  :title="graph.id"
                  :icon="graph.icon || 'mdi-robot-dead'"/>
                {{graph.name || graph.url}}
              </v-card-title>
              <v-card-text>
                {{graph.description || 'No Description'}}
                <v-spacer/>
              </v-card-text>
              <v-card-actions>
                  <v-btn @click="openGraph(graph.id)">Open</v-btn>
                  <v-btn @click="deletingGraph = graph; showDeleteDialog = true;">Delete</v-btn>
              </v-card-actions>
            </v-card-item>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <v-snackbar v-model="showSettingsChangedDialog">
      <v-card>
        <v-card-text>
          Refresh the page for settings changes to take effect.
        </v-card-text>
      </v-card>
    </v-snackbar>
    <v-snackbar :timeout="8000" v-model="showUndoDelete">
      {{(lastDeleted && (lastDeleted.name || lastDeleted.url)) || 'Graph'}} was deleted.
      <template v-slot:actions>
        <v-btn variant="text" @click="undoDelete">Undo</v-btn>
      </template>
    </v-snackbar>
    <v-dialog max-width="700px" v-model="showDeleteDialog">
      <v-card>
        <v-card-title>
          Delete {{deletingGraph.name || deletingGraph.url}}?
        </v-card-title>
        <v-card-text>
          It will be taken off this list. Nothing is thrown away, so it can be
          put back.
        </v-card-text>
        <v-card-actions>
          <v-btn @click="showDeleteDialog = false; deletingGraph = {}">Cancel</v-btn>
          <v-btn @click="deleteGraph" color="warning">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-app>
</template>
<script lang="ts">
  import getName from "@plastic-io/graph-editor-names";
  import {mapWritableState, mapActions, mapState} from "pinia";
  import {newId} from "@plastic-io/graph-editor-vue3-utils";
  import {useStore as useInputStore} from "@plastic-io/graph-editor-vue3-input";
  import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
  import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
  import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
  const CHANNEL_NAME = "plastic-io-document-provider"
  export default {
    async mounted() {
      this.setTheme(this.preferences.appearance.theme);
      await this.getToc();
      const broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
      broadcastChannel.onmessage = () => {
        this.getToc();
      };
    },
    data() {
      return {
        showSettingsChangedDialog: false,
        showDeleteDialog: false,
        newGraphUrl: '',
        deletingGraph: {},
        lastDeleted: null,
        showUndoDelete: false,
        newGraphRules: [
          value => !!value || 'Field must not be empty',
          value => !!Object.keys(this.toc).indexOf(value) || 'This URL is already taken by another graph.'
        ],
      }
    },
    watch: {
      preferences: {
        async handler() {
          this.showSettingsChangedDialog = true;
        },
        deep: true,
      },
    },
    methods: {
      ...mapActions(useOrchestratorStore, [
          'init',
          'setTheme',
          'getToc',
          'getPluginsByType',
      ]),
      openGraph(id) {
        window.location = `/graph-editor/${id}`;
      },
      /**
       * Take a graph off the list.
       *
       * This hides it and keeps everything it is made of, including its
       * collaborative document, so it can be put back.  Destroying a graph is
       * a separate thing that nothing here asks for.
       */
      async deleteGraph() {
        this.showDeleteDialog = false;
        const graph = this.deletingGraph;
        this.deletingGraph = {};
        try {
          await this.dataProviders.graph.delete(graph.id);
        } catch (err) {
          console.error('Cannot delete the graph.', err);
        }
        this.lastDeleted = graph;
        this.showUndoDelete = true;
        await this.getToc();
      },
      /** Put the graph that was just taken off the list back. */
      async undoDelete() {
        const graph = this.lastDeleted;
        this.showUndoDelete = false;
        this.lastDeleted = null;
        if (!graph) {
          return;
        }
        const provider: any = this.dataProviders.graph;
        if (typeof provider.restore !== 'function') {
          console.warn('This data provider cannot put a graph back.');
          return;
        }
        try {
          await provider.restore(graph.id);
        } catch (err) {
          console.error('Cannot restore the graph.', err);
        }
        await this.getToc();
      },
      create() {
        this.openGraph(newId());
      },
    },
    computed: {
        ...mapWritableState(useOrchestratorStore, [
          'toc',
          'dataProviders',
          'pathPrefix',
        ]),
        ...mapWritableState(usePreferencesStore, ['preferences']),
        isCreateButtonDisabled() {
          return this.newGraphUrl === '' || !this.newGraphRules.every(rule => typeof rule(this.newGraphUrl) === 'boolean');
        },
        filteredToc() {
          if (!this.toc) {
            return [];
          }
          return Object.keys(this.toc)
            .filter((t: any) => !!this.toc[t])
            .filter((t: any) => this.toc[t].type === 'graph')
            .filter((t: any) => !this.toc[t].deleted)
            .filter((t: any) => t !== 'id')
            .filter((t: any) => !/^endpoint\//.test(t))
            .sort((a: any, b: any) => a.localeCompare(b))
            .map((t: any) => {
              return {...this.toc[t], url: this.toc[t].url || t}
            });
        }
    }
  }
</script>
<style scoped>
  .graphs-container {
    margin-top: 65px;
    min-width: 100vw;
    overflow-y: auto;
  }
</style>