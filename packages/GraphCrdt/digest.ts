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
