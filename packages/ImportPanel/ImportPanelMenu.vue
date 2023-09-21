<template>
  <v-menu>
    <template v-slot:activator="{props}">
      <v-icon icon="mdi-bookshelf" v-bind="props"/>
    </template>
    <import-panel @click.stop @mousemove.stop/>
  </v-menu>
</template>
<script lang="ts">
  export default {
    name: 'import-panel-menu',
  }
</script>
