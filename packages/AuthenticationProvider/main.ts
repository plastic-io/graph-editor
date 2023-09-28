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
        }
    },
});
