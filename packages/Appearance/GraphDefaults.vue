<template>
  <v-card class="ma-0 pa-0" flat>
      <v-card-text>
          <v-textarea  persistent-hint hint="Default graph presentation template." v-model="modelValue.defaultNewGraphTemplate"/>
          <v-textarea  persistent-hint hint="Default graph edge template." v-model="modelValue.defaultNewSetTemplate"/>
          <v-textarea  persistent-hint hint="Default graph presentation template." v-model="modelValue.defaultNewVueTemplate"/>
      </v-card-text>
  </v-card>
</template>
<script lang="typescript">
  export default {
    props: {
      modelValue: Object,
    },
  }
</script>
