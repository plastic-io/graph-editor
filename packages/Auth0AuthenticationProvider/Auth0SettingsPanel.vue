<template>
  <div>
    <v-text-field label="domain" v-model="modelValue.auth0.domain"/>
    <v-text-field label="client_id" v-model="modelValue.auth0.clientId"/>
  </div>
</template>
<script lang="typescript">
  export default {
    name: 'auth0-settings-panel',
    props: {
      modelValue: Object,
    },
    beforeMount() {
      this.modelValue.auth0 = this.modelValue.auth0 || {
        domain: '',
        client_id: '',
      }
    }
  }
</script>
