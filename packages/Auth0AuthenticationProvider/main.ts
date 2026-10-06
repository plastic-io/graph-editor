import type {App} from "vue";
import type {Router, RouteLocation} from "vue-router";
import Auth0SettingsPanel from './Auth0SettingsPanel.vue';
import Auth0LogOffMenu from './Auth0LogOffMenu.vue';
import type { Store } from 'pinia';
import {createAuth0Client} from "@auth0/auth0-spa-js";
import AuthenticationProvider, {useStore as useAuthenticationStore, authRequiredFor} from "@plastic-io/graph-editor-vue3-authentication-provider";
import EditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
const STORE_KEY = 'auth0-redirect';
const LOGIN_ATTEMPTED_KEY = 'auth0-login-attempted';
export {authRequiredFor} from '@plastic-io/graph-editor-vue3-authentication-provider';
/**
 * The Auth0 API identifier the access token must be minted for.  Precedence: an explicit
 * setting (Settings > Auth0 > audience); the `audience` the server publishes in its RFC 9728
 * protected-resource metadata; its `resource`, for a server that publishes no audience;
 * finally the HTTPS server URL without its trailing slash.
 *
 * `audience` comes before `resource` because they are not the same string, and treating
 * them as one locked this editor out: a resource indicator has to name the server itself
 * or an MCP client refuses it, while an audience has to be an API the tenant knows.
 * Asking Auth0 for a token for a URL it has never heard of answers "Service not found".
 */
/**
 * The address Auth0 returns to, on the site the editor is actually being
 * served from.  Kept here, and tested, because getting it wrong locks everyone
 * out of the deployed editor while localhost keeps working.
 */
export function redirectUriFor(location: {protocol?: string; host: string}): string {
  const protocol = location.protocol && /^https?:$/.test(location.protocol) ? location.protocol : 'https:';
  return `${protocol}//${location.host}/graph-editor/auth-callback`;
}

export async function resolveAudience(prefs: any): Promise<string> {
  const explicit = prefs && prefs.auth0 && prefs.auth0.audience;
  if (explicit) {
    return String(explicit).trim();
  }
  if (!authRequiredFor(prefs)) {
    return '';
  }
  const base = String(prefs.graphHTTPServer || '').replace(/\/+$/, '');
  try {
    const response = await fetch(`${base}/.well-known/oauth-protected-resource`);
    if (response.ok) {
      const metadata = await response.json();
      if (metadata && typeof metadata.audience === 'string' && metadata.audience) {
        return metadata.audience;
      }
      if (metadata && typeof metadata.resource === 'string' && metadata.resource) {
        return metadata.resource;
      }
    }
    console.warn('The server did not publish protected-resource metadata; using its URL as the audience.');
  } catch (err) {
    console.warn('Cannot read the server\'s protected-resource metadata; using its URL as the audience.', err);
  }
  return base;
}
export default class Auth0 extends EditorModule {
  constructor(config: Record<string, any>, app: App<Element>, router: Router) {
    super();
    app.component('auth0-log-off-menu', Auth0LogOffMenu);
    app.component('auth0-settings-panel', Auth0SettingsPanel);
    const graphOrchestratorStore = useOrchestratorStore();

    const authProvider = new Auth0AuthenticationProvider(router, config);

    const settingsPanel = new Plugin({
      name: 'Auth0',
      title: 'Authentication',
      component: 'auth0-settings-panel',
      icon: 'mdi-account-key',
      helpTopic: 'auth0',
      type: 'settings-panel',
      order: 0,
    });

    const logoffIconManager = new Plugin({
      name: 'Auth0',
      title: 'Logout',
      component: 'auth0-log-off-menu',
      props: {
        alt: 'Logout of your current session',
        title: 'Logout of your current session',
        icon: 'mdi-logout',
        className: 'mr-4 pr-2',
      },
      divider: true,
      helpTopic: 'logoff',
      type: 'manager-top-bar-right',
      order: 2,
    });

    const logoffIcon = new Plugin({
      name: 'Auth0',
      title: 'Logout',
      component: 'auth0-log-off-menu',
      props: {
        "help-topic": "logout",
        alt: 'Logout of your current session',
        title: 'Logout of your current session',
        className: 'mb-1 pr-2',
        size: 'medium',
      },
      divider: true,
      helpTopic: 'logoff',
      type: 'system-bar-top',
      order: 2,
    });

    graphOrchestratorStore.addPlugin(logoffIcon);
    graphOrchestratorStore.addPlugin(settingsPanel);
    graphOrchestratorStore.addPlugin(logoffIconManager);

    graphOrchestratorStore.authProvider = authProvider;
  }
};

