<template>
  <v-menu>
    <template v-slot:activator="{props}">
      <v-icon help-topic="settings" icon="mdi-cog" v-bind="props" class="ma-2"/>
    </template>
    <settings-panel @click.stop @mousemove.stop/>
  </v-menu>
</template>
<script lang="ts">
  export default {
    name: 'settings-panel-menu',
  }
</script>
