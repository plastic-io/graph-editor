/**
 * Placement (plan §4.8.1): which domain a node's code runs in.
 *
 * A graph is one program that spans a browser and a server, so every node says
 * where it belongs, and whichever domain is running the execution either runs
 * the node or hands it to the other one.  The domain that does not run a node
 * still sees it happen, because the hand-off is an observation like any other.
 */
export type Placement = "browser" | "server" | "portable";
export type Domain = "browser" | "server";

/** Capabilities that only the server can honour, and ones that only a browser can. */
const SERVER_ONLY = ["secret", "storage:s3", "storage:kv", "aws:cfn", "aws:codebuild"];
const BROWSER_ONLY = ["browser:dom", "browser:storage"];

/**
 * What a node says about itself, or what can be read from what it needs.
 * Derivation matters because graphs written before placement existed still
 * have to run somewhere sensible: a node with a browser template draws, a node
 * holding a secret cannot run where the secret is not.
 */
export function placementOf(node: any): Placement {
  const properties = (node && node.properties) || {};
  const declared = properties.placement;
  if (declared === "browser" || declared === "server" || declared === "portable") {
    return declared;
  }
  const capabilities = Array.isArray(properties.capabilities) ? properties.capabilities : [];
  const kinds = capabilities.map((c: any) => String((c && c.kind) || c).split(":").slice(0, 2).join(":"));
  if (kinds.some((k: string) => SERVER_ONLY.some((s) => k === s || k.startsWith(s)))) {
    return "server";
  }
  if (kinds.some((k: string) => BROWSER_ONLY.some((b) => k === b || k.startsWith(b)))) {
    return "browser";
  }
  return "portable";
}

/** Does this domain run the node itself, or hand it over? */
export function runsHere(node: any, domain: Domain): boolean {
  const placement = placementOf(node);
  return placement === "portable" || placement === domain;
}

/**
 * Who receives a delivery when the server reaches a browser node.  A node that
 * only draws is rendered by every viewer, which is what makes a shared
 * visualisation work; a node that does something outside the page must happen
 * once, so it goes to the session that started the execution.
 */
export function deliveryTarget(node: any): "initiator" | "all-viewers" {
  const properties = (node && node.properties) || {};
  if (properties.deliveryTarget === "initiator" || properties.deliveryTarget === "all-viewers") {
    return properties.deliveryTarget;
  }
  const capabilities = Array.isArray(properties.capabilities) ? properties.capabilities : [];
  const effectful = capabilities.some((c: any) => {
    const kind = String((c && c.kind) || c);
    return !kind.startsWith("browser:dom");
  });
  return effectful ? "initiator" : "all-viewers";
}

/** The envelope that crosses a domain boundary (plan §4.8.1). */
export interface EdgeDelivery {
  schemaVersion: 1;
  executionId: string;
  correlationId: string;
  revisionId: string;
  graphId: string;
  /** The node that should run, and the input it should run on. */
  nodeId: string;
  field: string;
  value: any;
  connectorId?: string;
  spanId?: string;
  seq: number;
  instancePath: string[];
  target?: "initiator" | "all-viewers";
  /** What the receiving domain may spend on this delivery. */
  budgetSlice?: { wallMs?: number; hops?: number };
  /** The session that started the execution, for initiator-targeted deliveries. */
  initiator?: string;
}

/** One delivery is one unit of work: the same key must never run twice. */
export function deliveryKey(delivery: { executionId: string; connectorId?: string; nodeId: string; seq: number }): string {
  return `${delivery.connectorId || delivery.nodeId}-${delivery.seq}`;
}

/**
 * Only JSON crosses a boundary (plan §4.8.1).  Anything a domain cannot send
 * is refused where it is written rather than silently becoming null on the
 * other side.
 */
export function wireValue(value: any, maxBytes = 1024 * 1024): { ok: true; value: any; bytes: number } | { ok: false; reason: string } {
  if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    return { ok: false, reason: `a ${typeof value} cannot cross a domain boundary` };
  }
  let text: string;
  try {
    text = JSON.stringify(value === undefined ? null : value);
  } catch (err: any) {
    return { ok: false, reason: `this value cannot cross a domain boundary: ${err.message}` };
  }
  if (text === undefined) {
    return { ok: false, reason: "this value cannot cross a domain boundary" };
  }
  const bytes = text.length;
  if (bytes > maxBytes) {
    return { ok: false, reason: `${bytes} bytes is more than the ${maxBytes} a delivery may carry` };
  }
  return { ok: true, value: JSON.parse(text), bytes };
}