export class Auth0AuthenticationProvider extends AuthenticationProvider {
    private client: any;
    private audience = '';
    private redirectUri = '';
    private required = false;
    constructor(private router: Router, private config: Record<string, any> = {}) {
        super();
        useAuthenticationStore().init = () => this.init();
    }
    protected async initialize(generation: number) {
        const prefs: any = usePreferencesStore().preferences;
        const config = { ...(this.config.defaults || {}), ...(prefs.auth0 || {}), ...(this.config.overrides || {}) };
        this.required = authRequiredFor(prefs);
        if (!config.domain || !config.clientId) {
            if (this.required) throw new Error('Configure the Auth0 domain and client ID');
            return;
        }
        this.redirectUri = config.redirect_uri
            ? String(config.redirect_uri).replace(/:host/, self.location.host) : redirectUriFor(self.location);
        this.audience = await resolveAudience({ ...prefs, auth0: config });
        this.assertCurrent(generation);
        this.client = await createAuth0Client({
            domain: config.domain, clientId: config.clientId,
            cacheLocation: 'localstorage', useRefreshTokens: true, useRefreshTokensFallback: true,
            authorizationParams: { redirect_uri: this.redirectUri, ...(this.audience ? { audience: this.audience } : {}) },
        });
        this.assertCurrent(generation);
        const params = new URLSearchParams(location.search);
        if (/auth-callback/.test(location.pathname)) {
            try {
                if (params.has('state') && (params.has('code') || params.has('error'))) await this.redirectCallback();
            } finally {
                if (this.isCurrent(generation)) {
                    const target = localStorage.getItem(STORE_KEY) || '/';
                    localStorage.removeItem(STORE_KEY);
                    // Remove callback secrets even on failure; defer navigation so its
                    // guard cannot await the initialization that initiated navigation.
                    history.replaceState(history.state, '', location.pathname);
                    setTimeout(() => {
                        if (this.isCurrent(generation)) void this.router.replace(target.startsWith('/') && !target.startsWith('//') ? target : '/');
                    }, 0);
                }
            }
        }
        const authenticated = await this.client.isAuthenticated();
        this.assertCurrent(generation);
        if (authenticated) {
            try {
                await this.fetchToken(generation);
            } catch (error: any) {
                this.assertCurrent(generation);
                if (this.required && ['login_required','consent_required'].includes(error?.error) && !sessionStorage.getItem(LOGIN_ATTEMPTED_KEY)) {
                    sessionStorage.setItem(LOGIN_ATTEMPTED_KEY, '1');
                    await this.login();
                    return;
                }
                throw error;
            }
            sessionStorage.removeItem(LOGIN_ATTEMPTED_KEY);
        } else if (this.required && !sessionStorage.getItem(LOGIN_ATTEMPTED_KEY)) {
            sessionStorage.setItem(LOGIN_ATTEMPTED_KEY, '1');
            await this.login();
        }
    }
    async redirectCallback() { await this.client.handleRedirectCallback(); }
    async getUser() { return this.client?.getUser(); }
    async getToken(forceRefresh = false): Promise<string> {
        const generation = this.generation;
        try {
            return await this.fetchToken(generation, forceRefresh);
        } catch (error) {
            if (this.isCurrent(generation)) this.clear('failed');
            throw error;
        }
    }
    private async fetchToken(generation: number, forceRefresh = false): Promise<string> {
        this.assertCurrent(generation);
        if (!this.client) throw new Error('Auth0 is not initialized');
        const token = await this.client.getTokenSilently({ ...(this.audience ? { authorizationParams: { audience: this.audience } } : {}), ...(forceRefresh ? { cacheMode: 'off' } : {}) });
        const user = await this.client.getUser();
        this.publish(user, token, 'Auth0', generation);
        return token;
    }
    async login() {
        this.assertCurrent(this.generation);
        if (!this.client) throw new Error('Configure Auth0 and reload before signing in');
        localStorage.setItem(STORE_KEY, location.pathname.replace(this.router.options.history.base, '') || '/');
        return this.client.loginWithRedirect({ authorizationParams: {
            redirect_uri: this.redirectUri, ...(this.audience ? { audience: this.audience } : {}),
        } });
    }
    async logoff() {
        this.assertCurrent(this.generation);
        this.clear();
        sessionStorage.setItem(LOGIN_ATTEMPTED_KEY, '1');
        return this.client?.logout({ logoutParams: { returnTo: location.origin + (this.router.options.history.base || '/') } });
    }
}
