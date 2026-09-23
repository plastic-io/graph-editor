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
