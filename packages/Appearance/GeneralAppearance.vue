<template>
  <v-card class="ma-0 pa-0" flat>
      <v-card-text class="ma-0 pa-0">
          <v-select label="Theme" :items="['dark', 'light']" v-model="modelValue.appearance.theme"></v-select>
          <v-select :items="colorBaseKeys" label="Help Dialog Background" v-model="modelValue.appearance.helpColor"/>
      </v-card-text>
  </v-card>
</template>
<script lang="typescript">
  import colors from "vuetify/lib/util/colors";
  import {mapActions} from "pinia";
  export default {
    name: 'general-appearance-settings-panel',
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
