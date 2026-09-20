import * as Y from "yjs";
import {
  ROOT_KEY,
  SCHEMA_VERSION,
  GRAPH_TEXT_PROPERTIES,
  NODE_TEXT_PROPERTIES,
  NODE_TEMPLATE_TEXT_FIELDS,
  NODE_OPAQUE_FIELDS,
} from "./schema";
import { applyTextDelta, newText } from "./text";
import {
  fromJSON,
  isEmpty,
  clone,
  isPlainScalar,
  readValue,
  buildScalarMap,
  buildKeyedMapArray,
  buildNode,
  buildEdge,
  buildNodeProperties,
} from "./codec";

/* ------------------------------------------------------------------ *
 * equality
 * ------------------------------------------------------------------ */

function deepEqual(a: any, b: any): boolean {
  if (a === b) {
    return true;
  }
  if (a === null || b === null || a === undefined || b === undefined) {
    return a === b;
  }
  if (typeof a !== "object" || typeof b !== "object") {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }
  if (Array.isArray(a)) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqual(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }
  const aKeys = Object.keys(a).filter((k) => a[k] !== undefined);
  const bKeys = Object.keys(b).filter((k) => b[k] !== undefined);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  for (const key of aKeys) {
    if (!deepEqual(a[key], b[key])) {
      return false;
    }
  }
  return true;
}

/* ------------------------------------------------------------------ *
 * primitives
 * ------------------------------------------------------------------ */

/** Bring a map of scalar (or opaque JSON) values in line with `target`. */
function reconcileScalarMap(map: Y.Map<any>, target: Record<string, any>): boolean {
  let changed = false;
  const source = target || {};
  const wanted = Object.keys(source).filter((key) => source[key] !== undefined);
  const wantedSet = new Set(wanted);

  Array.from(map.keys()).forEach((key) => {
    if (!wantedSet.has(key)) {
      map.delete(key);
      changed = true;
    }
  });

  wanted.forEach((key) => {
    const next = source[key];
    const current = map.get(key);
    const currentJson = current instanceof Y.AbstractType ? readValue(current) : current;
    if (!deepEqual(currentJson, next)) {
      map.set(key, isPlainScalar(next) ? next : clone(next));
      changed = true;
    }
  });
  return changed;
}

