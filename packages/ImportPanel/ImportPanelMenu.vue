<template>
  <v-menu>
    <template v-slot:activator="{props}">
      <v-icon help-topic="importPanel" icon="mdi-bookshelf" v-bind="props" class="ma-2"/>
    </template>
    <import-panel @mousedown.stop @click.stop @mousemove.stop/>
  </v-menu>
</template>
<script lang="ts">
  export default {
    name: 'import-panel-menu',
  }
</script>
