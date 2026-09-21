/**
 * Observations (plan §4.5.3): what one execution did, as a stream every
 * replica can read.  The recorder listens to scheduler 2.1 events and to the
 * capability host, keeps an ordered buffer per execution, applies capture and
 * redaction per port, caps volume, and hands the buffer to whichever sink the
 * domain has: S3 on the server, a message to the editor in the browser.
 *
 * The same recorder runs in both domains so that an observation means the
 * same thing wherever it was made, which is what lets one query answer for a
 * graph that runs partly in a browser and partly on the server.
 */
import { monotonicUlid } from "./ulid";

const ulid = monotonicUlid();

export type ObservationKind = "edge.input" | "edge.output" | "route" | "exec.begin" | "exec.end" | "exec.error" | "effect" | "effect.denied"
    | "budget.exhausted" | "contract.violation" | "component.unresolved" | "deploy.status" | "test.result" | "summary.generated" | "custom" | "gap";

export type ObservationDomain = "browser" | "server";

export interface Observation {
    id: string;
    seq: number;
    at: string;
    kind: ObservationKind;
    graphId: string;
    revisionId: string;
    instancePath: string[];
    nodeId?: string;
    edgeField?: string;
    connectorId?: string;
    executionId: string;
    spanId?: string;
    parentSpanId?: string;
    correlationId: string;
    causationId?: string;
    domain: ObservationDomain;
    owner: { sub: string; kind: string; tenant: string };
    actor?: { sub: string; kind: string; tenant: string };
    payload?: any;
    capability?: { kind: string; scope: string[]; decision: "allowed" | "denied"; layer?: string };
    budget?: { dimension: string; used: number; limit: number };
    sampled?: boolean;
}

export interface ExecutionRecord {
    executionId: string;
    graphId: string;
    revisionId: string;
    owner: Observation["owner"];
    domain: ObservationDomain;
    entry: { nodeUrl: string; field?: string };
    startedAt: string;
    endedAt: string;
    state: string;
    reason?: string;
    duration: number;
    hops: number;
    errors: number;
    observations: { count: number; key: string; sampled: boolean; capped: boolean };
    effects: { allowed: number; denied: number };
    budget?: any;
    correlationId: string;
    receivedAt?: string;
}

export interface RecorderOptions {
    graphId: string;
    revisionId: string;
    executionId: string;
    correlationId?: string;
    owner: Observation["owner"];
    domain?: ObservationDomain;
    instancePath?: string[];
    maxObservations?: number;
    maxBytes?: number;
    /** Ports may declare `capture: none|meta|full` and `redaction: none|hash|secret`; the graph's default capture applies otherwise. */
    defaultCapture?: "none" | "meta" | "full";
    /** Live delivery of each observation (errors and effects always; routes only until the cap). */
    live?: (observation: Observation) => void;
    now?: () => number;
}

const FULL_PAYLOAD_LIMIT = 8192;
const encoder = typeof TextEncoder === "function" ? new TextEncoder() : null;

/** UTF-8 byte length without Node's Buffer, so the module runs in a worker too. */
export function byteLength(text: string): number {
    if (encoder) {
        return encoder.encode(text).length;
    }
    return unescape(encodeURIComponent(text)).length;
}

/**
 * A fast, stable fingerprint of a payload (FNV-1a, 128 bits as 32 hex chars).
 * It exists to recognise equal payloads across hops and domains and to stand
 * in for a value that must not be stored; it is deliberately not the
 * cryptographic digest used for revisions and components.
 */
export function fingerprint(text: string): string {
    let h1 = 0x811c9dc5, h2 = 0x01000193, h3 = 0x811c9dc5, h4 = 0x01000193;
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 0x01000193);
        h2 = Math.imul(h2 ^ (c + i), 0x01000193);
        h3 = Math.imul(h3 ^ (c * 31 + 7), 0x01000193);
        h4 = Math.imul(h4 ^ (c ^ (i * 131)), 0x01000193);
    }
    const hex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
    return hex(h1) + hex(h2) + hex(h3) + hex(h4);
}

export function describeValue(value: any): { type: string; bytes: number; hash: string } {
    let text: string;
    try { text = JSON.stringify(value === undefined ? null : value) || "null"; } catch (err) { text = String(value); }
    return { type: value === null ? "null" : Array.isArray(value) ? "array" : typeof value, bytes: byteLength(text), hash: fingerprint(text) };
}

