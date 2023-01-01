<template>
  <v-expansion-panels class="ma-0 pa-0" flat v-model="panel">
      <v-expansion-panel>
          <v-expansion-panel-title>User</v-expansion-panel-title>
          <v-expansion-panel-text>
              <v-card class="ma-0 pa-0" flat v-if="identity">
                  <v-card-text class="ma-0 pa-0" v-if="identity.provider !== 'local'">
                      <v-text-field
                          :model-value="identity.provider"
                          disabled
                          help-topic="identityProvider"
                          label="Identity Provider"
                      />
                      <v-text-field
                          :model-value="identity.user.email"
                          disabled
                          help-topic="userName"
                          label="User Name"
                      >
                      <template v-slot:prepend>
                        <v-img
                            v-if="identity.user.picture"
                            class="mb-3"
                            :title="identity.user.email"
                            :src="identity.user.picture"
                            style="width: 50px; border-radius: 25px;border: solid 2px rgba(255, 255, 255, 0.5);"/>
                      </template>
                      </v-text-field>
                      <v-btn class="ma-3" @click="logoff">
                          <v-icon>
                              mdi-logout
                          </v-icon>
                          Logoff
                      </v-btn>
                  </v-card-text>
                  <v-card-text class="ma-0 pa-0" v-if="identity.provider === 'local'">
                      <v-img
                          :title="preferences.userName"
                          :src="preferences.avatar"
                          style="width: 50px; border-radius: 25px;border: solid 2px rgba(255, 255, 255, 0.5);"/>
                      <v-text-field
                          v-model="preferences.userName"
                          help-topic="userName"
                          label="User Name"
                      />
                      <v-text-field
                          v-model="preferences.avatar"
                          help-topic="avatar"
                          label="Avatar"
                      />
                  </v-card-text>
              </v-card>
          </v-expansion-panel-text>
      </v-expansion-panel>
      <v-expansion-panel>
          <v-expansion-panel-title>Graph</v-expansion-panel-title>
          <v-expansion-panel-text>
              <v-card class="ma-0 pa-0" flat>
                  <v-card-text class="ma-0 pa-0">
                      <v-text-field
                          help-topic="settingsGridSize"
                          label="Grid Size"
                          persistent-hint
                          type="number"
                          :disabled="!preferences.snapToGrid"
                          v-model.number="preferences.gridSize"/>
                      <v-switch
                          help-topic="settingsSnapToGrid"
                          label="Snap To Grid"
                          v-model="preferences.snapToGrid"></v-switch>
                      <v-switch help-topic="settingsShowGrid" label="Show Grid" v-model="preferences.showGrid"></v-switch>
                      <v-switch help-topic="settingsShowLabels" label="Input/Output Labels" v-model="preferences.showLabels"/>
                      <v-switch help-topic="settingsDebug" persistent-hint hint="Captures debug logs and show edge values.  Performance penalty." label="Debug" v-model="preferences.debug"/>
                      <v-switch help-topic="settingsNewNodeHelp" label="Show Help Messages" persistent-hint hint="When on, help messages will appear from time to time." v-model="preferences.newNodeHelp"></v-switch>
                  </v-card-text>
              </v-card>
          </v-expansion-panel-text>
      </v-expansion-panel>
      <v-expansion-panel>
          <v-expansion-panel-title>General Appearance</v-expansion-panel-title>
          <v-expansion-panel-text>
              <v-card class="ma-0 pa-0" flat>
                  <v-card-text class="ma-0 pa-0">
                      <v-select label="Theme" :items="['dark', 'light']" v-model="preferences.appearance.theme"></v-select>
                      <v-select :items="colorBaseKeys" label="Help Dialog Background" v-model="preferences.appearance.helpColor"/>
                  </v-card-text>
              </v-card>
          </v-expansion-panel-text>
      </v-expansion-panel>
      <v-expansion-panel>
          <v-expansion-panel-title>Canvas Appearance</v-expansion-panel-title>
          <v-expansion-panel-text>
              <v-card class="ma-0 pa-0" flat>
                  <v-card-text class="ma-0 pa-0">
                      <v-select :items="colorBaseKeys" label="Selection Rectange Color" v-model="preferences.appearance.selectionRectColor"/>
                      <v-select :items="colorBaseKeys" label="Bounding Rectangle Color" v-model="preferences.appearance.boundingRectColor"/>
                  </v-card-text>
              </v-card>
          </v-expansion-panel-text>
      </v-expansion-panel>
      <v-expansion-panel>
          <v-expansion-panel-title>Connector Appearance</v-expansion-panel-title>
          <v-expansion-panel-text>
              <v-card class="ma-0 pa-0" flat>
                  <v-card-text class="ma-0 pa-0">
                      <v-text-field label="Connector Drag Dead Zone" v-model.number="preferences.appearance.connectors.dragDeadZone" type="number"/>
                      <v-select :items="colorBaseKeys" label="Control Fill Style" v-model="preferences.appearance.connectors.controlFillStyle"/>
                      <v-select :items="colorBaseKeys" label="Stroke Style" v-model="preferences.appearance.connectors.strokeStyle"/>
                      <v-select :items="colorBaseKeys" label="Selected Stroke Style" v-model="preferences.appearance.connectors.selectedStrokeStyle"/>
                      <v-select :items="colorBaseKeys" label="Hover Stroke Style" v-model="preferences.appearance.connectors.hoverStrokeStyle"/>
                      <v-select :items="colorBaseKeys" label="Watch Stroke Style" v-model="preferences.appearance.connectors.watchStrokeStyle"/>
                      <v-select :items="colorBaseKeys" label="Activity Stroke Style" v-model="preferences.appearance.connectors.activityStrokeStyle"/>
                      <v-select :items="colorBaseKeys" label="Error Stroke Style" v-model="preferences.appearance.connectors.errorStrokeStyle"/>
                      <v-text-field label="Line Width" v-model.number="preferences.appearance.connectors.lineWidth" type="number"/>
                  </v-card-text>
              </v-card>
          </v-expansion-panel-text>
      </v-expansion-panel>
      <v-expansion-panel v-for="(plugin, index) in settingsPanels">
          <v-expansion-panel-title>{{plugin.title}}</v-expansion-panel-title>
          <v-expansion-panel-text>
            <component :is="plugin.component" v-bind="plugin.props" v-model="preferences"/>
          </v-expansion-panel-text>
      </v-expansion-panel>
      <v-expansion-panel>
          <v-expansion-panel-title>Danger Zone</v-expansion-panel-title>
          <v-expansion-panel-text>
              <v-card class="ma-0 pa-0" flat>
                  <v-card-text class="ma-0 pa-0">
                      <v-btn @click="clearEditorSettings">
                          Clear editor settings
                      </v-btn>
                  </v-card-text>
              </v-card>
          </v-expansion-panel-text>
      </v-expansion-panel>
  </v-expansion-panels>
