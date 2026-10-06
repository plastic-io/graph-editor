import {beforeEach, afterEach, describe, it, expect, vi} from 'vitest';
import {createPinia, setActivePinia} from 'pinia';
const state = vi.hoisted(() => ({
  orchestrator: {authProvider: null as any, preferencesStore: {preferences: {useLocalStorage: false, graphHTTPServer: 'https://api.example/dev'} as any}},
  fetchSession: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), configure: vi.fn(), listen: vi.fn(), createAuth0: vi.fn(),
}));
vi.mock('@plastic-io/graph-editor-vue3-orchestrator', () => ({useStore: () => state.orchestrator}));
vi.mock('@plastic-io/graph-editor-vue3-preferences-provider', () => ({useStore: () => state.orchestrator.preferencesStore}));
vi.mock('aws-amplify', () => ({Amplify: {configure: state.configure}}));
vi.mock('aws-amplify/auth', () => ({fetchAuthSession: state.fetchSession, signInWithRedirect: state.signIn, signOut: state.signOut}));
vi.mock('aws-amplify/auth/enable-oauth-listener', () => ({}));
vi.mock('aws-amplify/utils', () => ({Hub: {listen: state.listen}}));
vi.mock('@auth0/auth0-spa-js', () => ({createAuth0Client: state.createAuth0}));
import {AmplifyAuthenticationProvider, cognitoSubject} from '../../AmplifyAuthenticationProvider/main';
import {Auth0AuthenticationProvider} from '../../Auth0AuthenticationProvider/main';
import {authorizedFetch, useStore, isServerUrl} from '../main';
import {WSSDataProvider} from '../../WssDocumentProvider/main';
import {authBuild, deploymentConfig} from '../../../scripts/auth-build';

const issuer = 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_Test';
const jwt = (seconds = 3600) => `eyJhbGciOiJSUzI1NiJ9.${btoa(JSON.stringify({sub:'person', exp:Math.floor(Date.now()/1000)+seconds}))}.sig`;
const session = () => ({tokens: {accessToken: {payload: {sub: 'person', iss: issuer}, toString: () => jwt()}, idToken: {payload: {name:'Ada'}}}});
const router = {options: {history: {base:'/graph-editor/'}}, replace: vi.fn()} as any;
const config = {userPoolId:'us-west-2_Test', userPoolClientId:'browser', domain:'login.example.com', scopes:['openid','graphs/access'],
  redirectSignIn:'https://editor.example/graph-editor/auth-callback', redirectSignOut:'https://editor.example/graph-editor/'};
