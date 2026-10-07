<template>
  <span v-if="urls">
    <v-btn v-if="!compact" variant="text" size="small" prepend-icon="mdi-connection" @click="open" class="mr-2">Connect MCP</v-btn>
    <v-btn v-else variant="text" size="x-small" icon="mdi-connection" aria-label="Connect MCP" title="Connect MCP" @click="open"/>
    <v-dialog v-model="visible" max-width="760" scrollable>
      <v-card title="Connect MCP">
        <v-card-text>
          <p class="mb-3">Connect ChatGPT or Codex to the graph server used by this editor.</p>
          <v-text-field :model-value="urls.mcp" label="MCP server URL" readonly hide-details density="compact" data-testid="mcp-server-url"/>
          <v-btn class="my-2" size="small" variant="tonal" prepend-icon="mdi-content-copy" @click="copyUrl">Copy URL</v-btn>
          <p v-if="copyMessage" class="text-caption mb-2" role="status">{{ copyMessage }}</p>
          <v-progress-linear v-if="loading" indeterminate class="my-2" aria-label="Loading authentication details"/>
          <v-alert v-if="discoveryError" type="info" variant="tonal" density="compact" class="my-3">
            Authentication details could not be loaded. The URL above still points to your configured graph server; check its OAuth setup before connecting.
          </v-alert>
          <v-alert v-if="cognito && !automaticRegistration" type="info" variant="tonal" density="compact" class="my-3">
            Cognito requires an OAuth client registered for ChatGPT or Codex. Your editor login does not register that connection. See administrator setup below.
          </v-alert>
          <v-tabs v-model="tab" class="mb-3">
            <v-tab value="chatgpt">ChatGPT</v-tab>
            <v-tab value="codex">Codex</v-tab>
          </v-tabs>
          <section v-if="tab === 'chatgpt'" aria-label="ChatGPT setup">
            <ol class="setup-steps">
              <li>Open ChatGPT Plugins, select the plus button, then <strong>Add custom MCP server</strong>.</li>
              <li>Name it <strong>Graph Server</strong> and paste the MCP server URL above.</li>
              <li>Choose <strong>OAuth</strong>. <span v-if="automaticRegistration">Leave the client ID and secret empty; the connection registers automatically. </span><span v-else>Use registered client credentials when your provider requires them. </span>Sign in with your graph account.</li>
              <li>Create and install the plugin. In a conversation, type <strong>@</strong> and select Graph Server.</li>
            </ol>
            <p class="text-caption my-3">Your ChatGPT workspace must allow custom MCP servers.</p>
            <v-btn href="https://chatgpt.com/plugins" target="_blank" rel="noopener noreferrer" variant="tonal" size="small">Open ChatGPT Plugins</v-btn>
            <p class="mt-3"><a href="https://developers.openai.com/api/docs/guides/custom-mcp-server" target="_blank" rel="noopener noreferrer">OpenAI ChatGPT setup guide</a></p>
          </section>
          <section v-else aria-label="Codex setup">
            <p class="mb-3">Run this command in a terminal with the Codex CLI installed.</p>
            <v-text-field v-if="!automaticRegistration" v-model="clientId" label="Registered OAuth client ID" :hint="cognito ? 'Required for Cognito. Get a dedicated public client ID from your administrator.' : 'Only needed if your identity provider requires a pre-registered client.'" persistent-hint density="compact" class="mb-3"/>
            <pre class="command-block" data-testid="codex-add-command">{{ addCommand }}</pre>
            <v-btn class="my-2" variant="tonal" size="small" @click="copy(addCommand)" :disabled="cognito && !automaticRegistration && !clientId.trim()">Copy command</v-btn>
            <p v-if="!automaticRegistration" class="my-2">If using a registered client, have your administrator allow the exact callback URL printed by Codex. Then finish signing in:</p>
            <p v-if="automaticRegistration" class="my-2">The client registers automatically. Sign in with your graph account:</p>
            <pre class="command-block">codex mcp login graph-server</pre>
            <p class="my-2">Restart the Codex session and use <code>/mcp</code> to check the connection.</p>
            <p class="mt-3"><a href="https://learn.chatgpt.com/docs/extend/mcp" target="_blank" rel="noopener noreferrer">OpenAI Codex MCP setup guide</a></p>
          </section>
          <v-expansion-panels class="mt-4" variant="accordion">
            <v-expansion-panel title="Administrator OAuth setup">
              <v-expansion-panel-text>
                <p v-if="issuer" class="mb-2">Authorization server: <code class="break-text">{{ issuer }}</code></p>
                <p v-if="scopes.length" class="mb-2">API scopes: <code>{{ scopes.join(' ') }}</code></p>
                <p v-if="automaticRegistration" class="my-3">Automatic OAuth registration is enabled for ChatGPT and local MCP clients. No manual client ID, secret, or callback registration is needed. Graph access requires an authenticated user.</p>
                <ol v-else class="setup-steps">
                  <li>Register a separate authorization-code OAuth client with PKCE for each external app. Allow its exact callback URL from ChatGPT or Codex; do not substitute the editor callback.</li>
                  <li v-if="cognito">Enable the API scopes above and the OIDC scopes requested by the client. Add the new human client ID to the server's <code>COGNITO_CLIENT_IDS</code> through the deployment configuration.</li>
                  <li>Verify OAuth discovery advertises PKCE <code>S256</code> and a token authentication method accepted by the client. Native Cognito discovery may require an OAuth adapter to meet these requirements.</li>
                </ol>
                <p v-if="!automaticRegistration" class="mt-3">Use a public client for local Codex. Keep any ChatGPT client secret in its OAuth setup, outside the editor. Configure a fixed callback port when your provider requires an exact loopback URL.</p>
                <p class="mt-3"><a href="https://developers.openai.com/plugins/build/auth" target="_blank" rel="noopener noreferrer">OpenAI OAuth requirements</a></p>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-card-text>
        <v-card-actions><v-spacer/><v-btn @click="visible = false">Close</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
  </span>
