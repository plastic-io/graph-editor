<template>
  <v-menu>
    <template v-slot:activator="{props}">
      <v-icon icon="mdi-history" v-bind="props" class="ma-2"/>
    </template>
    <v-card>
        <v-card-title>
            History
        </v-card-title>
    </v-card>
    <history-panel @click.stop @mousemove.stop/>
  </v-menu>
</template>
<script lang="ts">
  export default {
    name: 'history-panel-menu',
  }
</script>
