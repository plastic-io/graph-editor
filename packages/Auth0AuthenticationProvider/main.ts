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
        this.audience = config.audience || (this.serverMode ? String(prefs.graphHTTPServer || '').replace(/\/+$/, '') : '');
        // init auth0 client
        await this.init();
      }
      this.authenticationStore.init = setup;
    }
    async init() {
      // begin login/redirect flow

      const isCallbackUrl = /auth-callback/.test(self.location.toString());

      const options: any = {
          domain: this.domain,
          clientId: this.clientId,
          authorizationParams: {
            redirect_uri: this.redirectUri,
            ...(this.audience ? { audience: this.audience } : {}),
          },
      };

      this.client = await (createAuth0Client as any)(options);

      // coming back from logging in
      if (isCallbackUrl) {
        await this.client.handleRedirectCallback();
        const rdr = localStorage.getItem(STORE_KEY);
        this.router.push(rdr || '/');
      }

      const isAuthenticated = await this.client.isAuthenticated();

      if (!isAuthenticated && !isCallbackUrl) {
        if (this.serverMode) {
          // A server-backed editor cannot do anything without a token: every route on the
          // graph server requires one.  Send the user to log in and come back here.
          await this.login();
        }
        return;
      }

      const token = await this.client.getTokenSilently(this.tokenOptions());

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
