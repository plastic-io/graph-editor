export function validateCognito(config: any) {
  if (!/^[a-z0-9-]+_[A-Za-z0-9]+$/.test(config.userPoolId || '') || !config.userPoolClientId) throw new Error('Configure COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID');
  if (!config.domain || /[/:]/.test(config.domain)) throw new Error('COGNITO_LOGIN_DOMAIN must be a hostname');
  if (!config.scopes.includes('openid') || !config.scopes.some((s: string) => s.includes('/'))) throw new Error('COGNITO_SCOPES must include openid and a graph API resource-server scope');
  for (const key of ['redirectSignIn', 'redirectSignOut']) {
    let url: URL;
    try { url = new URL(config[key]); } catch { throw new Error(`Configure Cognito ${key}`); }
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Cognito redirects must use HTTPS or local HTTP');
    if (url.hash || url.username || url.password) throw new Error('Invalid Cognito redirect URL');
  }
  if (config.resource && !/^https:\/\//.test(config.resource)) throw new Error('COGNITO_RESOURCE_AUDIENCE must be an HTTPS URL');
}
