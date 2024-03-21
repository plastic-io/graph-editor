<template>
  <div :class="className">
    <v-icon v-if="identity && identity.isAuthenticated" :size="size || 'x-large'" icon="mdi-logout" @click="logoff"/>
    <v-icon v-else :size="size || 'x-large'" icon="mdi-login" @click="login"/>
  </div>
</template>
<script>
  import {useStore as useAuthenticationStore} from "@plastic-io/graph-editor-vue3-authentication-provider";
  import {mapState, mapActions} from "pinia";
  export default {
    props: {
      size: String,
      className: String,
    },
    methods: {
      ...mapActions(useAuthenticationStore, ['logoff', 'login']),
    },
    computed: {
      ...mapState(useAuthenticationStore, ['identity']),
    }
  }
</script>