/** Apply a port's capture and redaction rules to a value. */
export function capturePayload(value: any, port: any, defaultCapture: "none" | "meta" | "full" = "meta"): any {
    const redaction = port && port.redaction;
    const capture = (port && port.capture) || defaultCapture;
    if (redaction === "secret") return { redacted: "secret" };
    const meta = describeValue(value);
    if (redaction === "hash") return { redacted: "hash", hash: meta.hash, bytes: meta.bytes };
    if (capture === "none") return undefined;
    if (capture === "full") {
        if (meta.bytes > FULL_PAYLOAD_LIMIT) return { redacted: "size", bytes: meta.bytes, hash: meta.hash, meta };
        return { value, meta };
    }
    return { meta };
}

export class ObservationRecorder {
    readonly options: RecorderOptions;
    readonly buffer: Observation[] = [];
    private seq = 0;
    private bytes = 0;
    private capped = false;
    private sampled = false;
    private routeCounter = 0;
    effects = { allowed: 0, denied: 0 };
    private ports = new Map<string, any>();

    constructor(options: RecorderOptions) {
        this.options = { maxObservations: 5000, maxBytes: 2 * 1024 * 1024, defaultCapture: "meta", domain: "server", ...options };
    }

    /** Learn the ports of a graph so capture and redaction can follow their declarations. */
    learn(graph: any) {
        (graph && graph.nodes ? graph.nodes : []).forEach((n: any) => {
            ((n.properties && n.properties.inputs) || []).forEach((p: any) => this.ports.set(`${n.id}:in:${p.name}`, p));
            ((n.properties && n.properties.outputs) || []).forEach((p: any) => this.ports.set(`${n.id}:out:${p.name}`, p));
        });
    }

    private port(nodeId: string | undefined, direction: "in" | "out", field: string | undefined) {
        return nodeId && field ? this.ports.get(`${nodeId}:${direction}:${field}`) : undefined;
    }

    /** Add an observation; returns it, or null when the cap dropped it. */
    record(partial: Omit<Observation, "id" | "seq" | "at" | "graphId" | "revisionId" | "executionId" | "correlationId" | "domain" | "owner" | "instancePath"> & Partial<Pick<Observation, "instancePath">>): Observation | null {
        const always = partial.kind === "exec.error" || partial.kind === "effect" || partial.kind === "effect.denied" || partial.kind === "exec.end" || partial.kind === "exec.begin" || partial.kind === "budget.exhausted" || partial.kind === "contract.violation";
        if (this.capped && !always) {
            if (partial.kind === "route" || partial.kind === "edge.input") {
                this.routeCounter += 1;
                if (this.routeCounter % 10 !== 0) return null;   // sample one in ten once capped
                partial = { ...partial, sampled: true } as any;
            } else {
                return null;
            }
        }
        this.seq += 1;
        const observation: Observation = {
            id: ulid(),
            seq: this.seq,
            at: new Date((this.options.now || Date.now)()).toISOString(),
            graphId: this.options.graphId,
            revisionId: this.options.revisionId,
            executionId: this.options.executionId,
            correlationId: this.options.correlationId || this.options.executionId,
            domain: this.options.domain as ObservationDomain,
            owner: this.options.owner,
            instancePath: partial.instancePath || this.options.instancePath || [],
            ...(partial as any),
        };
        const size = byteLength(JSON.stringify(observation));
        this.bytes += size;
        this.buffer.push(observation);
        if (!this.capped && (this.buffer.length >= (this.options.maxObservations as number) || this.bytes >= (this.options.maxBytes as number))) {
            this.capped = true;
            this.sampled = true;
            this.seq += 1;
            this.buffer.push({ ...observation, id: ulid(), seq: this.seq, kind: "budget.exhausted", nodeId: undefined, edgeField: undefined, connectorId: undefined, payload: undefined, capability: undefined, budget: { dimension: "observations", used: this.buffer.length, limit: this.options.maxObservations as number } });
        }
        if (this.options.live) {
            try { this.options.live(observation); } catch (err) { /* delivery is best effort */ }
        }
        return observation;
    }

