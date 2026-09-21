/**
 * Which part of a graph each key belongs to.
 *
 * The admission gate on the server decides on a change by *what kind* of thing
 * it touches (plan §4.1.1, §4.4.2): moving a node around is a `layout` change
 * that nobody needs to review, editing its code is `code`, wiring is
 * `definition`, and marking a node as running on the server or granting it a
 * capability is a privilege change that needs a stronger authority.  This is
 * a table, not a schema change: the document keeps its shape, the diff engine
 * just labels what it sees.  The same table is imported by the editor so the
 * history panel and the sync status can name a change the way the server does.
 */
export type Namespace =
  | "definition"
  | "layout"
  | "code"
  | "capabilities"
  | "placement"
  /** Where a node's code runs: inside a contained realm, or in the runtime's own. */
  | "containment"
  | "budgets"
  | "tests"
  | "iac"
  | "meta"
  | "observed"
  | "policy"
  /** Counters the editor bumps on every commit (`version`, `lastUpdate`); they say nothing about what changed. */
  | "housekeeping";

const HOUSEKEEPING_KEYS = ["version", "lastUpdate"];

/** Namespaces only the server itself may write (mirrors of observed state, policy, schema meta). */
export const SERVER_OWNED_NAMESPACES: Namespace[] = ["meta", "observed", "policy"];

/** Namespaces whose change widens what a node may do. */
export const PRIVILEGE_NAMESPACES: Namespace[] = ["capabilities", "placement", "containment"];

/** Keys at the root of the graph. */
export function graphKeyNamespace(key: string): Namespace {
  if (key === "meta") return "meta";
  if (HOUSEKEEPING_KEYS.includes(key)) return "housekeeping";
  if (key.startsWith("observed")) return "observed";
  if (key === "policy" || key === "acl") return "policy";
  return "definition";
}

/** Keys of `graph.properties`. */
export function graphPropertyNamespace(key: string): Namespace {
  if (HOUSEKEEPING_KEYS.includes(key)) return "housekeeping";
  if (key === "template" || key === "scripts") return "code";
  if (key === "icon" || key === "height" || key === "width") return "layout";
  if (key.startsWith("observed")) return "observed";
  return "definition";
}

/** Keys of `node.properties`. */
export function nodePropertyNamespace(key: string): Namespace {
  switch (key) {
    case "x": case "y": case "z":
    case "presentation": case "groups": case "icon": case "positionAbsolute":
      return "layout";
    case "scripts":
      return "code";
    case "capabilities":
      return "capabilities";
    case "placement":
      return "placement";
    case "containment":
      return "containment";
    case "budget": case "budgets":
      return "budgets";
    case "tests":
      return "tests";
    case "iac":
      return "iac";
    default:
      if (HOUSEKEEPING_KEYS.includes(key)) return "housekeeping";
      if (key.startsWith("appearsIn")) return "layout";
      if (key.startsWith("observed")) return "observed";
      return "definition";
  }
}

/** Top-level keys of a node other than `properties`, `template` and `edges`. */
export function nodeKeyNamespace(key: string): Namespace {
  if (HOUSEKEEPING_KEYS.includes(key)) return "housekeeping";
  if (key.startsWith("observed")) return "observed";
  return "definition";
}

/** A node is privileged when it runs on the server or holds any capability. */
export function isPrivilegedNode(node: any): boolean {
  const properties = (node && node.properties) || {};
  if (properties.placement === "server") return true;
  return Array.isArray(properties.capabilities) && properties.capabilities.length > 0;
}

/** Capability names that reach into the cloud account need the IaC approver. */
export function isInfrastructureCapability(capability: any): boolean {
  const name = typeof capability === "string" ? capability : capability && capability.name;
  return typeof name === "string" && (/^aws:/.test(name) || /^iam/.test(name));
}
