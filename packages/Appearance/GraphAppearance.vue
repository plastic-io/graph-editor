<template>
  <v-card class="ma-0 pa-0" flat>
      <v-card-text class="ma-0 pa-0">
          <v-text-field
              help-topic="settingsGridSize"
              label="Grid Size"
              persistent-hint
              type="number"
              :disabled="!modelValue.snapToGrid"
              v-model.number="modelValue.gridSize"/>
          <v-switch
              help-topic="settingsSnapToGrid"
              label="Snap To Grid"
              v-model="modelValue.snapToGrid"></v-switch>
          <v-switch help-topic="settingsShowGrid" label="Show Grid" v-model="modelValue.showGrid"></v-switch>
          <v-switch help-topic="settingsShowLabels" label="Input/Output Labels" v-model="modelValue.showLabels"/>
          <v-switch help-topic="settingsDebug" persistent-hint hint="Captures debug logs and show edge values.  Performance penalty." label="Debug" v-model="modelValue.debug"/>
          <v-switch help-topic="settingsNewNodeHelp" label="Show Help Messages" persistent-hint hint="When on, help messages will appear from time to time." v-model="modelValue.newNodeHelp"></v-switch>
      </v-card-text>
  </v-card>
</template>
<script lang="typescript">
  import colors from "vuetify/lib/util/colors";
  export default {
    name: 'graph-appearance-settings-panel',
    props: {
      modelValue: Object,
    },
    computed: {
        colorBaseKeys() {
            return Object.keys(colors);
        },
    },
  }
</script>
