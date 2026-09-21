import { graphPropertyNamespace, nodePropertyNamespace, graphKeyNamespace, nodeKeyNamespace } from "./namespaces";
import type { Namespace } from "./namespaces";

/**
 * Stable views of a projection for hashing (plan §4.7.1).
 *
 * A revision carries three digests: `full` over the whole projection,
 * `definition` over what the program *is* (nothing that only moves things
 * around on screen, none of the counters bumped on every commit), and
 * `layout` over the placement alone.  Two revisions with the same definition
 * digest run the same program however differently they are laid out.
 * Hashing itself is left to the caller (Node has crypto, the browser has
 * SubtleCrypto); this module only fixes what gets hashed and in what order.
 */

/** JSON with keys sorted at every level and no undefined values. */
export function canonical(value: any): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value === undefined ? null : value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(",")}]`;
  }
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
}

function pick(source: any, keep: (key: string) => boolean): any {
  const out: Record<string, any> = {};
  Object.keys(source || {}).forEach((k) => {
    if (keep(k)) out[k] = source[k];
  });
  return out;
}

const DEFINITION: Namespace[] = ["definition", "code", "capabilities", "placement", "budgets", "tests", "iac"];

/** The projection without layout and housekeeping: what the program is. */
export function definitionView(projection: any): any {
  if (!projection) return null;
  const inDefinition = (ns: Namespace) => DEFINITION.includes(ns);
  return {
    ...pick(projection, (k) => k !== "nodes" && k !== "properties" && inDefinition(graphKeyNamespace(k))),
    properties: pick(projection.properties, (k) => inDefinition(graphPropertyNamespace(k))),
    nodes: (projection.nodes || []).map((node: any) => ({
      ...pick(node, (k) => k !== "properties" && k !== "template" && k !== "edges" && inDefinition(nodeKeyNamespace(k))),
      properties: pick(node.properties, (k) => inDefinition(nodePropertyNamespace(k))),
      template: node.template,
      edges: node.edges,
    })),
  };
}

/** Only where things sit: node ids with their layout keys, graph layout keys. */
export function layoutView(projection: any): any {
  if (!projection) return null;
  return {
    properties: pick(projection.properties, (k) => graphPropertyNamespace(k) === "layout"),
    nodes: (projection.nodes || []).map((node: any) => ({
      id: node.id,
      properties: pick(node.properties, (k) => nodePropertyNamespace(k) === "layout"),
    })),
  };
}

/**
 * The identity of a published component (plan §4.3.2): what a consumer would
 * notice if it changed.  A consumer embeds a copy of the artifact and then
 * touches it in ways that mean nothing to the program: it drops `url` and
 * `artifact`, gives the copy its own id, version and graphId, moves it around
 * on screen, clears the connectors of an imported node (they belong to the
 * consumer's graph), and fills in `visible` on ports that predate the flag.
 * None of that is part of the view, so a faithful copy always matches the
 * manifest's digest and a drifted one never does.
 */
const NODE_VOLATILE = ["id", "url", "version", "graphId", "artifact", "artifactlId", "publishedOn", "publishedBy", "userId", "loaded"];
const GRAPH_VOLATILE = ["url", "version", "artifact", "publishedOn", "publishedBy", "userId"];

function normalizePorts(ports: any): any {
  if (!Array.isArray(ports)) return ports;
  return ports.map((port: any) => (port && typeof port === "object" ? { ...port, visible: port.visible === undefined ? true : port.visible } : port));
}

function nodeView(node: any, withConnectors: boolean, withId: boolean): any {
  const out: Record<string, any> = {};
  Object.keys(node || {}).forEach((k) => {
    if (NODE_VOLATILE.includes(k) || k === "properties" || k === "template" || k === "edges") return;
    if (DEFINITION.includes(nodeKeyNamespace(k))) out[k] = node[k];
  });
  if (withId) out.id = node.id;
  const properties = pick(node.properties, (k) => DEFINITION.includes(nodePropertyNamespace(k)));
  properties.inputs = normalizePorts(properties.inputs);
  properties.outputs = normalizePorts(properties.outputs);
  out.properties = properties;
  out.template = node.template;
  out.edges = (Array.isArray(node.edges) ? node.edges : []).map((e: any) => (withConnectors ? { field: e.field, connectors: e.connectors } : { field: e.field }));
  return out;
}

/** The part of a published artifact its digest is taken over. */
export function componentView(kind: "graph" | "node", artifact: any): any {
  if (!artifact) return null;
  if (kind === "node") {
    return nodeView(artifact, false, false);
  }
  return {
    ...pick(artifact, (k) => k !== "nodes" && k !== "properties" && !GRAPH_VOLATILE.includes(k) && DEFINITION.includes(graphKeyNamespace(k))),
    properties: pick(artifact.properties, (k) => DEFINITION.includes(graphPropertyNamespace(k))),
    nodes: (artifact.nodes || []).map((node: any) => nodeView(node, true, true)),
  };
}
