import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveAudience } from "../main";

/**
 * Which API the editor asks Auth0 for a token for.
 *
 * This is the line that locked the editor out once: the server publishes a
 * resource indicator that names *itself* — an MCP client refuses one that does
 * not — and the editor asked Auth0 for a token for that URL, which is not an
 * API any tenant knows.  Auth0 answered "Service not found" and there was no
 * way in.  So the document carries both, and this is the order they are read.
 */
const prefs = (over: any = {}) => ({ graphHTTPServer: "https://api.example.com/dev", useLocalStorage: false, ...over });
const answering = (body: any, ok = true) => vi.fn(async () => ({ ok, json: async () => body })) as any;

afterEach(() => { vi.unstubAllGlobals(); });

describe("the audience the editor asks for", () => {
  it("prefers what the server says its API is, not how it addresses itself", async () => {
    vi.stubGlobal("fetch", answering({ resource: "https://api.example.com/dev/mcp", audience: "plastic-io-graph-server" }));
    expect(await resolveAudience(prefs())).toBe("plastic-io-graph-server");
  });

  it("falls back to the resource for a server that publishes no audience", async () => {
    vi.stubGlobal("fetch", answering({ resource: "https://graphs.example.com/mcp" }));
    expect(await resolveAudience(prefs())).toBe("https://graphs.example.com/mcp");
  });

  it("an explicit setting wins over anything the server says", async () => {
    const fetching = answering({ audience: "from-the-server" });
    vi.stubGlobal("fetch", fetching);
    expect(await resolveAudience(prefs({ auth0: { audience: "  mine  " } }))).toBe("mine");
    expect(fetching).not.toHaveBeenCalled();
  });

  it("a server that cannot be read leaves the URL, which is the case that failed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }) as any);
    expect(await resolveAudience(prefs())).toBe("https://api.example.com/dev");
  });

  it("a browser keeping its own graphs needs no audience at all", async () => {
    const fetching = answering({ audience: "unused" });
    vi.stubGlobal("fetch", fetching);
    expect(await resolveAudience(prefs({ useLocalStorage: true }))).toBe("");
    expect(fetching).not.toHaveBeenCalled();
  });
});

describe("where Auth0 comes back to", () => {
  /**
   * This locked everyone out of the deployed editor: the address was built
   * with a hardcoded `http://`, so the site served over https asked to be
   * returned to `http://plastic-io.github.io/...`, and Auth0 refused the whole
   * authorize request — "does not have a registered origin" — before a login
   * screen could appear.  On localhost it had always worked, which is why it
   * survived.
   */
  it("comes back on the scheme the page is served on", async () => {
    const { redirectUriFor } = await import("../main");
    expect(redirectUriFor({ protocol: "https:", host: "plastic-io.github.io" }))
      .toBe("https://plastic-io.github.io/graph-editor/auth-callback");
    expect(redirectUriFor({ protocol: "http:", host: "localhost:8080" }))
      .toBe("http://localhost:8080/graph-editor/auth-callback");
  });

  it("anything that is not http or https is treated as https", async () => {
    const { redirectUriFor } = await import("../main");
    expect(redirectUriFor({ protocol: "file:", host: "plastic-io.github.io" }))
      .toBe("https://plastic-io.github.io/graph-editor/auth-callback");
    expect(redirectUriFor({ host: "plastic-io.github.io" } as any))
      .toBe("https://plastic-io.github.io/graph-editor/auth-callback");
  });
});