    /**
     * Record one scheduler 2.1 event.  Kept separate from `attach` because a
     * browser keeps a single scheduler for the open graph and routes each
     * event to the recorder of the execution it belongs to.
     */
    handle(name: string, e: any): void {
        const ids = { spanId: e && e.spanId, parentSpanId: e && e.parentSpanId };
        if (name === "begin") {
            this.record({ kind: "exec.begin", payload: { url: e.url, trigger: e.trigger }, ...ids });
            return;
        }
        if (name === "beginedge") {
            this.record({ kind: "edge.input", nodeId: e.nodeId, edgeField: e.field, payload: capturePayload(e.value, this.port(e.nodeId, "in", e.field), this.options.defaultCapture), ...ids });
            return;
        }
        if (name === "beginconnector") {
            this.record({ kind: "route", nodeId: e.connector && e.connector.nodeId, edgeField: e.connector && e.connector.field, connectorId: e.connector && e.connector.id, payload: capturePayload(e.value, this.port(e.connector && e.connector.nodeId, "in", e.connector && e.connector.field), this.options.defaultCapture), ...ids });
            return;
        }
        if (name === "error") {
            if (e.code === "BUDGET_EXCEEDED") {
                this.record({ kind: "budget.exhausted", nodeId: e.nodeId, budget: { dimension: e.dimension, used: e.used, limit: e.limit }, payload: { message: String(e.message || e.err) }, ...ids });
                return;
            }
            if (e.code === "CONTRACT_VIOLATION") {
                this.record({ kind: "contract.violation", nodeId: e.nodeId, edgeField: e.field, payload: { message: String(e.message || e.err) }, ...ids });
                return;
            }
            this.record({ kind: "exec.error", nodeId: e.nodeId, edgeField: e.field || e.edgeField, connectorId: e.connectorId, payload: { message: String(e.message || (e.err && e.err.message) || e.err), code: e.code }, ...ids });
            return;
        }
        if (name === "warning") {
            if (e.code === "CONTRACT_VIOLATION") {
                this.record({ kind: "contract.violation", nodeId: e.nodeId, edgeField: e.field, payload: { message: String(e.message || e.err), mode: "warn" }, ...ids });
            }
            return;
        }
        if (name === "observation") {
            this.record({ kind: "custom", nodeId: e.nodeId, payload: { kind: e.kind, data: capturePayload(e.data, undefined, "full") }, ...ids });
            return;
        }
        if (name === "end") {
            this.record({ kind: "exec.end", payload: { state: e.state, reason: e.reason, hops: e.hops, errors: e.errors, duration: e.duration } });
        }
    }

    /** Events this recorder knows how to turn into observations. */
    static readonly EVENTS = ["begin", "beginedge", "beginconnector", "error", "warning", "observation", "end"];

    /**
     * Wire the recorder to a scheduler 2.1 instance that carries exactly one
     * execution (the server runs one per scheduler); events belonging to
     * another execution are ignored.
     */
    attach(scheduler: any) {
        const mine = (e: any) => !e || !e.executionId || e.executionId === this.options.executionId;
        ObservationRecorder.EVENTS.forEach((name) => scheduler.addEventListener(name, (e: any) => { if (mine(e)) this.handle(name, e); }));
    }

    /** An effect the host performed or refused. */
    effect(decision: "allowed" | "denied", kind: string, scope: string, nodeId: string | undefined, spanId: string | undefined, extra: any = {}, layer?: string) {
        this.effects[decision] += 1;
        return this.record({ kind: decision === "allowed" ? "effect" : "effect.denied", nodeId, spanId, capability: { kind, scope: [scope], decision, ...(layer ? { layer } : {}) }, payload: extra });
    }

    static keyFor(graphId: string, executionId: string, at: number): string {
        const d = new Date(at);
        const stamp = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}${String(d.getUTCHours()).padStart(2, "0")}`;
        return `observations/${graphId}/${stamp}/${executionId}.ndjson`;
    }

    /** Serialise the buffer as NDJSON. */
    ndjson(): string {
        return this.buffer.map((o) => JSON.stringify(o)).join("\n") + (this.buffer.length ? "\n" : "");
    }

    summary() {
        return { count: this.buffer.length, sampled: this.sampled, capped: this.capped, effects: { ...this.effects } };
    }
}
