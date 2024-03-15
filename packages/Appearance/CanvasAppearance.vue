<template>
  <v-card class="ma-0 pa-0" flat>
      <v-card-text class="ma-0 pa-0">
          <v-select :items="colorBaseKeys" label="Selection Rectange Color" v-model="modelValue.appearance.selectionRectColor"/>
          <v-select :items="colorBaseKeys" label="Bounding Rectangle Color" v-model="modelValue.appearance.boundingRectColor"/>
          <v-select :items="colorBaseKeys" label="Grid minor lines" v-model="modelValue.appearance.gridMinor"/>
          <v-select :items="colorBaseKeys" label="Grid major lines" v-model="modelValue.appearance.gridMajor"/>
          <v-select :items="colorBaseKeys" label="Background Color" v-model="modelValue.appearance.backgroundColor"/>
      </v-card-text>
  </v-card>
</template>
<script lang="typescript">
  import colors from "vuetify/lib/util/colors";
  export default {
    name: 'canvas-appearance-settings-panel',
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
