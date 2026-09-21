import { deepEqual } from "./reconcile";
import type { Namespace } from "./namespaces";
import {
  graphKeyNamespace,
  graphPropertyNamespace,
  nodePropertyNamespace,
  nodeKeyNamespace,
  isPrivilegedNode,
  isInfrastructureCapability,
} from "./namespaces";

/**
 * The semantic difference between two projections of a graph.
 *
 * The server stages every incoming update on a copy of the current document
 * and compares the JSON before and after (plan §4.4.2).  Yjs struct semantics
 * are not a public API, but `toJSON` is, and it is what both the editor and the
 * server already read, so a diff over it is stable and cheap.  The result is a
 * *summary*: which namespaces were touched, which nodes and connectors changed,
 * and the operations in the same vocabulary an agent would use to propose the
 * change (§5.1 `MutationOp`), without the values themselves, so it fits in an
 * audit record.
 */
export interface ConnectorRef {
  connectorId: string;
  from: { nodeId: string; field: string };
  to: { nodeId: string; field: string; graphId?: string };
}

export interface DiffOp {
  op:
    | "add-node" | "remove-node" | "set-node-code" | "set-node-props" | "set-node-fields"
    | "set-graph-props" | "set-graph-fields" | "connect" | "disconnect"
    | "set-component-pin" | "set-capabilities" | "set-placement" | "set-budget" | "set-iac-desired"
    | "set-meta" | "set-observed" | "set-policy"
    | "touch";
  namespace: Namespace;
  nodeId?: string;
  keys?: string[];
  field?: string;
  connector?: ConnectorRef;
}

export interface PrivilegeDelta {
  /** Nodes whose placement became `server`. */
  placementToServer: string[];
  /** Nodes that gained capabilities, with the names gained. */
  capabilitiesAdded: { nodeId: string; capabilities: string[] }[];
  /** Whether any capability gained reaches the cloud account (aws:*, iam*). */
  infrastructure: boolean;
  /** Connectors added whose target node is privileged after the change. */
  privilegedEdges: ConnectorRef[];
}

export interface DiffSummary {
  /** Nothing changed. */
  empty: boolean;
  /** There was no document before: this update creates the graph. */
  seed: boolean;
  namespaces: Namespace[];
  ops: DiffOp[];
  nodesAdded: string[];
  nodesRemoved: string[];
  nodesChanged: string[];
  graphKeysChanged: string[];
  connectorsAdded: ConnectorRef[];
  connectorsRemoved: ConnectorRef[];
  privilegeDelta: PrivilegeDelta;
}

function capabilityName(c: any): string {
  return typeof c === "string" ? c : String((c && c.name) || "");
}

function connectorsOf(node: any): Map<string, ConnectorRef> {
  const out = new Map<string, ConnectorRef>();
  const edges = Array.isArray(node && node.edges) ? node.edges : [];
  edges.forEach((edge: any) => {
    const connectors = Array.isArray(edge && edge.connectors) ? edge.connectors : [];
    connectors.forEach((c: any) => {
      if (!c || !c.id) return;
      out.set(String(c.id), {
        connectorId: String(c.id),
        from: { nodeId: String(node.id), field: String(edge.field) },
        to: { nodeId: String(c.nodeId), field: String(c.field), graphId: c.graphId ? String(c.graphId) : undefined },
      });
    });
  });
  return out;
}

function keysOf(a: any, b: any): string[] {
  const keys = new Set<string>();
  Object.keys(a || {}).forEach((k) => keys.add(k));
  Object.keys(b || {}).forEach((k) => keys.add(k));
  return Array.from(keys).sort();
}

function changedKeys(a: any, b: any, skip: string[] = []): string[] {
  return keysOf(a, b).filter((k) => !skip.includes(k) && !deepEqual((a || {})[k], (b || {})[k]));
}

function groupByNamespace(keys: string[], classify: (k: string) => Namespace): Map<Namespace, string[]> {
  const out = new Map<Namespace, string[]>();
  keys.forEach((k) => {
    const ns = classify(k);
    out.set(ns, (out.get(ns) || []).concat(k));
  });
  return out;
}

