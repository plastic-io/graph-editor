<template>
  <div>
    <v-text-field label="domain" v-model="modelValue.auth0.domain"/>
    <v-text-field label="client_id" v-model="modelValue.auth0.clientId"/>
    <template v-if="identity">
      <v-text-field
          :model-value="identity.user.email"
          disabled
          help-topic="userName"
          label="User Name"
      >
      <template v-slot:prepend>
        <v-img
            v-if="identity.user.picture"
            class="mb-3"
            :title="identity.user.email"
            :src="identity.user.picture"
            style="width: 50px; border-radius: 25px;border: solid 2px rgba(255, 255, 255, 0.5);"/>
      </template>
      </v-text-field>
      <v-btn class="ma-3" @click="logoff">
          <v-icon>
              mdi-logout
          </v-icon>
          Logoff
      </v-btn>
    </template>
  </div>
</template>
<script lang="typescript">
  import {mapState, mapActions} from "pinia";
  import {useStore as authenticationProviderStore} from "@plastic-io/graph-editor-vue3-authentication-provider";
  export default {
    name: 'auth0-settings-panel',
    props: {
      modelValue: Object,
    },
    computed: {
      ...mapState(authenticationProviderStore, [
        'identity',
      ]),
    },
    methods: {
      ...mapActions(authenticationProviderStore, [
        "logoff",
      ]),
    },
    beforeMount() {
      this.modelValue.auth0 = this.modelValue.auth0 || {
        domain: '',
        client_id: '',
      }
    }
  }
</script>
