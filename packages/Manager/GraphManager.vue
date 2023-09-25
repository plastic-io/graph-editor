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
        <v-spacer/>
        <v-btn color="info" @click="create">
          New Graph
          <v-icon right>
            mdi-plus-circle-outline
          </v-icon>
        </v-btn>
    </v-app-bar>
    <v-container fluid class="graphs-container">
      <v-row align="center" justify="center">
        <v-col v-for="graph in filteredToc" :key="graph.id" cols="4">
          <v-card>
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
                  <v-btn>Delete</v-btn>
              </v-card-actions>
            </v-card-item>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </v-app>
</template>
<script lang="ts">
  import {mapWritableState, mapActions, mapState} from "pinia";
  import {useStore as useInputStore} from "@plastic-io/graph-editor-vue3-input";
  import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
  import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
  import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
  export default {
    async mounted() {
      this.setTheme(this.preferences.appearance.theme);
      await this.getToc();
      console.log(this.toc);
    },
    methods: {
      ...mapActions(useOrchestratorStore, [
          'init',
          'setTheme',
          'getToc',
          'getPluginsByType',
      ]),
      openGraph(url) {
        window.open(`${this.pathPrefix}${url}`, url);
      },
      create() {

      }
    },
    computed: {
        ...mapWritableState(useOrchestratorStore, [
          'toc',
          'pathPrefix',
        ]),
        ...mapWritableState(usePreferencesStore, ['preferences']),
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
    margin-top: 55px;
    overflow-y: auto;
  }
</style>