const NAMESPACE_OP: Partial<Record<Namespace, DiffOp["op"]>> = {
  housekeeping: "touch",
  capabilities: "set-capabilities",
  placement: "set-placement",
  budgets: "set-budget",
  iac: "set-iac-desired",
  meta: "set-meta",
  observed: "set-observed",
  policy: "set-policy",
};

/** Compare two `toJSON` projections.  Either may be null for "no document". */
export function semanticDiff(before: any | null, after: any | null): DiffSummary {
  const ops: DiffOp[] = [];
  const namespaces = new Set<Namespace>();
  const delta: PrivilegeDelta = { placementToServer: [], capabilitiesAdded: [], infrastructure: false, privilegedEdges: [] };
  const summary: DiffSummary = {
    empty: true, seed: before === null && after !== null, namespaces: [], ops,
    nodesAdded: [], nodesRemoved: [], nodesChanged: [], graphKeysChanged: [],
    connectorsAdded: [], connectorsRemoved: [], privilegeDelta: delta,
  };
  const push = (op: DiffOp) => { ops.push(op); namespaces.add(op.namespace); };
  const a = before || {};
  const b = after || {};

  // graph root and graph properties
  const rootKeys = changedKeys(a, b, ["nodes", "properties"]);
  groupByNamespace(rootKeys, graphKeyNamespace).forEach((keys, ns) => {
    push({ op: NAMESPACE_OP[ns] || "set-graph-fields", namespace: ns, keys });
  });
  const propKeys = changedKeys(a.properties, b.properties);
  groupByNamespace(propKeys, graphPropertyNamespace).forEach((keys, ns) => {
    push({ op: NAMESPACE_OP[ns] || "set-graph-props", namespace: ns, keys });
  });
  summary.graphKeysChanged = rootKeys.concat(propKeys.map((k) => `properties.${k}`));

  // nodes by id
  const beforeNodes = new Map<string, any>();
  const afterNodes = new Map<string, any>();
  (Array.isArray(a.nodes) ? a.nodes : []).forEach((n: any) => n && n.id && beforeNodes.set(String(n.id), n));
  (Array.isArray(b.nodes) ? b.nodes : []).forEach((n: any) => n && n.id && afterNodes.set(String(n.id), n));

  const privilegedAfter = (nodeId: string) => isPrivilegedNode(afterNodes.get(nodeId));
  const noteConnectorAdded = (ref: ConnectorRef) => {
    summary.connectorsAdded.push(ref);
    push({ op: "connect", namespace: "definition", nodeId: ref.from.nodeId, connector: ref });
    const sameGraph = !ref.to.graphId || ref.to.graphId === String(b.id || "");
    if (sameGraph && privilegedAfter(ref.to.nodeId)) {
      delta.privilegedEdges.push(ref);
    }
  };
  const notePrivilege = (nodeId: string, prev: any, next: any) => {
    const p = (prev && prev.properties) || {};
    const n = (next && next.properties) || {};
    if (n.placement === "server" && p.placement !== "server") {
      delta.placementToServer.push(nodeId);
    }
    const had = new Set((Array.isArray(p.capabilities) ? p.capabilities : []).map(capabilityName));
    const gained = (Array.isArray(n.capabilities) ? n.capabilities : []).map(capabilityName).filter((c: string) => c && !had.has(c));
    if (gained.length) {
      delta.capabilitiesAdded.push({ nodeId, capabilities: gained });
      if (gained.some(isInfrastructureCapability)) delta.infrastructure = true;
    }
  };

  afterNodes.forEach((node, id) => {
    if (!beforeNodes.has(id)) {
      summary.nodesAdded.push(id);
      push({ op: "add-node", namespace: "definition", nodeId: id });
      // a new node brings its own privileges and wiring with it
      const props = node.properties || {};
      if (props.placement === "server") push({ op: "set-placement", namespace: "placement", nodeId: id });
      if (Array.isArray(props.capabilities) && props.capabilities.length) push({ op: "set-capabilities", namespace: "capabilities", nodeId: id });
      notePrivilege(id, null, node);
      connectorsOf(node).forEach(noteConnectorAdded);
    }
  });
  beforeNodes.forEach((node, id) => {
    if (!afterNodes.has(id)) {
      summary.nodesRemoved.push(id);
      push({ op: "remove-node", namespace: "definition", nodeId: id });
      connectorsOf(node).forEach((ref) => {
        summary.connectorsRemoved.push(ref);
        push({ op: "disconnect", namespace: "definition", nodeId: id, connector: ref });
      });
    }
  });
  beforeNodes.forEach((prev, id) => {
    const next = afterNodes.get(id);
    if (!next || deepEqual(prev, next)) return;
    summary.nodesChanged.push(id);
    // top-level fields
    const fieldKeys = changedKeys(prev, next, ["properties", "template", "edges"]);
    groupByNamespace(fieldKeys, nodeKeyNamespace).forEach((keys, ns) => {
      push({ op: NAMESPACE_OP[ns] || "set-node-fields", namespace: ns, nodeId: id, keys });
    });
    // properties
    const propKeysChanged = changedKeys(prev.properties, next.properties);
    groupByNamespace(propKeysChanged, nodePropertyNamespace).forEach((keys, ns) => {
      if (ns === "code") {
        keys.forEach((field) => push({ op: "set-node-code", namespace: "code", nodeId: id, field }));
        return;
      }
      if (ns === "definition" && keys.includes("component")) {
        push({ op: "set-component-pin", namespace: "definition", nodeId: id });
        const rest = keys.filter((k) => k !== "component");
        if (rest.length) push({ op: "set-node-props", namespace: ns, nodeId: id, keys: rest });
        return;
      }
      push({ op: NAMESPACE_OP[ns] || "set-node-props", namespace: ns, nodeId: id, keys });
    });
    notePrivilege(id, prev, next);
    // template text
    changedKeys(prev.template, next.template).forEach((field) => {
      push({ op: "set-node-code", namespace: "code", nodeId: id, field: `template.${field}` });
    });
    // connectors
    const prevC = connectorsOf(prev);
    const nextC = connectorsOf(next);
    nextC.forEach((ref, cid) => {
      if (!prevC.has(cid)) {
        noteConnectorAdded(ref);
      } else if (!deepEqual(prevC.get(cid), ref)) {
        // retargeted in place: treat as disconnect + connect
        const old = prevC.get(cid) as ConnectorRef;
        summary.connectorsRemoved.push(old);
        push({ op: "disconnect", namespace: "definition", nodeId: id, connector: old });
        noteConnectorAdded(ref);
      }
    });
    prevC.forEach((ref, cid) => {
      if (!nextC.has(cid)) {
        summary.connectorsRemoved.push(ref);
        push({ op: "disconnect", namespace: "definition", nodeId: id, connector: ref });
      }
    });
  });

  // connectors into a node that *became* privileged were already there; the
  // placement/capability change itself is what needs the stronger authority.
  summary.namespaces = Array.from(namespaces).sort();
  summary.empty = ops.length === 0;
  return summary;
}

/** The order the server lists namespaces in messages and audit records. */
export function describeDiff(diff: DiffSummary): string {
  if (diff.empty) return "no change";
  const parts: string[] = [];
  if (diff.seed) parts.push("creates the graph");
  if (diff.nodesAdded.length) parts.push(`+${diff.nodesAdded.length} node(s)`);
  if (diff.nodesRemoved.length) parts.push(`-${diff.nodesRemoved.length} node(s)`);
  if (diff.nodesChanged.length) parts.push(`${diff.nodesChanged.length} node(s) changed`);
  if (diff.connectorsAdded.length) parts.push(`+${diff.connectorsAdded.length} connector(s)`);
  if (diff.connectorsRemoved.length) parts.push(`-${diff.connectorsRemoved.length} connector(s)`);
  if (diff.graphKeysChanged.length) parts.push(`graph: ${diff.graphKeysChanged.join(", ")}`);
  return `${parts.join(", ")} [${diff.namespaces.join(", ")}]`;
}
