import { defineStore } from 'pinia';
import {useStore as useOrchistratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";

export default abstract class AuthenticationProvider {
    client: any;
    constructor() {};
    abstract redirectCallback(): Promise<void>;
    abstract getUser(): Promise<any>;
    abstract getToken(): Promise<any>;
    abstract login(): Promise<any>;
    abstract logoff(): Promise<any>;
}

/**
 * fetch() that presents the session's access token to the graph server.  The header is added
 * only for URLs under the configured HTTPS server, never for registries or other hosts.
 */
export async function authorizedFetch(url: string, init: RequestInit = {}): Promise<Response> {
    const token = useStore().identity.token;
    const prefs = (useOrchistratorStore() as any).preferencesStore?.preferences;
    const server = String((prefs && prefs.graphHTTPServer) || '');
    const isServerUrl = server && url.startsWith(server.replace(/\/+$/, ''));
    if (!token || !isServerUrl) {
        return fetch(url, init);
    }
    const headers = new Headers(init.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(url, { ...init, headers });
}

export const useStore = defineStore('authentication', {
    state: () => ({
        init: () => {},
        orchistratorStore: useOrchistratorStore(),
        identity: {
            isAuthenticated: false,
            user: {},
            provider: '',
            token: '',
        },
    }),
    actions: {
        logoff() {
            this.orchistratorStore.authProvider!.logoff();
        },
        login() {
            this.orchistratorStore.authProvider!.login();
        }
    },
});
