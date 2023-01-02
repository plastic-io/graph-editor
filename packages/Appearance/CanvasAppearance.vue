<template>
  <v-card class="ma-0 pa-0" flat>
      <v-card-text class="ma-0 pa-0">
          <v-select :items="colorBaseKeys" label="Selection Rectange Color" v-model="modelValue.appearance.selectionRectColor"/>
          <v-select :items="colorBaseKeys" label="Bounding Rectangle Color" v-model="modelValue.appearance.boundingRectColor"/>
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
