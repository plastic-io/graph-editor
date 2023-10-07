<template>
  <v-menu v-if="identity">
    <template v-slot:activator="{props}">
      <div style="height: 40px; width: 40px; border-radius: 40px; overflow: hidden;" class="mr-5">
      <v-img
        v-bind="props"
        :title="identity.user.email"
        :src="identity.user.picture"/>
      </div>
    </template>
    <v-list>
      <v-list-item @click="logoff">
        Logoff
      </v-list-item>
    </v-list>
  </v-menu>
</template>
<script>
  import {useStore as useAuthenticationStore} from "@plastic-io/graph-editor-vue3-authentication-provider";
  import {mapState, mapActions} from "pinia";
  export default {
    methods: {
      ...mapActions(useAuthenticationStore, ['logoff']),
    },
    computed: {
      ...mapState(useAuthenticationStore, ['identity']),
    }
  }
</script>
