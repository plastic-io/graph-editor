import {Amplify} from 'aws-amplify';
import {fetchAuthSession, signInWithRedirect, signOut} from 'aws-amplify/auth';
import 'aws-amplify/auth/enable-oauth-listener';
import {Hub} from 'aws-amplify/utils';
import type {Router} from 'vue-router';
import type {App} from 'vue';
import AuthenticationProvider, {authRequiredFor, useStore as useAuthenticationStore} from '@plastic-io/graph-editor-vue3-authentication-provider';
import EditorModule, {Plugin} from '@plastic-io/graph-editor-vue3-editor-module';
import {useStore as useOrchestratorStore} from '@plastic-io/graph-editor-vue3-orchestrator';
import {useStore as usePreferencesStore} from '@plastic-io/graph-editor-vue3-preferences-provider';
import LoginMenu from '../AuthenticationProvider/LoginMenu.vue';
import Settings from './Settings.vue';
import {validateCognito} from './config';

const RETURN_TO = 'cognito-return-to';
const LOGIN_ATTEMPTED = 'cognito-login-attempted';
export function cognitoSubject(issuer: string, sub: string) { return `cognito:${encodeURIComponent(issuer)}:${sub}`; }

export class AmplifyAuthenticationProvider extends AuthenticationProvider {
    private stopListening?: () => void;
    private issuer = '';
    private configured = false;
    constructor(private router: Router, private config: Record<string, any>) {
        super();
        useAuthenticationStore().init = () => this.init();
    }
    protected async initialize() {
        const required = authRequiredFor(usePreferencesStore().preferences);
        if (!required && !this.config.userPoolId) return;
        validateCognito(this.config);
        const c = this.config;
        const region = c.userPoolId.split('_')[0];
        this.issuer = `https://cognito-idp.${region}.amazonaws.com${region.startsWith('cn-') ? '.cn' : ''}/${c.userPoolId}`;
        this.stopListening = Hub.listen('auth', ({payload}) => {
            if (payload.event === 'signedOut') this.clear();
            if (payload.event === 'tokenRefresh_failure' || payload.event === 'signInWithRedirect_failure') this.clear('failed');
        });
        Amplify.configure({ Auth: { Cognito: {
            userPoolId: c.userPoolId, userPoolClientId: c.userPoolClientId,
            loginWith: { oauth: { domain: c.domain, scopes: c.scopes,
                redirectSignIn: [c.redirectSignIn], redirectSignOut: [c.redirectSignOut], responseType: 'code' } },
        } } });
        this.configured = true;
        // Amplify awaits an in-flight OAuth exchange before returning this session.
        const session = await fetchAuthSession();
        if (session.tokens?.accessToken) {
            this.publishSession(session);
            sessionStorage.removeItem(LOGIN_ATTEMPTED);
            if (/auth-callback/.test(location.pathname)) {
                const target = sessionStorage.getItem(RETURN_TO) || '/';
                sessionStorage.removeItem(RETURN_TO);
                history.replaceState(history.state, '', location.pathname);
                setTimeout(() => { void this.router.replace(target.startsWith('/') && !target.startsWith('//') ? target : '/'); }, 0);
            }
        } else if (/auth-callback/.test(location.pathname) && new URLSearchParams(location.search).has('state')) {
            history.replaceState(history.state, '', location.pathname);
            throw new Error('Cognito sign-in did not establish a session; try signing in again');
        } else if (required && !sessionStorage.getItem(LOGIN_ATTEMPTED)) {
            sessionStorage.setItem(LOGIN_ATTEMPTED, '1');
            await this.login();
        }
    }
    private publishSession(session: Awaited<ReturnType<typeof fetchAuthSession>>) {
        const access = session.tokens?.accessToken;
        const sub = access?.payload.sub;
        if (!access || typeof sub !== 'string' || access.payload.iss !== this.issuer) throw new Error('No Cognito access token for the configured user pool');
        const claims = session.tokens?.idToken?.payload || {};
        const user = { sub: cognitoSubject(this.issuer, sub), name: claims.name, email: claims.email, picture: claims.picture };
        this.publish(user, access.toString(), 'Cognito');
        return access.toString();
    }
    async redirectCallback() { await this.getToken(); }
    async getUser() { return useAuthenticationStore().identity.user; }
    async getToken(forceRefresh = false): Promise<string> {
        if (!this.configured) throw new Error('Cognito is not initialized');
        const generation = this.generation;
        try {
            const session = await fetchAuthSession({forceRefresh});
            if (generation !== this.generation) throw new Error('Session changed during refresh');
            return this.publishSession(session);
        } catch (error) {
            if (generation === this.generation) this.clear('failed');
            throw error;
        }
    }
    async login() {
        if (!this.configured) throw new Error('Configure Cognito and reload before signing in');
        sessionStorage.setItem(RETURN_TO, location.pathname.replace(this.router.options.history.base, '') || '/');
        // This public SDK hook preserves SDK-generated PKCE and state, adding only
        // the optional Cognito resource indicator before the browser navigates.
        return signInWithRedirect(this.config.resource ? { options: { authSessionOpener: async (url) => {
            const target = new URL(url);
            target.searchParams.set('resource', this.config.resource);
            location.assign(target.toString());
        } } } : undefined);
    }
    async logoff() {
        this.clear();
        sessionStorage.setItem(LOGIN_ATTEMPTED, '1');
        if (this.configured) await signOut();
    }
    dispose() { this.stopListening?.(); super.dispose(); }
}

export default class AmplifyModule extends EditorModule {
    constructor(config: Record<string, any>, app: App, router: Router) {
        super();
        const store = useOrchestratorStore();
        store.authProvider = new AmplifyAuthenticationProvider(router, config);
        app.component('cognito-login-menu', LoginMenu);
        app.component('cognito-settings-panel', Settings);
        store.addPlugin(new Plugin({ name: 'Cognito', title: 'Authentication', component: 'cognito-settings-panel', type: 'settings-panel', icon: 'mdi-account-key', props: {config} }));
        for (const type of ['manager-top-bar-right', 'system-bar-top']) {
            store.addPlugin(new Plugin({ name: 'Cognito', title: 'Authentication', component: 'cognito-login-menu', type, order: 2 }));
        }
    }
}
