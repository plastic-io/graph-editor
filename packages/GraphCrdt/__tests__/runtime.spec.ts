import { describe, it, expect, vi } from "vitest";
import { parseCapability, scopeMatches, effectiveCapabilities, assertCapability, CapabilityDenied } from "../capabilities";
import { assignable, schemaConflict } from "../contracts";
import { ObservationRecorder, capturePayload, fingerprint } from "../observe";
import { buildHostMembers, EffectUnavailable } from "../host";
import { monotonicUlid } from "../ulid";

const owner = { sub: "auth0|u1", kind: "human", tenant: "personal:auth0|u1" };
const recorderFor = (over: any = {}) => new ObservationRecorder({ graphId: "g1", revisionId: "live", executionId: "01M32AAAAAAAAAAAAAAAAAAAAA", owner, domain: "browser", ...over });

describe("capabilities", () => {
  it("reads both spellings and matches hosts and key prefixes", () => {
    expect(parseCapability("net:https:api.example.com,*.cdn.example.com")).toEqual({ kind: "net:https", scope: ["api.example.com", "*.cdn.example.com"] });
    expect(parseCapability({ kind: "storage:kv", scope: ["ratelimit/*"] })).toEqual({ kind: "storage:kv", scope: ["ratelimit/*"], optional: false });
    expect(parseCapability("make-me-a-sandwich")).toBeNull();
    expect(scopeMatches("*.example.com", "api.example.com")).toBe(true);
    expect(scopeMatches("*.example.com", "api.example.com.evil.net")).toBe(false);
    expect(scopeMatches("ratelimit/*", "ratelimit/u1")).toBe(true);
    expect(scopeMatches("ratelimit/*", "billing/u1")).toBe(false);
  });

  it("narrows through the layers and names the one that refused", () => {
    const node = { properties: { capabilities: ["net:https:api.example.com", "storage:kv:demo/*"] } };
    expect(() => assertCapability(effectiveCapabilities(node, null, null), "net:https", "api.example.com")).not.toThrow();
    try {
      assertCapability(effectiveCapabilities(node, null, null), "net:https", "evil.example");
      throw new Error("should have refused");
    } catch (err: any) {
      expect(err).toBeInstanceOf(CapabilityDenied);
      expect(err.layer).toBe("instance");
    }
    expect(() => assertCapability(effectiveCapabilities(node, ["storage:kv:demo/*"], null), "net:https", "api.example.com")).toThrow(/manifest/);
    expect(() => assertCapability(effectiveCapabilities(node, null, ["storage:kv:*"]), "net:https", "api.example.com")).toThrow(/principal/);
  });
});

describe("port contracts", () => {
  it("answers what may be connected, and what will disagree once values flow", () => {
    expect(assignable({ type: "String" }, { type: "String" })).toBe(true);
    expect(assignable({ type: "String" }, { type: "Number" })).toBe(false);
    expect(assignable({ type: "String" }, { type: "Object" })).toBe(true);
    expect(assignable(undefined, { type: "Number" })).toBe(true);
    expect(schemaConflict({ type: "Object" }, { type: "Object" })).toBeNull();
    expect(schemaConflict({ type: "Object", schema: { type: "string" } }, { type: "Object", schema: { type: "number" } })).toMatch(/produces string/);
    expect(schemaConflict({ type: "Number" }, { type: "Object", schema: { type: "number" } })).toBeNull();
    expect(schemaConflict({ type: "Object", schema: { type: "object", properties: { a: {} }, additionalProperties: false } }, { type: "Object", schema: { type: "object", required: ["a", "b"] } })).toMatch(/requires b/);
  });
});

