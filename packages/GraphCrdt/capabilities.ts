/**
 * Capabilities (plan §4.5.2): what a node may do beyond its edges.
 *
 * A definition declares requirements (the component manifest), an instance
 * carries the grant the graph owner gave it (`properties.capabilities`), and
 * the executing principal must hold it too.  Effective = the intersection;
 * nesting can only narrow.  Scopes are patterns: hostnames (`api.example.com`,
 * `*.example.com`, `*`), key prefixes (`ratelimit/*`), secret refs (`openai`).
 */
export type CapabilityKind = "net:https" | "storage:kv" | "storage:s3" | "secret" | "timer" | "browser:dom" | "browser:storage" | "aws:cfn" | "aws:codebuild" | "llm" | "graph:invoke";

export interface CapabilityRequirement {
    kind: CapabilityKind | string;
    scope: string[];
    optional?: boolean;
}

export const CAPABILITY_KINDS: string[] = ["net:https", "storage:kv", "storage:s3", "secret", "timer", "browser:dom", "browser:storage", "aws:cfn", "aws:codebuild", "llm", "graph:invoke"];

/** Kinds whose use is audited, not only observed. */
export const PRIVILEGED_KINDS = ["secret", "storage:s3", "aws:cfn", "aws:codebuild"];

/** `"net:https:api.example.com"`, `"storage:kv:ratelimit/*"`, `{kind, scope}` → a requirement. */
export function parseCapability(c: any): CapabilityRequirement | null {
    if (!c) return null;
    if (typeof c === "object") {
        const kind = String(c.kind || c.name || "");
        if (!kind) return null;
        return { kind, scope: Array.isArray(c.scope) ? c.scope.map(String) : [], optional: !!c.optional };
    }
    if (typeof c !== "string") return null;
    const kind = CAPABILITY_KINDS.find((k) => c === k || c.startsWith(k + ":"));
    if (!kind) return null;
    const rest = c.slice(kind.length + 1);
    return { kind, scope: rest ? rest.split(",").map((s) => s.trim()).filter(Boolean) : [] };
}

export function parseCapabilities(list: any): CapabilityRequirement[] {
    return (Array.isArray(list) ? list : []).map(parseCapability).filter((c): c is CapabilityRequirement => !!c);
}

/** Does a scope pattern cover a value?  `*` covers everything, `*.x` a suffix, `p/*` a prefix, else exact. */
export function scopeMatches(pattern: string, value: string): boolean {
    if (pattern === "*") return true;
    if (pattern.startsWith("*.")) return value === pattern.slice(2) || value.endsWith(pattern.slice(1));
    if (pattern.endsWith("/*")) return value.startsWith(pattern.slice(0, -1)) || value === pattern.slice(0, -2);
    if (pattern.endsWith("*")) return value.startsWith(pattern.slice(0, -1));
    return value === pattern;
}

/** One layer's answer for an operation: is there a matching grant of this kind? */
function layerAllows(layer: CapabilityRequirement[] | null, kind: string, value: string): boolean {
    if (layer === null) return true;   // no restriction at this layer
    return layer.some((c) => c.kind === kind && (c.scope.length === 0 ? false : c.scope.some((p) => scopeMatches(p, value))));
}

export class CapabilityDenied extends Error {
    kind: string;
    scope: string;
    layer: string;
    constructor(kind: string, scope: string, layer: string) {
        super(`capability ${kind} for ${scope} is not granted (${layer})`);
        this.name = "CapabilityDenied";
        this.kind = kind;
        this.scope = scope;
        this.layer = layer;
        Object.setPrototypeOf(this, CapabilityDenied.prototype);
    }
}

/**
 * The layers that apply to one node invocation.  `null` means the layer does
 * not restrict (an owner principal, or a node with no manifest).
 */
export interface EffectiveCapabilities {
    instance: CapabilityRequirement[];
    manifest: CapabilityRequirement[] | null;
    principal: CapabilityRequirement[] | null;
}

export function effectiveCapabilities(node: any, manifestCapabilities: any[] | null, principalCapabilities: any[] | null): EffectiveCapabilities {
    return {
        instance: parseCapabilities(node && node.properties && node.properties.capabilities),
        manifest: manifestCapabilities === null ? null : parseCapabilities(manifestCapabilities),
        principal: principalCapabilities === null ? null : parseCapabilities(principalCapabilities),
    };
}

/** Check an operation against every layer; throws CapabilityDenied naming the first layer that refuses. */
export function assertCapability(effective: EffectiveCapabilities, kind: string, value: string): void {
    if (!layerAllows(effective.instance, kind, value)) throw new CapabilityDenied(kind, value, "instance");
    if (!layerAllows(effective.manifest, kind, value)) throw new CapabilityDenied(kind, value, "manifest");
    if (!layerAllows(effective.principal, kind, value)) throw new CapabilityDenied(kind, value, "principal");
}
