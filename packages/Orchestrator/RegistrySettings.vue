<template>
  <v-card class="ma-0 pa-0" flat>
      <v-card-text class="ma-0 pa-0">
          <v-text-field label="Remote Configuration URL" v-model="modelValue.remoteConfiguration"/>
          <v-textarea label="CSV List of Registries" v-model="modelValue.registries"/>
          <v-textarea label="CSV List of Component Script SRCs" v-model="modelValue.componentScripts"/>
      </v-card-text>
  </v-card>
</template>
<script lang="typescript">
  export default {
    name: 'registry-settings-panel',
    props: {
      modelValue: Object,
    },
  }
</script>
