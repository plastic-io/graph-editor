<template>
  <v-menu>
    <template v-slot:activator="{props}">
      <v-icon icon="mdi-cog" v-bind="props"/>
    </template>
    <settings-panel @click.stop @mousemove.stop/>
  </v-menu>
</template>
<script lang="ts">
  export default {
    name: 'settings-panel-menu',
  }
</script>
