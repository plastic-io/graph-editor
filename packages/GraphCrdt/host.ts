/**
 * The `host` binding (plan §4.5.2, PB-051, PB-052): the only way node code
 * reaches the outside world.  Every call is checked against the effective
 * capabilities and observed; refused calls are observed too and, for
 * privileged kinds, audited.
 *
 * One implementation serves both domains.  What differs between them is what
 * can be supplied: the server hands in a fetch, a key-value store, a secret
 * resolver and the audit chain, while the browser hands in only a fetch.  A
 * member whose dependency is missing still performs its capability check, then
 * says plainly that this domain cannot carry the effect, so a node that needs
 * a secret reads the same way in both places and the answer points at
 * placement rather than at a missing global.
 */
import { assertCapability, CapabilityDenied, PRIVILEGED_KINDS } from "./capabilities";
import type { EffectiveCapabilities } from "./capabilities";
import { ObservationRecorder, byteLength } from "./observe";

export interface HostDeps {
    fetchImpl?: typeof fetch;
    /** Resolve a secret reference (`openai`) to its value; only refs in scope reach it. */
    secrets?: (ref: string) => Promise<string>;
    kv?: { get(key: string): Promise<any>; put(key: string, value: any): Promise<void>; del(key: string): Promise<void> };
    /**
     * Ask for a stack to be brought to a desired state (plan §4.9, D-41).  The
     * server hands in its IaC service; the browser hands in nothing, so a node
     * placed there is told that the effect does not run here rather than that
     * some global is missing.
     */
    deploy?: (request: any) => Promise<any>;
    audit?: (record: any) => Promise<void>;
    /** Clients a secret can be exchanged for, so the value itself never enters node scope. */
    clients?: { openai?: (apiKey: string, options: any) => any };
    /** Named for the error a node sees when an effect cannot happen here. */
    domain?: "browser" | "server";
    /**
     * What the node believes the time is.  A test that says "five in a window,
     * then refused" cannot wait out a real window, so it runs against a clock
     * it controls; everything else gets the real one.
     */
    now?: () => number;
}

export interface HostContext {
    graphId: string;
    node: any;
    spanId?: string;
    signal?: AbortSignal;
    effective: EffectiveCapabilities;
    recorder: ObservationRecorder;
    principal: { sub: string; kind: string; tenant: string } | null;
}

export class EffectUnavailable extends Error {
    kind: string;
    domain: string;
    constructor(kind: string, domain: string) {
        super(`${kind} effects do not run in the ${domain}; place this node on the server`);
        this.name = "EffectUnavailable";
        this.kind = kind;
        this.domain = domain;
        Object.setPrototypeOf(this, EffectUnavailable.prototype);
    }
}

export function buildHostMembers(ctx: HostContext, deps: HostDeps): Record<string, any> {
    const nodeId = ctx.node && ctx.node.id;
    const domain = deps.domain || "server";
    const guard = async (kind: string, scope: string, extra: any = {}) => {
        try {
            assertCapability(ctx.effective, kind, scope);
        } catch (err) {
            if (err instanceof CapabilityDenied) {
                ctx.recorder.effect("denied", kind, scope, nodeId, ctx.spanId, { reason: err.message }, err.layer);
                if (deps.audit && PRIVILEGED_KINDS.includes(kind)) {
                    await deps.audit({ kind: "effect.denied", at: new Date().toISOString(), graphId: ctx.graphId, nodeId, executionId: ctx.recorder.options.executionId, capability: { kind, scope: [scope] }, principal: ctx.principal, layer: err.layer });
                }
            }
            throw err;
        }
        ctx.recorder.effect("allowed", kind, scope, nodeId, ctx.spanId, extra);
        if (deps.audit && PRIVILEGED_KINDS.includes(kind)) {
            await deps.audit({ kind: "effect", at: new Date().toISOString(), graphId: ctx.graphId, nodeId, executionId: ctx.recorder.options.executionId, capability: { kind, scope: [scope] }, principal: ctx.principal });
        }
    };
    const fetchImpl = deps.fetchImpl || (typeof fetch === "function" ? fetch : undefined);
    return {
        /** HTTPS only, to hosts in the `net:https` scope. */
        async fetch(url: string, init: any = {}) {
            const parsed = new URL(String(url));
            if (parsed.protocol !== "https:") {
                throw new CapabilityDenied("net:https", parsed.hostname, "protocol");
            }
            await guard("net:https", parsed.hostname, { method: (init && init.method) || "GET" });
            if (!fetchImpl) throw new EffectUnavailable("net:https", domain);
            return fetchImpl(parsed.href, { ...init, signal: init.signal || ctx.signal });
        },
        /** A small key-value store scoped by `storage:kv` prefixes, kept per graph. */
        kv: {
            async get(key: string) { await guard("storage:kv", String(key)); if (!deps.kv) throw new EffectUnavailable("storage:kv", domain); return deps.kv.get(`${ctx.graphId}/${key}`); },
            async put(key: string, value: any) { await guard("storage:kv", String(key), { bytes: byteLength(JSON.stringify(value === undefined ? null : value)) }); if (!deps.kv) throw new EffectUnavailable("storage:kv", domain); await deps.kv.put(`${ctx.graphId}/${key}`, value); },
            async del(key: string) { await guard("storage:kv", String(key)); if (!deps.kv) throw new EffectUnavailable("storage:kv", domain); await deps.kv.del(`${ctx.graphId}/${key}`); },
        },
        /** A secret reference resolves to a client, never to the value. */
        secret(ref: string) {
            const name = String(ref);
            return {
                async openai(options: any = {}) {
                    await guard("secret", name, { client: "openai" });
                    if (!deps.secrets || !deps.clients || !deps.clients.openai) throw new EffectUnavailable("secret", domain);
                    const apiKey = await deps.secrets(name);
                    return deps.clients.openai(apiKey, options);
                },
                async header(headerName = "Authorization", prefix = "Bearer ") {
                    await guard("secret", name, { client: "header" });
                    if (!deps.secrets) throw new EffectUnavailable("secret", domain);
                    const value = await deps.secrets(name);
                    // a header object the node can spread into a host.fetch call; the value never enters node scope directly
                    return { [headerName]: prefix + value };
                },
            };
        },
        /**
         * CloudFormation, for a node the graph owner granted `aws:cfn` on this
         * stack (D-41: there is no builtin node kind; what stands between a
         * node and CloudFormation is the capability, checked in the same three
         * layers as every other effect, and `aws:cfn` is audited).
         *
         * The scope checked is the **stack name**, so a grant of
         * `aws:cfn:pio-dev-*` is a grant over those stacks and no others.
         * What the node asks for is a desired state; who asked, at which
         * revision, and whether that was approved are decided by the server,
         * which is why they are not parameters here.
         */
        async deploy(desired: any) {
            const stack = (desired && desired.stack && desired.stack.name) || "";
            await guard("aws:cfn", String(stack), { operation: (desired && desired.operation) || "plan" });
            if (!deps.deploy) {
                throw new EffectUnavailable("aws:cfn", domain);
            }
            return deps.deploy({ desired, graphId: ctx.graphId, nodeId, spanId: ctx.spanId, principal: ctx.principal });
        },
        /** The time, which a test may hold still. */
        now: deps.now || (() => Date.now()),
        /** What this invocation may do, for nodes that adapt. */
        capabilities: {
            instance: ctx.effective.instance,
            manifest: ctx.effective.manifest,
            domain,
        },
    };
}
