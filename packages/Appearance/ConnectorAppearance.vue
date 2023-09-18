<template>
  <v-card class="ma-0 pa-0" flat>
      <v-card-text class="ma-0 pa-0">
          <v-switch help-topic="showConnectorActivity" label="Show Connector Activity" v-model="modelValue.showConnectorActivity"></v-switch>
          <v-text-field label="Connector Drag Dead Zone" v-model.number="modelValue.appearance.connectors.dragDeadZone" type="number"/>
          <v-select :items="colorBaseKeys" label="Control Fill Style" v-model="modelValue.appearance.connectors.controlFillStyle"/>
          <v-select :items="colorBaseKeys" label="Stroke Style" v-model="modelValue.appearance.connectors.strokeStyle"/>
          <v-select :items="colorBaseKeys" label="Selected Stroke Style" v-model="modelValue.appearance.connectors.selectedStrokeStyle"/>
          <v-select :items="colorBaseKeys" label="Hover Stroke Style" v-model="modelValue.appearance.connectors.hoverStrokeStyle"/>
          <v-select :items="colorBaseKeys" label="Watch Stroke Style" v-model="modelValue.appearance.connectors.watchStrokeStyle"/>
          <v-select :items="colorBaseKeys" label="Activity Stroke Style" v-model="modelValue.appearance.connectors.activityStrokeStyle"/>
          <v-select :items="colorBaseKeys" label="Error Stroke Style" v-model="modelValue.appearance.connectors.errorStrokeStyle"/>
          <v-text-field label="Line Width" v-model.number="modelValue.appearance.connectors.lineWidth" type="number"/>
      </v-card-text>
  </v-card>
</template>
<script lang="typescript">
  import colors from "vuetify/lib/util/colors";
  export default {
    name: 'connector-appearance-settings-panel',
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