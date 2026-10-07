import {describe, it, expect} from 'vitest';
import {connectionUrls, codexAddCommand} from '../connection';

describe('MCP setup for the selected graph server', () => {
  it('retains API stage paths with or without a trailing slash', () => {
    for (const base of ['https://api.example/test', 'https://api.example/test/']) {
      expect(connectionUrls(base, false)).toEqual({mcp:'https://api.example/test/mcp', metadata:'https://api.example/test/.well-known/oauth-protected-resource'});
    }
    expect(connectionUrls('http://localhost:3030/', false)?.mcp).toBe('http://localhost:3030/mcp');
  });
  it('does not offer a remote connection for local storage, unsafe URLs, or credentials', () => {
    expect(connectionUrls('https://api.example/', true)).toBeNull();
    for (const base of ['', 'bad', 'javascript:alert(1)', 'http://remote.example/', 'https://user:secret@api.example/', 'https://api.example/?token=secret', 'https://api.example/#token']) {
      expect(connectionUrls(base, false)).toBeNull();
    }
  });
  it('quotes deployment paths and client IDs safely and identifies required registration', () => {
    expect(codexAddCommand('https://api.example/test/mcp', '', true)).toContain('--oauth-client-id YOUR_OAUTH_CLIENT_ID');
    expect(codexAddCommand('https://api.example/test/mcp', '', false)).not.toContain('--oauth-client-id');
    const quoted = codexAddCommand("https://api.example/a'b/mcp", "a'b", true);
    expect(quoted).toBe("codex mcp add graph-server --url 'https://api.example/a'\\''b/mcp' --oauth-client-id 'a'\\''b'");
  });
});
