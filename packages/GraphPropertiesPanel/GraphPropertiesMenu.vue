<template>
  <v-menu>
    <template v-slot:activator="{props}">
      <v-icon icon="mdi-graph" v-bind="props"/>
    </template>
    <graph-properties @click.stop @mousemove.stop/>
  </v-menu>
</template>
<script>
  export default {
    name: 'graph-properties-menu',
  }
</script>
