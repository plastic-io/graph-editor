<template>
  <v-menu>
    <template v-slot:activator="{props}">
      <v-icon icon="mdi-history" v-bind="props"/>
    </template>
    <history-panel @click.stop @mousemove.stop/>
  </v-menu>
</template>
<script>
  export default {
    name: 'history-panel-menu',
  }
</script>