describe("the observation recorder", () => {
  it("captures what each port asks for and fingerprints the rest", () => {
    expect(capturePayload("hello", undefined)).toEqual({ meta: { type: "string", bytes: 7, hash: expect.any(String) } });
    expect(capturePayload("hello", { capture: "full" })).toEqual({ value: "hello", meta: expect.any(Object) });
    expect(capturePayload("hello", { redaction: "secret", capture: "full" })).toEqual({ redacted: "secret" });
    expect(capturePayload("hello", { capture: "none" })).toBeUndefined();
    expect(capturePayload({ a: "x".repeat(9000) }, { capture: "full" })).toMatchObject({ redacted: "size" });
    expect(fingerprint("hello")).toBe(fingerprint("hello"));
    expect(fingerprint("hello")).not.toBe(fingerprint("hellp"));
    expect(fingerprint("hello")).toHaveLength(32);
  });

  it("turns scheduler events into an ordered stream that names the browser as its domain", () => {
    const live: any[] = [];
    const recorder = recorderFor({ live: (o: any) => live.push(o.kind) });
    recorder.learn({ nodes: [{ id: "a", properties: { inputs: [{ name: "in", capture: "full" }], outputs: [{ name: "out" }] } }] });
    recorder.handle("begin", { executionId: "01M32AAAAAAAAAAAAAAAAAAAAA", url: "a" });
    recorder.handle("beginedge", { nodeId: "a", field: "in", value: "typed" });
    recorder.handle("observation", { nodeId: "a", kind: "note", data: { n: 1 } });
    recorder.handle("error", { nodeId: "a", message: "boom", code: "NODE_ERROR" });
    recorder.handle("end", { state: "completed", hops: 1, errors: 1, duration: 12 });
    expect(recorder.buffer.map((o) => o.kind)).toEqual(["exec.begin", "edge.input", "custom", "exec.error", "exec.end"]);
    expect(recorder.buffer.map((o) => o.seq)).toEqual([1, 2, 3, 4, 5]);
    expect(recorder.buffer.every((o) => o.domain === "browser" && o.owner === owner && o.graphId === "g1")).toBe(true);
    expect(recorder.buffer[1].payload).toEqual({ value: "typed", meta: expect.any(Object) });
    expect(recorder.buffer[3].payload).toEqual({ message: "boom", code: "NODE_ERROR" });
    expect(live).toEqual(["exec.begin", "edge.input", "custom", "exec.error", "exec.end"]);
    expect(recorder.summary()).toMatchObject({ count: 5, capped: false, sampled: false });
    expect(recorder.ndjson().trim().split("\n")).toHaveLength(5);
    const ids = recorder.buffer.map((o) => o.id);
    expect([...ids].sort()).toEqual(ids);
  });

  it("ignores events from another execution and caps its own volume", () => {
    const recorder = recorderFor({ maxObservations: 5 });
    const listeners: Record<string, any[]> = {};
    const scheduler = { addEventListener: (name: string, fn: any) => { (listeners[name] = listeners[name] || []).push(fn); } };
    recorder.attach(scheduler);
    const fire = (name: string, e: any) => (listeners[name] || []).forEach((fn) => fn(e));
    fire("beginedge", { executionId: "01M32ZZZZZZZZZZZZZZZZZZZZZ", nodeId: "other", field: "in", value: 1 });
    expect(recorder.buffer).toHaveLength(0);
    for (let i = 0; i < 40; i++) {
      fire("beginedge", { executionId: "01M32AAAAAAAAAAAAAAAAAAAAA", nodeId: "a", field: "in", value: i });
    }
    const summary = recorder.summary();
    expect(summary.capped).toBe(true);
    expect(recorder.buffer.filter((o) => o.kind === "budget.exhausted")).toHaveLength(1);
    expect(recorder.buffer.filter((o) => o.sampled).length).toBeGreaterThan(0);
    expect(summary.count).toBeLessThan(40);
  });
});

describe("the browser host", () => {
  const hostFor = (capabilities: string[], deps: any = {}) => {
    const recorder = recorderFor();
    const node = { id: "a", properties: { capabilities } };
    const host = buildHostMembers({ graphId: "g1", node, effective: effectiveCapabilities(node, null, null), recorder, principal: owner }, { domain: "browser", ...deps });
    return { host, recorder };
  };

  it("allows a fetch in scope, refuses one out of scope and refuses plain http", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true })) as any;
    const { host, recorder } = hostFor(["net:https:api.example.com"], { fetchImpl });
    await host.fetch("https://api.example.com/v1");
    await expect(host.fetch("https://evil.example/")).rejects.toThrow(/not granted \(instance\)/);
    await expect(host.fetch("http://api.example.com/")).rejects.toBeInstanceOf(CapabilityDenied);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe("https://api.example.com/v1");
    expect(recorder.buffer.map((o) => [o.kind, o.capability!.decision, o.capability!.scope[0]])).toEqual([
      ["effect", "allowed", "api.example.com"],
      ["effect.denied", "denied", "evil.example"],
    ]);
    expect(recorder.summary().effects).toEqual({ allowed: 1, denied: 1 });
  });

  it("says plainly that a secret or the shared store is not the browser's to give", async () => {
    const { host, recorder } = hostFor(["secret:openai", "storage:kv:demo/*"]);
    await expect(host.secret("openai").header()).rejects.toBeInstanceOf(EffectUnavailable);
    await expect(host.kv.get("demo/x")).rejects.toThrow(/place this node on the server/);
    await expect(host.kv.get("other/x")).rejects.toBeInstanceOf(CapabilityDenied);
    expect(recorder.buffer.map((o) => o.kind)).toEqual(["effect", "effect", "effect.denied"]);
    expect(host.capabilities.domain).toBe("browser");
  });
});

describe("monotonic ids", () => {
  it("increase within the same millisecond so events stay in order", () => {
    const next = monotonicUlid();
    const ids = Array.from({ length: 50 }, () => next(1790000000000));
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(50);
    expect(ids[0]).toHaveLength(26);
  });
});

