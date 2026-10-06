import {resolve} from 'path';
import {validateCognito} from '../packages/AmplifyAuthenticationProvider/config';
const split = (value: string | undefined) => String(value || '').split(/[\s,]+/).filter(Boolean);

export function authBuild(env: Record<string, string | undefined> = process.env, production = false) {
  const name = env.AUTH_PROVIDER === undefined ? 'auth0' : env.AUTH_PROVIDER;
  if (name !== 'auth0' && name !== 'cognito') throw new Error('AUTH_PROVIDER must be auth0 or cognito');
  const config = name === 'auth0' ? {
    defaults: { domain: 'dev-7q-g69up.us.auth0.com', clientId: 'VCDSy72k7efF46kRfsJyizaXOl1gtUKl' },
    overrides: Object.fromEntries(Object.entries({ domain: env.AUTH0_DOMAIN, clientId: env.AUTH0_CLIENT_ID,
      audience: env.AUTH0_AUDIENCE, redirect_uri: env.AUTH0_REDIRECT_URI }).filter(([, value]) => value !== undefined)),
  } : {
    userPoolId: env.COGNITO_USER_POOL_ID || '', userPoolClientId: env.COGNITO_CLIENT_ID || '',
    domain: env.COGNITO_LOGIN_DOMAIN || '', scopes: split(env.COGNITO_SCOPES),
    redirectSignIn: env.COGNITO_REDIRECT_SIGN_IN || '', redirectSignOut: env.COGNITO_REDIRECT_SIGN_OUT || '',
    resource: env.COGNITO_RESOURCE_AUDIENCE || '',
  };
  if (production && name === 'auth0') {
    const c = {...(config as any).defaults, ...(config as any).overrides};
    if (!c.domain || !c.clientId || /[/:]/.test(c.domain)) throw new Error('Configure AUTH0_DOMAIN and AUTH0_CLIENT_ID');
  }
  if (production && name === 'cognito') validateCognito(config);
  return {
    name, config,
    alias: { '@graph/auth-provider': resolve(__dirname, '../packages', name === 'auth0' ? 'Auth0AuthenticationProvider/main.ts' : 'AmplifyAuthenticationProvider/main.ts') },
    define: { __AUTH_CONFIG__: JSON.stringify(config), __DEPLOYMENT_CONFIG__: JSON.stringify(deploymentConfig(env)) },
    plugin: {
      name: 'auth-provider-manifest',
      generateBundle(this: any, _options: any, bundle: any) {
        const modules = Object.values(bundle).flatMap((chunk: any) => Object.keys(chunk.modules || {}));
        const forbidden = name === 'auth0' ? /AmplifyAuthenticationProvider|node_modules\/(?:aws-amplify|@aws-amplify)\// : /Auth0AuthenticationProvider|node_modules\/@auth0\//;
        if (modules.some(id => forbidden.test(id))) this.error(`The ${name} build contains the other authentication provider`);
        this.emitFile({ type: 'asset', fileName: 'auth-provider.json', source: JSON.stringify({ provider: name, isolated: true }) });
      },
    },
  };
}

export {validateCognito} from '../packages/AmplifyAuthenticationProvider/config';

/** CI supplies both endpoints from the same deployed server stack. */
export function deploymentConfig(env: Record<string, string | undefined>) {
  if (!env.GRAPH_HTTP_SERVER && !env.GRAPH_WSS_SERVER) return {};
  if (!env.GRAPH_HTTP_SERVER || !env.GRAPH_WSS_SERVER) throw new Error('Configure both GRAPH_HTTP_SERVER and GRAPH_WSS_SERVER');
  const http = new URL(env.GRAPH_HTTP_SERVER);
  const ws = new URL(env.GRAPH_WSS_SERVER);
  if (http.protocol !== 'https:' || ws.protocol !== 'wss:' || [http, ws].some(url => url.username || url.password || url.search || url.hash)) {
    throw new Error('Deployment endpoints must be HTTPS/WSS URLs without credentials, queries or fragments');
  }
  return {graphHTTPServer:http.href.replace(/\/?$/, '/'), graphWSSServer:ws.href.replace(/\/$/, ''),
    authenticationRequired:true, useLocalStorage:false};
}
