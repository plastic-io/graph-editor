import { defineStore } from 'pinia';
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
import {authRequiredFor, isServerUrl, tokenExpiresAt} from './transport';
export {authRequiredFor, isServerUrl, tokenExpiresAt} from './transport';

export type SessionStatus = 'initializing' | 'authenticated' | 'unauthenticated' | 'failed';
const emptyIdentity = () => ({ isAuthenticated: false, user: {} as Record<string, any>, provider: '', token: '' });

export default abstract class AuthenticationProvider {
    private initialization?: Promise<void>;
    private disposed = false;
    protected generation = 0;
    protected abstract initialize(): Promise<void>;
    init(): Promise<void> {
        if (this.disposed) return Promise.reject(new Error('Authentication provider is disposed'));
        if (!this.initialization) {
            const store = useStore();
            store.status = 'initializing';
            this.initialization = Promise.resolve().then(() => this.initialize()).then(() => {
                if (store.status === 'initializing') store.status = 'unauthenticated';
            }).catch((error) => {
                this.clear('failed');
                store.error = error instanceof Error ? error.message : String(error);
                throw error;
            });
        }
        return this.initialization;
    }
    protected publish(user: Record<string, any>, token: string, provider: string) {
        const expiresAt = tokenExpiresAt(token);
        if (!user.sub || !token || (expiresAt !== undefined && expiresAt * 1000 <= Date.now())) {
            throw new Error('Authentication returned an invalid session');
        }
        const store = useStore();
        store.$patch({ identity: { user, token, provider, isAuthenticated: true }, status: 'authenticated', error: '' });
    }
    protected clear(status: SessionStatus = 'unauthenticated') {
        this.generation++;
        useStore().$patch({ identity: emptyIdentity(), status, error: '' });
    }
    dispose() { this.disposed = true; this.clear(); }
    abstract redirectCallback(): Promise<void>;
    abstract getUser(): Promise<any>;
    abstract getToken(forceRefresh?: boolean): Promise<string>;
    abstract login(): Promise<any>;
    abstract logoff(): Promise<any>;
}

/** All protected HTTP paths obtain current credentials, without replaying mutations. */
export async function authorizedFetch(url: string, init: RequestInit = {}): Promise<Response> {
    const orchestrator = useOrchestratorStore();
    const prefs = orchestrator.preferencesStore?.preferences;
    if (!isServerUrl(url, String(prefs?.graphHTTPServer || ''))) return fetch(url, init);
    const provider = orchestrator.authProvider;
    const store = useStore();
    let token = '';
    if (provider) {
        await store.init();
        if (store.identity.isAuthenticated) token = await provider.getToken();
    }
    if (!token && authRequiredFor(prefs)) throw new Error('Sign in to access the graph server');
    const headers = new Headers(init.headers || {});
    headers.delete('Authorization');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    // Credentials must not follow an HTTP redirect outside the configured API path.
    return fetch(url, { ...init, headers, redirect: 'error' });
}

export const useStore = defineStore('authentication', {
    state: () => ({
        init: async (): Promise<void> => {},
        status: 'unauthenticated' as SessionStatus,
        error: '',
        orchistratorStore: useOrchestratorStore(),
        identity: emptyIdentity(),
    }),
    actions: {
        async logoff() { return this.orchistratorStore.authProvider?.logoff(); },
        async login() { return this.orchistratorStore.authProvider?.login(); },
    },
});