describe("placement", () => {
  it("reads what a node says, and what its needs imply when it says nothing", async () => {
    const { placementOf, runsHere, deliveryTarget, wireValue, deliveryKey } = await import("../placement");
    expect(placementOf({ properties: { placement: "browser" } })).toBe("browser");
    expect(placementOf({ properties: {} })).toBe("portable");
    expect(placementOf({ properties: { capabilities: ["secret:openai"] } })).toBe("server");
    expect(placementOf({ properties: { capabilities: ["storage:kv:x/*"] } })).toBe("server");
    expect(placementOf({ properties: { capabilities: ["browser:dom"] } })).toBe("browser");
    expect(placementOf({ properties: { capabilities: ["net:https:api.example.com"] } })).toBe("portable");
    // what a node says wins over what its capabilities imply
    expect(placementOf({ properties: { placement: "browser", capabilities: ["secret:openai"] } })).toBe("browser");
    expect(runsHere({ properties: { placement: "server" } }, "browser")).toBe(false);
    expect(runsHere({ properties: { placement: "portable" } }, "browser")).toBe(true);
    expect(runsHere({ properties: {} }, "server")).toBe(true);
    // a node that only draws is rendered by every viewer; one with an effect happens once
    expect(deliveryTarget({ properties: { capabilities: ["browser:dom"] } })).toBe("all-viewers");
    expect(deliveryTarget({ properties: { capabilities: ["browser:dom", "net:https:api.example.com"] } })).toBe("initiator");
    expect(deliveryTarget({ properties: { deliveryTarget: "initiator" } })).toBe("initiator");
    expect(deliveryKey({ executionId: "e", connectorId: "c1", nodeId: "n", seq: 3 })).toBe("c1-3");
    expect(deliveryKey({ executionId: "e", nodeId: "n", seq: 3 })).toBe("n-3");
  });

  it("refuses to send what cannot cross a boundary", async () => {
    const { wireValue } = await import("../placement");
    expect(wireValue({ a: 1 })).toEqual({ ok: true, value: { a: 1 }, bytes: 7 });
    expect(wireValue(undefined)).toEqual({ ok: true, value: null, bytes: 4 });
    expect(wireValue(() => 1)).toMatchObject({ ok: false });
    const cyclic: any = {}; cyclic.self = cyclic;
    expect(wireValue(cyclic)).toMatchObject({ ok: false, reason: expect.stringMatching(/cannot cross/) });
    expect(wireValue("x".repeat(100), 50)).toMatchObject({ ok: false, reason: expect.stringMatching(/more than the 50/) });
  });
});

describe("reaching CloudFormation", () => {
  /**
   * D-41: there is no builtin node kind.  What stands between a node and
   * CloudFormation is the `aws:cfn` capability, checked in the same three
   * layers as every other effect and audited like the other privileged ones.
   */
  const deployNode = (capabilities: string[]) => ({ id: "stack", properties: { capabilities } });
  const hostFor = (capabilities: string[], deps: any = {}) => {
    const recorder = recorderFor({ domain: "server" });
    const node = deployNode(capabilities);
    const host = buildHostMembers({ graphId: "infra", node, effective: effectiveCapabilities(node, null, null), recorder, principal: owner }, { domain: "server", ...deps });
    return { host, recorder };
  };
  const desired = (name = "pio-dev-uploads") => ({ stack: { name, account: "695527765921", region: "us-west-1", environment: "dev" }, operation: "plan" });

  it("a grant over a prefix is a grant over those stacks and no others", async () => {
    const deploy = vi.fn(async (_request: any) => ({ state: "planned" }));
    const { host, recorder } = hostFor(["aws:cfn:pio-dev-*"], { deploy });
    await host.deploy(desired());
    await expect(host.deploy(desired("prod-database"))).rejects.toThrow(/aws:cfn for prod-database is not granted \(instance\)/);
    expect(deploy).toHaveBeenCalledTimes(1);
    expect(deploy.mock.calls[0][0]).toMatchObject({ graphId: "infra", nodeId: "stack" });
    // the refusal is recorded, not only thrown
    expect(recorder.buffer.map((o) => [o.kind, o.capability!.decision])).toEqual([["effect", "allowed"], ["effect.denied", "denied"]]);
  });

  it("a node with no grant cannot reach it at all", async () => {
    const deploy = vi.fn(async () => ({}));
    const { host } = hostFor([], { deploy });
    await expect(host.deploy(desired())).rejects.toBeInstanceOf(CapabilityDenied);
    expect(deploy).not.toHaveBeenCalled();
  });

  it("a privileged effect is audited, allowed or refused", async () => {
    const audit = vi.fn(async () => undefined);
    const { host } = hostFor(["aws:cfn:pio-dev-*"], { deploy: async () => ({}), audit });
    await host.deploy(desired());
    await expect(host.deploy(desired("somebody-elses"))).rejects.toThrow();
    expect(audit.mock.calls.map((c: any[]) => c[0].kind)).toEqual(["effect", "effect.denied"]);
  });

  it("where the effect cannot happen, the answer points at placement rather than a missing global", async () => {
    const { host } = hostFor(["aws:cfn:pio-dev-*"], { domain: "browser" });
    await expect(host.deploy(desired())).rejects.toBeInstanceOf(EffectUnavailable);
    await expect(host.deploy(desired())).rejects.toThrow(/place this node on the server/);
  });
});