/** Bring an array of strings in line, preserving untouched entries. */
function reconcileStringArray(arr: Y.Array<string>, target: string[]): boolean {
  const next = (target || []).map((v) => String(v));
  const current = arr.toArray();
  if (deepEqual(current, next)) {
    return false;
  }
  const max = Math.min(current.length, next.length);
  let prefix = 0;
  while (prefix < max && current[prefix] === next[prefix]) {
    prefix += 1;
  }
  const maxSuffix = max - prefix;
  let suffix = 0;
  while (
    suffix < maxSuffix &&
    current[current.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  const removed = current.length - prefix - suffix;
  if (removed > 0) {
    arr.delete(prefix, removed);
  }
  const inserted = next.slice(prefix, next.length - suffix);
  if (inserted.length > 0) {
    arr.insert(prefix, inserted);
  }
  return true;
}

/**
 * Bring an array of scalar maps in line with `target`, matching entries by
 * `keyField` rather than by position so that a concurrent insert elsewhere in
 * the list cannot make an edit land on the wrong entry.
 */
function reconcileKeyedMapArray(
  arr: Y.Array<Y.Map<any>>,
  target: any[],
  keyField: string,
): boolean {
  let changed = false;
  const items = (target || []).filter(
    (item) => item && item[keyField] !== undefined && item[keyField] !== null,
  );
  const keys = items.map((item) => String(item[keyField]));
  const keySet = new Set(keys);

  // Drop entries that are gone, malformed, or duplicated.
  const seen = new Set<string>();
  for (let i = arr.length - 1; i >= 0; i -= 1) {
    const entry = arr.get(i);
    const key = entry instanceof Y.Map ? String(entry.get(keyField)) : null;
    if (key === null || !keySet.has(key) || seen.has(key)) {
      arr.delete(i, 1);
      changed = true;
    } else {
      seen.add(key);
    }
  }

  for (let i = 0; i < items.length; i += 1) {
    const wantKey = keys[i];
    const entry = i < arr.length ? (arr.get(i) as Y.Map<any>) : null;
    if (entry && String(entry.get(keyField)) === wantKey) {
      changed = reconcileScalarMap(entry, items[i]) || changed;
      continue;
    }
    // The entry exists but sits in the wrong place: move it by rebuilding.
    // These maps hold only scalars, so rebuilding loses nothing.
    let found = -1;
    for (let j = i + 1; j < arr.length; j += 1) {
      const candidate = arr.get(j);
      if (candidate instanceof Y.Map && String(candidate.get(keyField)) === wantKey) {
        found = j;
        break;
      }
    }
    if (found !== -1) {
      arr.delete(found, 1);
    }
    arr.insert(i, [buildScalarMap(items[i])]);
    changed = true;
  }

  while (arr.length > items.length) {
    arr.delete(arr.length - 1, 1);
    changed = true;
  }
  return changed;
}

/** Reconcile a key that should hold a Y.Text. */
function reconcileText(map: Y.Map<any>, key: string, value: unknown): boolean {
  const next = typeof value === "string" ? value : value == null ? "" : String(value);
  const current = map.get(key);
  if (current instanceof Y.Text) {
    return applyTextDelta(current, next);
  }
  map.set(key, newText(next));
  return true;
}

/* ------------------------------------------------------------------ *
 * graph structures
 * ------------------------------------------------------------------ */

function reconcileGraphProperties(props: Y.Map<any>, target: Record<string, any>): boolean {
  let changed = false;
  const source = target || {};
  const wanted = Object.keys(source).filter((key) => source[key] !== undefined);
  const wantedSet = new Set(wanted);

  Array.from(props.keys()).forEach((key) => {
    if (!wantedSet.has(key)) {
      props.delete(key);
      changed = true;
    }
  });

  wanted.forEach((key) => {
    if (GRAPH_TEXT_PROPERTIES.indexOf(key) !== -1) {
      changed = reconcileText(props, key, source[key]) || changed;
      return;
    }
    const current = props.get(key);
    const currentJson = current instanceof Y.AbstractType ? readValue(current) : current;
    if (!deepEqual(currentJson, source[key])) {
      props.set(key, isPlainScalar(source[key]) ? source[key] : clone(source[key]));
      changed = true;
    }
  });
  return changed;
}

function reconcileNodeProperties(props: Y.Map<any>, target: Record<string, any>): boolean {
  let changed = false;
  const source = target || {};
  const wanted = Object.keys(source).filter((key) => source[key] !== undefined);
  const wantedSet = new Set(wanted);

  Array.from(props.keys()).forEach((key) => {
    if (!wantedSet.has(key)) {
      props.delete(key);
      changed = true;
    }
  });

  wanted.forEach((key) => {
    const next = source[key];
    if (key === "presentation") {
      const current = props.get(key);
      if (current instanceof Y.Map) {
        changed = reconcileScalarMap(current, next || {}) || changed;
      } else {
        props.set(key, buildScalarMap(next || {}));
        changed = true;
      }
      return;
    }
    if (key === "groups") {
      const current = props.get(key);
      if (current instanceof Y.Array) {
        changed = reconcileStringArray(current as Y.Array<string>, next || []) || changed;
      } else {
        const arr = new Y.Array<string>();
        arr.push([...(next || [])]);
        props.set(key, arr);
        changed = true;
      }
      return;
    }
    if (key === "inputs" || key === "outputs") {
      const current = props.get(key);
      if (current instanceof Y.Array) {
        changed =
          reconcileKeyedMapArray(current as Y.Array<Y.Map<any>>, next || [], "name") || changed;
      } else {
        props.set(key, buildKeyedMapArray(next || []));
        changed = true;
      }
      return;
    }
    if (NODE_TEXT_PROPERTIES.indexOf(key) !== -1) {
      changed = reconcileText(props, key, next) || changed;
      return;
    }
    const current = props.get(key);
    const currentJson = current instanceof Y.AbstractType ? readValue(current) : current;
    if (!deepEqual(currentJson, next)) {
      props.set(key, isPlainScalar(next) ? next : clone(next));
      changed = true;
    }
  });
  return changed;
}

function reconcileEdges(edges: Y.Map<any>, target: any[]): boolean {
  let changed = false;
  const items = (target || []).filter((edge) => edge && typeof edge.field === "string");
  const byField = new Map<string, any>();
  items.forEach((edge) => byField.set(edge.field, edge));

  Array.from(edges.keys()).forEach((field) => {
    if (!byField.has(field)) {
      edges.delete(field);
      changed = true;
    }
  });

  byField.forEach((edge, field) => {
    const current = edges.get(field);
    if (!(current instanceof Y.Map)) {
      edges.set(field, buildEdge(edge));
      changed = true;
      return;
    }
    // scalar keys of the edge, excluding the connector list
    const scalars: Record<string, any> = {};
    Object.keys(edge).forEach((key) => {
      if (key !== "connectors" && edge[key] !== undefined) {
        scalars[key] = edge[key];
      }
    });
    Array.from(current.keys()).forEach((key) => {
      if (key !== "connectors" && scalars[key] === undefined) {
        current.delete(key);
        changed = true;
      }
    });
    Object.keys(scalars).forEach((key) => {
      const existing = current.get(key);
      const existingJson =
        existing instanceof Y.AbstractType ? readValue(existing) : existing;
      if (!deepEqual(existingJson, scalars[key])) {
        current.set(key, isPlainScalar(scalars[key]) ? scalars[key] : clone(scalars[key]));
        changed = true;
      }
    });

    const connectors = current.get("connectors");
    if (connectors instanceof Y.Array) {
      changed =
        reconcileKeyedMapArray(
          connectors as Y.Array<Y.Map<any>>,
          edge.connectors || [],
          "id",
        ) || changed;
    } else {
      current.set("connectors", buildKeyedMapArray(edge.connectors || []));
      changed = true;
    }
  });
  return changed;
}

function reconcileNode(yNode: Y.Map<any>, target: Record<string, any>): boolean {
  let changed = false;
  const source = target || {};
  const structural = new Set(["properties", "edges", "template"]);
  const wanted = Object.keys(source).filter(
    (key) => !structural.has(key) && source[key] !== undefined,
  );
  const wantedSet = new Set(wanted);

  Array.from(yNode.keys()).forEach((key) => {
    if (!structural.has(key) && !wantedSet.has(key)) {
      yNode.delete(key);
      changed = true;
    }
  });

  wanted.forEach((key) => {
    const next = source[key];
    const current = yNode.get(key);
    const currentJson = current instanceof Y.AbstractType ? readValue(current) : current;
    if (!deepEqual(currentJson, next)) {
      if (NODE_OPAQUE_FIELDS.indexOf(key) !== -1) {
        yNode.set(key, clone(next));
      } else {
        yNode.set(key, isPlainScalar(next) ? next : clone(next));
      }
      changed = true;
    }
  });

  const props = yNode.get("properties");
  if (props instanceof Y.Map) {
    changed = reconcileNodeProperties(props, source.properties || {}) || changed;
  } else {
    yNode.set("properties", buildNodeProperties(source.properties || {}));
    changed = true;
  }

  const edges = yNode.get("edges");
  if (edges instanceof Y.Map) {
    changed = reconcileEdges(edges, source.edges || []) || changed;
  } else {
    const map = new Y.Map<Y.Map<any>>();
    (source.edges || []).forEach((edge: any) => {
      if (edge && typeof edge.field === "string") {
        map.set(edge.field, buildEdge(edge));
      }
    });
    yNode.set("edges", map);
    changed = true;
  }

  const template = yNode.get("template");
  const sourceTemplate = source.template || {};
  if (template instanceof Y.Map) {
    const wantedTemplateKeys = new Set(
      Object.keys(sourceTemplate).filter((k) => sourceTemplate[k] !== undefined),
    );
    NODE_TEMPLATE_TEXT_FIELDS.forEach((k) => wantedTemplateKeys.add(k));
    Array.from(template.keys()).forEach((key) => {
      if (!wantedTemplateKeys.has(key)) {
        template.delete(key);
        changed = true;
      }
    });
    wantedTemplateKeys.forEach((key) => {
      if (NODE_TEMPLATE_TEXT_FIELDS.indexOf(key) !== -1) {
        changed = reconcileText(template, key, sourceTemplate[key] ?? "") || changed;
        return;
      }
      const current = template.get(key);
      const currentJson = current instanceof Y.AbstractType ? readValue(current) : current;
      if (!deepEqual(currentJson, sourceTemplate[key])) {
        template.set(key, clone(sourceTemplate[key]));
        changed = true;
      }
    });
  } else {
    yNode.set("template", buildNode({ template: sourceTemplate }).get("template"));
    changed = true;
  }

  return changed;
}

function reconcileNodes(nodes: Y.Map<any>, target: any[]): boolean {
  let changed = false;
  const items = (target || []).filter((node) => node && typeof node.id === "string");
  const byId = new Map<string, any>();
  items.forEach((node) => byId.set(node.id, node));

  Array.from(nodes.keys()).forEach((id) => {
    if (!byId.has(id)) {
      nodes.delete(id);
      changed = true;
    }
  });

  byId.forEach((node, id) => {
    const current = nodes.get(id);
    if (current instanceof Y.Map) {
      changed = reconcileNode(current, node) || changed;
    } else {
      nodes.set(id, buildNode(node));
      changed = true;
    }
  });
  return changed;
}

/* ------------------------------------------------------------------ *
 * entry point
 * ------------------------------------------------------------------ */

/**
 * Bring `doc` in line with the plain graph JSON in `target`, emitting the
 * smallest set of Yjs operations that will do it.
 *
 * This is the bridge that lets the existing editor code keep mutating a plain
 * JavaScript snapshot object: the snapshot is the intent, and this turns the
 * intent into granular CRDT operations that merge correctly against
 * concurrent edits from other people.
 *
 * Everything runs inside a single transaction tagged with `origin`, so undo
 * grouping and echo suppression both work off it.
 *
 * Returns true when the document actually changed.
 */
export function reconcile(doc: Y.Doc, target: Record<string, any>, origin?: any): boolean {
  if (!target) {
    return false;
  }
  if (isEmpty(doc)) {
    doc.transact(() => {
      fromJSON(target, doc);
    }, origin);
    return true;
  }

  let changed = false;
  doc.transact(() => {
    const root = doc.getMap(ROOT_KEY);
    const structural = new Set(["nodes", "properties", "meta"]);
    const wanted = Object.keys(target).filter(
      (key) => !structural.has(key) && (target as any)[key] !== undefined,
    );
    const wantedSet = new Set(wanted);

    Array.from(root.keys()).forEach((key) => {
      if (!structural.has(key) && !wantedSet.has(key)) {
        root.delete(key);
        changed = true;
      }
    });

    wanted.forEach((key) => {
      const next = (target as any)[key];
      const current = root.get(key);
      const currentJson = current instanceof Y.AbstractType ? readValue(current) : current;
      if (!deepEqual(currentJson, next)) {
        root.set(key, isPlainScalar(next) ? next : clone(next));
        changed = true;
      }
    });

    const props = root.get("properties");
    if (props instanceof Y.Map) {
      changed = reconcileGraphProperties(props, target.properties || {}) || changed;
    } else {
      root.set("properties", buildScalarMap(target.properties || {}));
      changed = true;
    }

    const nodes = root.get("nodes");
    if (nodes instanceof Y.Map) {
      changed = reconcileNodes(nodes, target.nodes || []) || changed;
    } else {
      const map = new Y.Map<Y.Map<any>>();
      (target.nodes || []).forEach((node: any) => {
        if (node && typeof node.id === "string") {
          map.set(node.id, buildNode(node));
        }
      });
      root.set("nodes", map);
      changed = true;
    }

    const meta = root.get("meta");
    if (!(meta instanceof Y.Map)) {
      const m = new Y.Map();
      m.set("schemaVersion", SCHEMA_VERSION);
      root.set("meta", m);
    }
  }, origin);

  return changed;
}

export { deepEqual };
