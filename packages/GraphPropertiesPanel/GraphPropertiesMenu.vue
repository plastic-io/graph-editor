<template>
  <v-menu>
    <template v-slot:activator="{props}">
      <v-icon help-topic="graphProperties" icon="mdi-vector-polyline-edit" v-bind="props" class="ma-2"/>
    </template>
    <graph-properties @click.stop @mousemove.stop/>
  </v-menu>
</template>
<script lang="ts">
  export default {
    name: 'graph-properties-menu',
  }
</script>