</template>
<script>
import colors from "vuetify/lib/util/colors";

import {useStore as useInputStore} from "@plastic-io/graph-editor-vue3-input";
import {useStore as useGraphStore} from "@plastic-io/graph-editor-vue3-graph";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
import {useStore as authenticationProviderStore} from "@plastic-io/graph-editor-vue3-authentication-provider";
import {mapWritableState, mapActions, mapState} from "pinia";

export default {
    name: "settings-panel",
    watch: {
        "theme"(){
            const isDark = this.theme === "dark";
            const theme = useTheme();
            theme.global.name.value = isDark ? 'dark' : 'light';
        },
    },
    methods: {
        clearEditorSettings() {

        },
        ...mapActions(authenticationProviderStore, [
            "logoff",
        ]),
        ...mapActions(useOrchestratorStore, [
          'getPluginsByType',
        ]),
    },
    data() {
        return {
            panel: 0,
        };
    },
    computed: {
        ...mapState(authenticationProviderStore, [
            'identity',
            'workstationId',
        ]),
        ...mapWritableState(usePreferencesStore, [
            "preferences",
        ]),
        colorBaseKeys() {
            return Object.keys(colors);
        },
        settingsPanels() {
          const panels = this.getPluginsByType('settings-panel');
          console.log(panels);
          return panels;
        }
    },
};
</script>
<style></style>
