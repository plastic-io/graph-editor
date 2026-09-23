import type {App} from "vue";
import type {Router, RouteLocation} from "vue-router";
import Auth0SettingsPanel from './Auth0SettingsPanel.vue';
import Auth0LogOffMenu from './Auth0LogOffMenu.vue';
import type { Store } from 'pinia';
import {createAuth0Client} from "@auth0/auth0-spa-js";
import AuthenticationProvider, {useStore as useAuthenticationStore} from "@plastic-io/graph-editor-vue3-authentication-provider";
import EditorModule, {Plugin} from "@plastic-io/graph-editor-vue3-editor-module";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {useStore as usePreferencesStore} from "@plastic-io/graph-editor-vue3-preferences-provider";
const STORE_KEY = 'auth0-redirect';
const LOGIN_ATTEMPTED_KEY = 'auth0-login-attempted';
/**
 * Whether the configured server checks tokens: an explicit audience, or an HTTPS server.
 * Local dev servers (http://) have no authorizer, so no login is required for them.
 */
export function authRequiredFor(prefs: any): boolean {
  if (!prefs || prefs.useLocalStorage) {
    return false;
  }
  if (prefs.auth0 && prefs.auth0.audience) {
    return true;
  }
  return /^https:\/\//i.test(String(prefs.graphHTTPServer || ''));
}

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

    const authProvider = new Auth0AuthenticationProvider(router);

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

    authProvider.router = router;
    graphOrchestratorStore.authProvider = authProvider;
  }
};

