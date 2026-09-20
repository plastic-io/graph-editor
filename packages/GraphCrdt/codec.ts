import * as Y from "yjs";
import {
  ROOT_KEY,
  SCHEMA_VERSION,
  GRAPH_TEXT_PROPERTIES,
  NODE_TEXT_PROPERTIES,
  NODE_TEMPLATE_TEXT_FIELDS,
  NODE_OPAQUE_FIELDS,
} from "./schema";
import { newText } from "./text";

/** Deep clone of a plain JSON value.  Used so that opaque fields handed to
 * the document cannot be mutated behind its back by the caller. */
export function clone<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}

export function isPlainScalar(value: any): boolean {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

/* ------------------------------------------------------------------ *
 * JSON -> Y
 * ------------------------------------------------------------------ */

export function buildScalarMap(source: Record<string, any>): Y.Map<any> {
  const map = new Y.Map();
  Object.keys(source || {}).forEach((key) => {
    const value = source[key];
    if (value === undefined) {
      return;
    }
    map.set(key, isPlainScalar(value) ? value : clone(value));
  });
  return map;
}

export function buildKeyedMapArray(items: any[]): Y.Array<Y.Map<any>> {
  const arr = new Y.Array<Y.Map<any>>();
  arr.push((items || []).map((item) => buildScalarMap(item)));
  return arr;
}

export function buildNodeProperties(properties: Record<string, any>): Y.Map<any> {
  // Defaults have to be resolved on the plain object first.  A Y.Map that is
  // not yet attached to a document stages its writes in preliminary content,
  // so `has()` and `get()` on it would report nothing and we would clobber
  // the values we just wrote.
  const source: Record<string, any> = { ...(properties || {}) };
  if (source.presentation === undefined) {
    source.presentation = { x: 0, y: 0, z: 0 };
  }
  if (source.groups === undefined) {
    source.groups = [];
  }
  if (source.inputs === undefined) {
    source.inputs = [];
  }
  if (source.outputs === undefined) {
    source.outputs = [];
  }
  const props = new Y.Map();
  Object.keys(source).forEach((key) => {
    const value = source[key];
    if (value === undefined) {
      return;
    }
    if (key === "presentation") {
      props.set(key, buildScalarMap(value || {}));
    } else if (key === "groups") {
      const groups = new Y.Array<string>();
      groups.push([...(value || [])]);
      props.set(key, groups);
    } else if (key === "inputs" || key === "outputs") {
      props.set(key, buildKeyedMapArray(value || []));
    } else if (NODE_TEXT_PROPERTIES.indexOf(key) !== -1) {
      props.set(key, newText(value));
    } else {
      props.set(key, isPlainScalar(value) ? value : clone(value));
    }
  });
  return props;
}

export function buildEdge(edge: Record<string, any>): Y.Map<any> {
  const yEdge = new Y.Map();
  Object.keys(edge || {}).forEach((key) => {
    if (key === "connectors" || edge[key] === undefined) {
      return;
    }
    yEdge.set(key, isPlainScalar(edge[key]) ? edge[key] : clone(edge[key]));
  });
  yEdge.set("connectors", buildKeyedMapArray(edge.connectors || []));
  return yEdge;
}

export function buildNode(node: Record<string, any>): Y.Map<any> {
  const yNode = new Y.Map();
  Object.keys(node || {}).forEach((key) => {
    const value = node[key];
    if (value === undefined) {
      return;
    }
    if (key === "properties" || key === "edges" || key === "template") {
      return;
    }
    if (NODE_OPAQUE_FIELDS.indexOf(key) !== -1) {
      yNode.set(key, clone(value));
      return;
    }
    yNode.set(key, isPlainScalar(value) ? value : clone(value));
  });

  yNode.set("properties", buildNodeProperties(node.properties || {}));

  const edges = new Y.Map<Y.Map<any>>();
  (node.edges || []).forEach((edge: any) => {
    if (!edge || typeof edge.field !== "string") {
      return;
    }
    edges.set(edge.field, buildEdge(edge));
  });
  yNode.set("edges", edges);

  const sourceTemplate: Record<string, any> = { ...(node.template || {}) };
  NODE_TEMPLATE_TEXT_FIELDS.forEach((key) => {
    if (sourceTemplate[key] === undefined) {
      sourceTemplate[key] = "";
    }
  });
  const template = new Y.Map();
  Object.keys(sourceTemplate).forEach((key) => {
    if (NODE_TEMPLATE_TEXT_FIELDS.indexOf(key) !== -1) {
      template.set(key, newText(sourceTemplate[key]));
    } else if (sourceTemplate[key] !== undefined) {
      template.set(key, clone(sourceTemplate[key]));
    }
  });
  yNode.set("template", template);

  return yNode;
}

export function buildGraphProperties(properties: Record<string, any>): Y.Map<any> {
  const props = new Y.Map();
  const source = properties || {};
  Object.keys(source).forEach((key) => {
    const value = source[key];
    if (value === undefined) {
      return;
    }
    if (GRAPH_TEXT_PROPERTIES.indexOf(key) !== -1) {
      props.set(key, newText(value));
    } else {
      props.set(key, isPlainScalar(value) ? value : clone(value));
    }
  });
  return props;
}

/**
 * Populate `doc` with `graph`.  The document is expected to be empty; use
 * `reconcile` to bring an already populated document in line with a target.
 */
export function fromJSON(graph: Record<string, any>, doc?: Y.Doc): Y.Doc {
  const target = doc || new Y.Doc();
  const root = target.getMap(ROOT_KEY);
  target.transact(() => {
    Object.keys(graph || {}).forEach((key) => {
      const value = (graph as any)[key];
      if (key === "nodes" || key === "properties" || value === undefined) {
        return;
      }
      root.set(key, isPlainScalar(value) ? value : clone(value));
    });
    root.set("properties", buildGraphProperties(graph.properties || {}));

    const nodes = new Y.Map<Y.Map<any>>();
    (graph.nodes || []).forEach((node: any) => {
      if (!node || typeof node.id !== "string") {
        return;
      }
      nodes.set(node.id, buildNode(node));
    });
    root.set("nodes", nodes);

    const meta = new Y.Map();
    meta.set("schemaVersion", SCHEMA_VERSION);
    root.set("meta", meta);
  }, "fromJSON");
  return target;
}

/* ------------------------------------------------------------------ *
 * Y -> JSON
 * ------------------------------------------------------------------ */

export function readValue(value: any): any {
  if (value instanceof Y.Text) {
    return value.toString();
  }
  if (value instanceof Y.Map) {
    return readMap(value);
  }
  if (value instanceof Y.Array) {
    return value.toArray().map(readValue);
  }
  return value;
}

export function readMap(map: Y.Map<any>): Record<string, any> {
  const out: Record<string, any> = {};
  map.forEach((value: any, key: string) => {
    out[key] = readValue(value);
  });
  return out;
}

export function readNode(yNode: Y.Map<any>): Record<string, any> {
  const out: Record<string, any> = {};
  yNode.forEach((value: any, key: string) => {
    if (key === "edges" || key === "properties" || key === "template") {
      return;
    }
    out[key] = readValue(value);
  });

  const properties = yNode.get("properties");
  out.properties = properties instanceof Y.Map ? readMap(properties) : {};

  const template = yNode.get("template");
  out.template = template instanceof Y.Map ? readMap(template) : { set: "", vue: "" };

  // Edge order follows the output order, which is what keeps
  // `changeOutputOrder` consistent without storing a second ordering.
  const edgesMap = yNode.get("edges");
  const edges: any[] = [];
  if (edgesMap instanceof Y.Map) {
    const seen = new Set<string>();
    const outputs: any[] = Array.isArray(out.properties.outputs)
      ? out.properties.outputs
      : [];
    outputs.forEach((output: any) => {
      const edge = edgesMap.get(output && output.name);
      if (edge instanceof Y.Map && !seen.has(output.name)) {
        seen.add(output.name);
        edges.push(readMap(edge));
      }
    });
    Array.from(edgesMap.keys())
      .sort()
      .forEach((field) => {
        if (seen.has(field)) {
          return;
        }
        const edge = edgesMap.get(field);
        if (edge instanceof Y.Map) {
          edges.push(readMap(edge));
        }
      });
  }
  out.edges = edges;
  return out;
}

/** Deterministic node ordering, identical on every peer. */
function compareNodes(a: any, b: any): number {
  const ac = Number((a.properties && a.properties.createdOn) || 0);
  const bc = Number((b.properties && b.properties.createdOn) || 0);
  if (ac !== bc) {
    return ac - bc;
  }
  return String(a.id).localeCompare(String(b.id));
}

/**
 * Project the document back into the plain Graph JSON that the scheduler,
 * the artifact store and the existing editor components all expect.
 * Returns null for an empty (never initialised) document.
 */
export function toJSON(doc: Y.Doc): any | null {
  const root = doc.getMap(ROOT_KEY);
  if (root.size === 0) {
    return null;
  }
  const out: Record<string, any> = {};
  root.forEach((value: any, key: string) => {
    if (key === "nodes" || key === "properties" || key === "meta") {
      return;
    }
    out[key] = readValue(value);
  });

  const properties = root.get("properties");
  out.properties = properties instanceof Y.Map ? readMap(properties) : {};

  const nodesMap = root.get("nodes");
  const nodes: any[] = [];
  if (nodesMap instanceof Y.Map) {
    nodesMap.forEach((yNode: any) => {
      if (yNode instanceof Y.Map) {
        nodes.push(readNode(yNode));
      }
    });
  }
  out.nodes = nodes.sort(compareNodes);
  return out;
}

/** True when the document has never been populated. */
export function isEmpty(doc: Y.Doc): boolean {
  return doc.getMap(ROOT_KEY).size === 0;
}

/** Schema version stamped into the document, or 0 when absent. */
export function schemaVersionOf(doc: Y.Doc): number {
  const meta = doc.getMap(ROOT_KEY).get("meta");
  if (meta instanceof Y.Map) {
    return Number(meta.get("schemaVersion")) || 0;
  }
  return 0;
}
