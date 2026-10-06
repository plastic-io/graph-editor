<template>
  <div>
    <p>Sign in with your organization’s Cognito account.</p>
    <v-text-field label="User pool" :model-value="config.userPoolId" readonly />
    <v-text-field label="Sign-in domain" :model-value="config.domain" readonly />
    <p v-if="auth.error" role="alert">{{ auth.error }}</p>
    <v-btn v-if="auth.identity.isAuthenticated" @click="auth.logoff()">Sign out</v-btn>
    <v-btn v-else @click="auth.login()">Sign in</v-btn>
  </div>
</template>
<script setup lang="ts">
import {useStore} from '@plastic-io/graph-editor-vue3-authentication-provider';
defineProps<{config: Record<string, any>}>();
const auth = useStore();
</script>
