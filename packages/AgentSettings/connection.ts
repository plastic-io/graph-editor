/** Preserve a deployment's API stage when locating its MCP and discovery routes. */
export function connectionUrls(server: string, localStorage: boolean) {
  if (localStorage || !server) return null;
  try {
    const base = new URL(server);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
    if (base.protocol !== 'https:' && !(base.protocol === 'http:' && loopback)) return null;
    if (base.username || base.password || base.search || base.hash) return null;
    base.pathname = base.pathname.replace(/\/?$/, '/');
    return {mcp: new URL('mcp', base).href, metadata: new URL('.well-known/oauth-protected-resource', base).href};
  } catch { return null; }
}

const shellQuote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'";
export function codexAddCommand(url: string, clientId: string, requiresClient: boolean) {
  return `codex mcp add graph-server --url ${shellQuote(url)}`
    + (clientId.trim() ? ` --oauth-client-id ${shellQuote(clientId.trim())}`
      : requiresClient ? ' --oauth-client-id YOUR_OAUTH_CLIENT_ID' : '');
}
