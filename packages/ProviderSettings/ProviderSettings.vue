<template>
  <v-menu>
    <template v-slot:activator="{props}">
      <v-icon v-bind="props" icon="mdi-cog"/>
    </template>
    <div>
      <v-card class="provider-card" @click.stop>
        <v-card-text>
            <v-card-title>Storage and Execution</v-card-title>
            <v-switch
                help-topic="useLocalStorage"
                :label="preferences.useLocalStorage ? 'Local Storage' : 'Server Storage'"
                v-model="preferences.useLocalStorage"></v-switch>
            <v-text-field
                :disabled="preferences.useLocalStorage || deploymentConfigured"
                v-model="preferences.graphHTTPServer"
                help-topic="HTTPServer"
                label="HTTPS Server"
            />
            <v-text-field
                :disabled="preferences.useLocalStorage || deploymentConfigured"
                v-model="preferences.graphWSSServer"
                help-topic="WSSServer"
                label="WSS Server"
            />
        </v-card-text>
      </v-card>
    </div>
  </v-menu>
</template>
<script>
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
import {mapWritableState, mapActions, mapState} from "pinia";
export default {
  computed: {
    deploymentConfigured() { return Boolean(__DEPLOYMENT_CONFIG__.graphHTTPServer); },
    ...mapWritableState(usePreferencesStore, [
        "preferences",
    ]),
  }
}
</script>
<style scoped>
  .provider-card {
    width: 500px;
  }
</style>
