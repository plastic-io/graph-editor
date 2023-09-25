import type {App} from "vue";
import type {Router, RouteLocation} from "vue-router";
import Auth0SettingsPanel from './Auth0SettingsPanel.vue';
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
    app.component('auth0-settings-panel', Auth0SettingsPanel);
    const graphOrchestratorStore = useOrchestratorStore();
    
    const authProvider = new Auth0AuthenticationProvider(router);
    
    const settingsPanel = new Plugin({
      name: 'Auth0',
      title: 'Auth0 Provider Settings',
      component: 'auth0-settings-panel',
      icon: 'mdi-account-key',
      helpTopic: 'auth0',
      type: 'settings-panel',
      order: 0,
    });

    const logoffIcon = new Plugin({
      name: 'Auth0',
      title: 'Logout',
      component: 'v-icon',
      props: {
        alt: 'Logout of your current session',
        title: 'Logout of your current session',
        icon: 'mdi-logout',
        onclick() {
          authProvider.logoff();
        },
      },
      divider: true,
      helpTopic: 'logoff',
      type: 'system-bar-top',
      order: 2,
    });

    graphOrchestratorStore.addPlugin(logoffIcon);
    graphOrchestratorStore.addPlugin(settingsPanel);
    
    authProvider.router = router;
    graphOrchestratorStore.authProvider = authProvider;
  }
};

export class Auth0AuthenticationProvider extends AuthenticationProvider {
    domain: string = '';
    clientId: string = '';
    redirectUri: string = '';
    router: Router;
    loaded: boolean = false;
    authenticationStore: Store;
    preferencesStore: Store;
    constructor(router: Router) {
      super();
      this.router = router;
      this.authenticationStore = useAuthenticationStore();
      this.preferencesStore = usePreferencesStore();
      const setup = (mutation: any, state: any) => {
        // if setup has already run or preferences isn't loaded yet then wait
        if (!state.preferences || this.loaded) {
          return;
        }
        this.loaded = true;
        // grab the auth0 data from prefs
        const config = (state.preferences as any).auth0;
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
        // init auth0 client
        this.init();
      }
      this.preferencesStore.$subscribe(setup, { detached: true });
    }
    async init() {
      // begin login/redirect flow

      const isCallbackUrl = /auth-callback/.test(self.location.toString());

      const options = {
          domain: this.domain,
          clientId: this.clientId,
          redirect_uri: this.redirectUri,
      };

      this.client = await (createAuth0Client as any)(options);

      // coming back from logging in
      if (isCallbackUrl) {
        console.log('callback');
        await this.client.handleRedirectCallback();
        const rdr = localStorage.getItem(STORE_KEY);
        this.router.push(rdr || '/');
      }

      const isAuthenticated = await this.client.isAuthenticated();

      if (!isAuthenticated && !isCallbackUrl) {
        // save the current location in localStore so we can send
        // user back there when they respawn
        localStorage.setItem(STORE_KEY, self.location.pathname
          .replace(this.router.options.history.base, ''));
        // user must authenticate
        this.login();
      }

      const token = await this.client.getTokenSilently();

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
    async getToken() {
        try {
            return await this.client.getTokenSilently();
        } catch (err) {
            throw new Error("Auth0AuthProvider getToken:" + err);
        }
    }
    async login() {
        try {
            return await this.client.loginWithRedirect({
              authorizationParams: {
                redirect_uri: this.redirectUri,
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
                returnTo: 'http://localhost:8080/graph-editor/'
              }
            });
        } catch (err) {
            throw new Error("Auth0AuthProvider logout:" + err);
        }
    }
}