</template>
<script lang="ts">
import {defineComponent} from 'vue';
import {useStore as usePreferencesStore} from '@plastic-io/graph-editor-vue3-preferences-provider';
import {connectionUrls, codexAddCommand} from './connection';

export default defineComponent({
  props: {compact: Boolean},
  data() {
    return {visible:false, tab:'chatgpt', clientId:'', copyMessage:'', loading:false, discoveryError:false,
      authProvider:'', automaticRegistration:false, issuer:'', scopes:[] as string[], request:null as AbortController | null};
  },
  computed: {
    urls() {
      const preferences = usePreferencesStore().preferences;
      return connectionUrls(preferences.graphHTTPServer, preferences.useLocalStorage);
    },
    cognito(): boolean { return this.authProvider === 'cognito'; },
    addCommand(): string { return this.urls ? codexAddCommand(this.urls.mcp, this.automaticRegistration ? '' : this.clientId, this.cognito && !this.automaticRegistration) : ''; },
  },
  beforeUnmount() { this.request?.abort(); },
  methods: {
    async open() {
      if (!this.urls) return;
      this.visible = true;
      this.copyMessage = '';
      this.authProvider = ''; this.issuer = ''; this.scopes = []; this.automaticRegistration = false;
      this.discoveryError = false; this.loading = true;
      this.request?.abort();
      const request = new AbortController(); this.request = request;
      const timer = setTimeout(() => request.abort(), 10000);
      try {
        const response = await fetch(this.urls.metadata, {signal:request.signal, redirect:'error', credentials:'omit'});
        if (!response.ok) throw new Error('Discovery unavailable');
        const metadata = await response.json();
        if (this.request !== request) return;
        this.authProvider = String(metadata.auth_provider || '');
        this.automaticRegistration = metadata.client_registration === 'dynamic';
        this.issuer = typeof metadata.authorization_servers?.[0] === 'string' ? metadata.authorization_servers[0] : '';
        this.scopes = Array.isArray(metadata.scopes_supported) ? metadata.scopes_supported.filter((scope:unknown) => typeof scope === 'string') : [];
      } catch {
        if (this.request === request) this.discoveryError = true;
      } finally {
        clearTimeout(timer);
        if (this.request === request) this.loading = false;
      }
    },
    async copyUrl() { if (this.urls) await this.copy(this.urls.mcp); },
    async copy(value: string) {
      try { await navigator.clipboard.writeText(value); this.copyMessage = 'Copied.'; }
      catch { this.copyMessage = 'Copy was unavailable. Select the text and copy it manually.'; }
    },
  },
});
</script>
<style scoped>
.setup-steps { padding-left: 1.25rem; }
.setup-steps li { margin-bottom: .6rem; }
.command-block { padding: .75rem; background: rgba(127,127,127,.12); border-radius: .25rem; white-space: pre-wrap; overflow-wrap: anywhere; }
.break-text { overflow-wrap: anywhere; }
</style>
