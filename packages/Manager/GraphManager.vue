<template>
  <v-app class="graph-editor">
    <v-app-bar>
      <v-toolbar-title>
        <router-link to="/">
          <v-avatar size="40px" color="primary" class="ma-5">
            <v-img src="https://avatars1.githubusercontent.com/u/60668496?s=200&v=4"/>
          </v-avatar>
        </router-link>
      </v-toolbar-title>
      <v-btn  variant="tonal" color="secondary" @click="showCreateDialog = true;">
        New Graph
        <v-icon right>
          mdi-plus-circle-outline
        </v-icon>
      </v-btn>
      <v-spacer/>
      <template v-for="(plugin, index) in getPluginsByType('manager-top-bar-bottom')" :value="plugin.name">
          <component :is="plugin.component" v-bind="plugin.props"/>
      </template>
    </v-app-bar>
    <v-container fluid class="graphs-container">
      <v-row align="center" justify="center">
        <v-col v-for="graph in filteredToc" :key="graph.id" cols="4">
          <v-card :color="deletingGraph.id === graph.id ? 'warning' : ''">
            <v-card-item>
              <v-card-title>
                <v-icon
                  height="20px"
                  width="20px"
                  class="float-left mr-3 mt-1"
                  :icon="graph.icon || 'mdi-robot-dead'"/>
                {{graph.name || graph.url}}
              </v-card-title>
              <v-card-text>
                {{graph.description || 'No Description'}}
              </v-card-text>
              <v-card-actions>
                  <v-btn @click="() => $router.push(graph.url)">Open</v-btn>
                  <v-btn @click="deletingGraph = graph; showDeleteDialog = true;">Delete</v-btn>
              </v-card-actions>
            </v-card-item>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <v-dialog max-width="500px" v-model="showCreateDialog">
      <v-card>
        <v-card-title>
          Create a New Graph
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newGraphUrl"
            :rules="newGraphRules"
            label="New Graph URL"
            hint="This is the URL to get to your graph">
            <template v-slot:append>
              <v-icon icon="mdi-dice-multiple" @click="getRandomUrl"/>
            </template>
          </v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-btn @click="showCreateDialog = false">Cancel</v-btn>
          <v-btn @click="create">Create</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog max-width="700px" v-model="showDeleteDialog">
      <v-card>
        <v-card-title>
          Are you sure you want to delete {{deletingGraph.name || deletingGraph.url}}?
        </v-card-title>
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
  import {useStore as useInputStore} from "@plastic-io/graph-editor-vue3-input";
  import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
  import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
  import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
  export default {
    async mounted() {
      this.setTheme(this.preferences.appearance.theme);
      await this.getToc();
      this.getRandomUrl();
    },
    data() {
      return {
        showDeleteDialog: false,
        showCreateDialog: false,
        newGraphUrl: '',
        deletingGraph: {},
        newGraphRules: [
          value => !!value || 'Field must not be empty',
          value => !!Object.keys(this.toc).indexOf(value) || 'This URL is already taken by another graph.'
        ],
      }
    },
    methods: {
      ...mapActions(useOrchestratorStore, [
          'init',
          'setTheme',
          'getToc',
          'getPluginsByType',
      ]),
      async deleteGraph() {
        this.showDeleteDialog = false;
        await this.dataProviders.graph.delete(this.deletingGraph.url);
        await this.dataProviders.toc.updateToc({[this.deletingGraph.url]: undefined});
        await this.getToc();
        this.deletingGraph = {};
      },
      create() {
        this.$router.push(`/${this.newGraphUrl}`);
        setTimeout(() => {
          // long after the component is hidden
          // make sure we don't use a different value
          this.getRandomUrl();
        }, 2000);
      },
      getRandomUrl() {
        this.newGraphUrl = getName().replace(' ', '');
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
          return Object.keys(this.toc).filter((t: any) => !!this.toc[t])
            .map((t: any) => {
              return {...this.toc[t], url: t}
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