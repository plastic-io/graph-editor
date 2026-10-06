/** Authenticated transport settings are independent of a concrete identity SDK. */
export function authRequiredFor(prefs: any): boolean {
  if (!prefs || prefs.useLocalStorage) return false;
  // Keep the legacy explicit-audience behavior while accepting a neutral setting.
  return prefs.authenticationRequired === true || !!prefs.auth0?.audience
    || /^https:\/\//i.test(String(prefs.graphHTTPServer || ''));
}

export function isServerUrl(url: string, server: string): boolean {
  if (!server) return false;
  try {
    const base = new URL(server);
    const target = new URL(url, typeof location === 'undefined' ? undefined : location.href);
    const path = base.pathname.replace(/\/+$/, '');
    return !target.username && !target.password && target.origin === base.origin
      && (target.pathname === path || target.pathname.startsWith(path + '/'));
  } catch { return false; }
}

/** Decoding is only for scheduling refresh. The server verifies the token. */
export function tokenExpiresAt(token: string): number | undefined {
  try {
    const value = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp;
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  } catch { return undefined; }
}