export class Auth0AuthenticationProvider extends AuthenticationProvider {
    audience = '';
    serverMode = false;
    authRequired = false;
    domain: string = '';
    clientId: string = '';
    redirectUri: string = '';
    router: Router;
    loaded: boolean = false;
    authenticationStore: any;
    preferencesStore: any;
    constructor(router: Router) {
      super();
      this.router = router;
      this.authenticationStore = useAuthenticationStore();
      this.preferencesStore = usePreferencesStore();
      const setup = async () => {
        // if setup has already run or preferences isn't loaded yet then wait
        if (!this.preferencesStore.preferences || this.loaded) {
          return;
        }
        this.loaded = true;
        // grab the auth0 data from prefs
        const config = (this.preferencesStore.preferences as any).auth0;
        // validate data
        if (!config || !config.clientId || !config.domain) {
          console.warn('Missing auth0 configuration information.  Go to Settings > Auth0 and add your information to finish setting up auth0');
          return;
        }
        // determine redirect URI
        this.redirectUri = (config.redirect_uri
          ? config.redirect_uri
          : 'http://:host/graph-editor/auth-callback')
          .replace(/:host/, self.location.host);
        this.domain = config.domain;
        this.clientId = config.clientId;
        // The access token must be minted for the server's API identifier (Auth0 "API"),
        // which defaults to the HTTP server URL without its trailing slash.
        const prefs = this.preferencesStore.preferences as any;
        this.serverMode = !prefs.useLocalStorage;
        // Login is mandatory only when the server actually checks tokens (an HTTPS server
        // or an explicit audience); the local dev server on http://localhost has no authorizer.
        this.authRequired = authRequiredFor(prefs);
        this.audience = await resolveAudience(prefs);
        if (this.authRequired) {
          try {
            const target = new URL(this.redirectUri).host;
            if (target !== self.location.host) {
              console.warn(`Auth0 will return to ${target} but the editor is open on ${self.location.host}; the login transaction lives in this tab's sessionStorage and will not be found there.`);
            }
          } catch (err) { /* malformed redirect uri; Auth0 will report it */ }
        }
        // init auth0 client; a failure here must never abort navigation
        try {
          await this.init();
        } catch (err) {
          console.error('Auth0 initialisation failed; the editor continues without a session', err);
        }
      }
      this.authenticationStore.init = setup;
    }
    async init() {
      // begin login/redirect flow

      const params = new URLSearchParams(self.location.search);
      const onCallbackRoute = /auth-callback/.test(self.location.toString());
      // Only a URL carrying a fresh authorization response can be exchanged; a reload,
      // bookmark or back-navigation onto the callback route has nothing to exchange.
      const isCallbackUrl = onCallbackRoute && params.has('state') && (params.has('code') || params.has('error'));

      const options: any = {
          domain: this.domain,
          clientId: this.clientId,
          // Keep the session across reloads: tokens in localStorage, renewed with refresh
          // tokens when the API allows offline access, else silently in an iframe.  Without
          // this every reload restarted the login (and, on localhost, Auth0's consent screen).
          cacheLocation: 'localstorage',
          useRefreshTokens: true,
          useRefreshTokensFallback: true,
          authorizationParams: {
            redirect_uri: this.redirectUri,
            ...(this.audience ? { audience: this.audience } : {}),
          },
      };

      this.client = await (createAuth0Client as any)(options);

      // coming back from logging in
      if (isCallbackUrl) {
        try {
          await this.client.handleRedirectCallback();
        } catch (err: any) {
          console.error('Auth0 redirect callback failed:', err && (err.error_description || err.message), err);
        }
        const rdr = localStorage.getItem(STORE_KEY);
        localStorage.removeItem(STORE_KEY);
        // Drop code/state from the address bar first, so a reload cannot replay the exchange.
        await this.router.replace(rdr || '/');
      } else if (onCallbackRoute) {
        await this.router.replace('/');
      }

      const isAuthenticated = await this.client.isAuthenticated();

      if (!isAuthenticated) {
        if (this.authRequired && !sessionStorage.getItem(LOGIN_ATTEMPTED_KEY)) {
          // A server-backed editor cannot do anything without a token: every route on the
          // graph server requires one.  Send the user to log in and come back here (once
          // per tab; if that does not produce a session the login button is the way in).
          sessionStorage.setItem(LOGIN_ATTEMPTED_KEY, String(Date.now()));
          await this.login();
        } else if (this.authRequired) {
          console.warn('Not authenticated after a login attempt; use the login button in the top bar.');
        }
        return;
      }
      sessionStorage.removeItem(LOGIN_ATTEMPTED_KEY);

      let token: string;
      try {
        token = await this.client.getTokenSilently(this.tokenOptions());
      } catch (err: any) {
        console.error(`Cannot get an access token for audience "${this.audience}":`, err && (err.error_description || err.message), err);
        if (this.authRequired && err && (err.error === 'login_required' || err.error === 'consent_required') && !sessionStorage.getItem(LOGIN_ATTEMPTED_KEY)) {
          sessionStorage.setItem(LOGIN_ATTEMPTED_KEY, String(Date.now()));
          await this.login();
        }
        return;
      }

      const user = await this.client.getUser();

      this.authenticationStore.$patch({
        identity: {
          user,
          token,
          provider: 'Auth0',
          isAuthenticated
        },
      });
    }
    async redirectCallback() {
        return await this.client.handleRedirectCallback();
    }
    async getUser() {
        try {
            return await this.client.getUser();
        } catch (err) {
            throw new Error("Auth0AuthProvider getUser:" + err);
        }
    }
    tokenOptions() {
        return this.audience ? { authorizationParams: { audience: this.audience } } : {};
    }
    async getToken() {
        try {
            const token = await this.client.getTokenSilently(this.tokenOptions());
            if (token && this.authenticationStore.identity.token !== token) {
              this.authenticationStore.$patch({ identity: { ...this.authenticationStore.identity, token } });
            }
            return token;
        } catch (err) {
            throw new Error("Auth0AuthProvider getToken:" + err);
        }
    }
    async login() {
        // save the current location in localStore so we can send
        // user back there when they respawn
        localStorage.setItem(STORE_KEY, self.location.pathname
          .replace(this.router.options.history.base, ''));
        try {
            return await this.client.loginWithRedirect({
              authorizationParams: {
                redirect_uri: this.redirectUri,
                ...(this.audience ? { audience: this.audience } : {}),
              }
            });
        } catch (err) {
            throw new Error("Auth0AuthProvider login:" + err);
        }
    }
    async logoff() {
        try {
            return await this.client.logout({
              logoutParams: {
                returnTo: self.location.origin + (this.router.options.history.base || '/'),
              }
            });
        } catch (err) {
            throw new Error("Auth0AuthProvider logout:" + err);
        }
    }
}