let socket: WSSDataProvider | undefined;
beforeEach(() => {
  vi.clearAllMocks(); setActivePinia(createPinia());
  for (const name of ['localStorage', 'sessionStorage']) {
    const values = new Map<string,string>();
    vi.stubGlobal(name, {getItem:(k:string)=>values.get(k) || null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k),clear:()=>values.clear()});
  }
  state.orchestrator.authProvider = null;
  state.orchestrator.preferencesStore.preferences = {useLocalStorage:false, graphHTTPServer:'https://api.example/dev', auth0:{domain:'tenant.auth0.com',clientId:'client',audience:'graphs'}};
  state.fetchSession.mockResolvedValue(session()); state.listen.mockReturnValue(vi.fn());
});
afterEach(() => { socket?.clearSession(); socket=undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('provider lifecycle', () => {
  it('initializes Cognito once, publishes the normalized subject, and refreshes on HTTP calls', async () => {
    const provider = new AmplifyAuthenticationProvider(router, config); state.orchestrator.authProvider = provider;
    await Promise.all([provider.init(), provider.init()]);
    expect(state.configure).toHaveBeenCalledTimes(1);
    expect(useStore().identity.user.sub).toBe(cognitoSubject(issuer,'person'));
    const fetcher=vi.fn().mockResolvedValue(new Response('{}')); vi.stubGlobal('fetch',fetcher);
    await authorizedFetch('https://api.example/dev/graphs');
    expect(state.fetchSession).toHaveBeenLastCalledWith({forceRefresh:false});
    expect(fetcher.mock.calls[0][1].headers.get('Authorization')).toMatch(/^Bearer /);
    provider.dispose(); expect(state.listen.mock.results[0].value).toHaveBeenCalled();
  });
  it('does not restore a session when a refresh completes after logout', async () => {
    const provider = new AmplifyAuthenticationProvider(router,config); await provider.init();
    let finish!: (value: any) => void;
    state.fetchSession.mockImplementationOnce(() => new Promise(resolve => {finish=resolve;}));
    const refresh=provider.getToken(true); await provider.logoff(); finish(session());
    await expect(refresh).rejects.toThrow(/Session changed/);
    expect(useStore().identity.token).toBe(''); expect(useStore().status).toBe('unauthenticated');
  });
  it('clears credentials on refresh failure and requests code flow with configured API scopes', async () => {
    const provider=new AmplifyAuthenticationProvider(router,config); await provider.init();
    expect(state.configure.mock.calls[0][0].Auth.Cognito.loginWith.oauth).toMatchObject({responseType:'code',scopes:['openid','graphs/access']});
    state.fetchSession.mockRejectedValueOnce(new Error('expired'));
    await expect(provider.getToken()).rejects.toThrow('expired'); expect(useStore().identity.token).toBe('');
    expect(useStore().status).toBe('failed');
  });
  it('preserves Auth0 audience and refresh behavior through the same store', async () => {
    const client={isAuthenticated:vi.fn().mockResolvedValue(true),getTokenSilently:vi.fn().mockResolvedValue(jwt()),getUser:vi.fn().mockResolvedValue({sub:'auth0|person'}),logout:vi.fn(),loginWithRedirect:vi.fn()};
    state.createAuth0.mockResolvedValue(client);
    const provider=new Auth0AuthenticationProvider(router); await Promise.all([provider.init(),provider.init()]);
    expect(state.createAuth0).toHaveBeenCalledTimes(1); expect(useStore().identity.user.sub).toBe('auth0|person');
    await provider.getToken(true); expect(client.getTokenSilently).toHaveBeenLastCalledWith({authorizationParams:{audience:'graphs'},cacheMode:'off'});
    await provider.logoff(); expect(useStore().identity.token).toBe('');
  });
});

describe('HTTP credential boundary', () => {
  it.each(['https://api.example.evil/dev/x','https://api.example/device','https://other.example/dev','https://api.example/dev/../secret'])('does not attach credentials to %s', async (url) => {
    const getToken=vi.fn();state.orchestrator.authProvider={getToken};
    const fetcher=vi.fn().mockResolvedValue(new Response('{}'));vi.stubGlobal('fetch',fetcher);
    await authorizedFetch(url);expect(getToken).not.toHaveBeenCalled(); expect(fetcher.mock.calls[0][1]).toEqual({});
  });
  it('handles path boundaries and blocks a protected call without a session', async () => {
    expect(isServerUrl('https://api.example/dev/x','https://api.example/dev/')).toBe(true);
    const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
    await expect(authorizedFetch('https://api.example/dev/x')).rejects.toThrow(/Sign in/);expect(fetcher).not.toHaveBeenCalled();
  });
});

class FakeSocket {
  static OPEN=1; static instances: FakeSocket[]=[];
  readyState=0; listeners: Record<string,Function>={}; send=vi.fn(); close=vi.fn(() => {this.readyState=3;this.listeners.close?.({code:1000});});
  constructor(public url: string, public protocols: string[]) {FakeSocket.instances.push(this);}
  addEventListener(type: string, fn: Function) {this.listeners[type]=fn;}
}
describe('socket session boundaries', () => {
  beforeEach(() => {vi.useFakeTimers();FakeSocket.instances=[];vi.stubGlobal('WebSocket',FakeSocket);});
  it('presents tokens at connection, drops queued work on logout, and ignores late refresh', async () => {
    socket=new WSSDataProvider('wss://api.example','https://api.example/',()=>{},()=>{},()=>{});socket.requireToken=true;
    let finish!: (token: string) => void;socket.tokenProvider=() => new Promise(resolve=>{finish=resolve;});
    socket.send({action:'old-user-write'});const connecting=socket.connect();socket.clearSession();finish(jwt());await connecting;
    expect(FakeSocket.instances).toHaveLength(0); expect(socket.messages).toEqual([]);
    socket.tokenProvider=async()=>jwt();socket.setToken(jwt());await Promise.resolve();
    expect(FakeSocket.instances[0].protocols[0]).toBe('access_token');
    const onEnd=vi.fn();socket.onSessionEnd(onEnd);socket.clearSession();expect(onEnd).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(4000000);expect(FakeSocket.instances).toHaveLength(1);
  });
  it('forces refresh before expiry and replaces the authenticated connection', async () => {
    socket=new WSSDataProvider('wss://api.example','https://api.example/',()=>{},()=>{},()=>{});socket.requireToken=true;
    const first=jwt(60);const next=jwt(3600);socket.tokenProvider=vi.fn().mockResolvedValueOnce(first).mockResolvedValue(next);
    socket.setToken(first);await Promise.resolve();await vi.advanceTimersByTimeAsync(31000);
    expect(socket.tokenProvider).toHaveBeenCalledWith(true);expect(FakeSocket.instances).toHaveLength(2);
    expect(FakeSocket.instances[0].close).toHaveBeenCalled();
  });
});

describe('build selection', () => {
  it('defaults to Auth0, isolates selected entry points, and rejects invalid selection', () => {
    expect(authBuild({}).alias['@graph/auth-provider']).toContain('Auth0AuthenticationProvider');
    expect(authBuild({AUTH_PROVIDER:'cognito'}).alias['@graph/auth-provider']).toContain('AmplifyAuthenticationProvider');
    expect(()=>authBuild({AUTH_PROVIDER:'other'})).toThrow();expect(()=>authBuild({AUTH_PROVIDER:'cognito'},true)).toThrow();
  });
});

describe('deployment endpoint configuration', () => {
  it('preserves existing settings when endpoints are omitted and requires a complete secure pair', () => {
    expect(deploymentConfig({})).toEqual({});
    expect(()=>deploymentConfig({GRAPH_HTTP_SERVER:'https://api.example/'})).toThrow(/both/);
    expect(()=>deploymentConfig({GRAPH_HTTP_SERVER:'http://api.example/',GRAPH_WSS_SERVER:'wss://socket.example/'})).toThrow(/HTTPS/);
    expect(()=>deploymentConfig({GRAPH_HTTP_SERVER:'https://user:secret@api.example/',GRAPH_WSS_SERVER:'wss://socket.example/'})).toThrow();
  });
  it('uses the deployed stack endpoints and selects authenticated server storage', () => {
    expect(deploymentConfig({GRAPH_HTTP_SERVER:'https://api.example/dev',GRAPH_WSS_SERVER:'wss://socket.example/dev/'}))
      .toEqual({graphHTTPServer:'https://api.example/dev/',graphWSSServer:'wss://socket.example/dev',authenticationRequired:true,useLocalStorage:false});
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(finish => {resolve = finish;});
  return {promise, resolve};
}
const auth0Client = () => ({isAuthenticated:vi.fn().mockResolvedValue(true),getTokenSilently:vi.fn().mockResolvedValue(jwt()),
  getUser:vi.fn().mockResolvedValue({sub:'auth0|person'}),logout:vi.fn(),loginWithRedirect:vi.fn(),handleRedirectCallback:vi.fn()});

for (const name of ['auth0', 'cognito']) {
  describe(`${name} initialization cancellation`, () => {
    function pendingProvider() {
      const started = deferred<void>(); const pending = deferred<any>();
      const client = auth0Client();
      if (name === 'auth0') state.createAuth0.mockImplementationOnce(() => {started.resolve();return pending.promise;});
      else state.fetchSession.mockImplementationOnce(() => {started.resolve();return pending.promise;});
      return {provider:name === 'auth0' ? new Auth0AuthenticationProvider(router) : new AmplifyAuthenticationProvider(router,config),
        started:started.promise, finish:()=>pending.resolve(name === 'auth0' ? client : session()), client};
    }
    it('does not publish a session restored after logout', async () => {
      const {provider,started,finish} = pendingProvider();
      const initialization = provider.init(); await started; await provider.logoff(); finish();
      await expect(initialization).rejects.toThrow(/Session changed/);
      expect(useStore().identity.token).toBe('');expect(useStore().status).toBe('unauthenticated');
    });
    it('does not overwrite a replacement provider session after disposal', async () => {
      const {provider,started,finish} = pendingProvider();
      const initialization = provider.init(); await started; provider.dispose();
      useStore().$patch(store => {
        store.identity={user:{sub:'new-person'},token:jwt(),isAuthenticated:true,provider:'replacement'};
        store.status='authenticated';
      });
      finish();await expect(initialization).rejects.toThrow(/Session changed/);
      expect(useStore().identity.user.sub).toBe('new-person');expect(useStore().status).toBe('authenticated');
    });
  });
}

describe('Auth0 login recovery', () => {
  it.each(['consent_required','login_required'])('preserves one automatic recovery for %s', async (error) => {
    const client=auth0Client();client.getTokenSilently.mockRejectedValue({error});state.createAuth0.mockResolvedValue(client);
    const provider=new Auth0AuthenticationProvider(router);
    await provider.init();expect(client.loginWithRedirect).toHaveBeenCalledTimes(1);
    const replacement=new Auth0AuthenticationProvider(router);
    await expect(replacement.init()).rejects.toEqual({error});expect(client.loginWithRedirect).toHaveBeenCalledTimes(1);
  });
  it('removes callback code and state even when the exchange fails', async () => {
    vi.useFakeTimers();const previous=location.href;
    const client=auth0Client();client.handleRedirectCallback.mockRejectedValue(new Error('invalid state'));state.createAuth0.mockResolvedValue(client);
    history.replaceState(null,'','/graph-editor/auth-callback?code=one-use&state=bad');
    try {
      await expect(new Auth0AuthenticationProvider(router).init()).rejects.toThrow('invalid state');
      expect(location.search).toBe('');expect(useStore().status).toBe('failed');
    } finally {vi.clearAllTimers();history.replaceState(null,'',previous);}
  });
});
