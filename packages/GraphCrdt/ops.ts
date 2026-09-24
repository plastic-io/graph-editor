/**
 * Semantic operations on a projection (plan §5.1 `MutationOp`).
 *
 * An agent does not send Yjs bytes; it says what it wants in the same
 * vocabulary the diff engine reports.  `applyOps` is the pure function that
 * turns those operations into the projection the graph should have, and the
 * server then reconciles the head document into it (the same `reconcile()`
 * the editor uses), so a proposal has a lossless mapping to the changes an
 * editor would have made.  Every operation is checked against the graph as it
 * stands; the first failure stops the batch (a proposal is one transaction).
 */
export type MutationOp =
  | { op: "add-node"; node: { id: string; url: string; name?: string; inputs?: any[]; outputs?: any[]; placement?: string; template?: { set?: string; vue?: string }; layout?: { x?: number; y?: number; z?: number } } }
  | { op: "remove-node"; nodeId: string }
  | { op: "set-node-code"; nodeId: string; template: "set" | "vue"; text: string }
  | { op: "set-node-props"; nodeId: string; patch: Record<string, any> }
  | { op: "set-graph-props"; patch: Record<string, any> }
  | { op: "connect"; from: { nodeId: string; field: string }; to: { nodeId: string; field: string; graphId?: string } }
  | { op: "disconnect"; connectorId: string }
  | { op: "set-component-pin"; nodeId: string; pin: { publishedId: string; version: number; digest?: string } }
  | { op: "set-capabilities"; nodeId: string; granted: any[] }
  | { op: "set-placement"; nodeId: string; placement: string }
  | { op: "set-containment"; nodeId: string; containment: "isolate" | "worker" }
  | { op: "set-budget"; nodeId?: string; budget: any }
  | { op: "set-iac-desired"; nodeId: string; desired: any };

export interface OpError {
  code: "NOT_FOUND" | "CONFLICT" | "SCHEMA_INVALID";
  message: string;
  index: number;
  nodeId?: string;
  field?: string;
}

export interface ApplyResult {
  ok: boolean;
  projection: any;
  errors: OpError[];
  /** Node ids the operations touched, for impact reporting. */
  touched: string[];
}

/**
 * What a node draws before anyone has drawn anything in it: its name, in a
 * card.
 *
 * Not nothing.  An empty `vue` compiles to a component that renders nothing,
 * and the editor draws no body of its own, so the node is two ports and a
 * hairline — nothing to read, and, as the owner put it, nothing to take hold
 * of to move it.  A node that has not been given a face still has a name, and
 * the name is enough to find it, drag it and know what it is.
 */
const DEFAULT_VUE_TEMPLATE = `<template>
  <v-card width="200" density="compact">
    <v-card-title class="text-body-2 py-1">{{ node.properties.name }}</v-card-title>
  </v-card>
</template>
<script>
export default { props: { node: Object, state: Object } };
</script>
`;

const PROTECTED_NODE_PROPS = ["component", "capabilities", "placement", "containment", "budget", "budgets", "iac", "tests"];
const PROTECTED_GRAPH_KEYS = ["id"];

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function newConnectorId(seed: string): string {
  // deterministic for the same proposal input, so re-validation yields the same bytes
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const hex = h.toString(16).padStart(8, "0");
  return `${hex}-${seed.length.toString(16).padStart(4, "0")}-4c0f-8${hex.slice(0, 3)}-${(seed.length * 2654435761 >>> 0).toString(16).padStart(12, "0").slice(0, 12)}`;
}

function port(p: any): any {
  return { name: p.name, type: p.type || "Object", external: !!p.external, visible: p.visible === undefined ? true : !!p.visible };
}

/** Apply operations to a copy of the projection.  Never mutates the input. */
export function applyOps(projection: any, ops: MutationOp[]): ApplyResult {
  const graph = clone(projection);
  const errors: OpError[] = [];
  const touched = new Set<string>();
  const nodeById = (id: string) => (graph.nodes || []).find((n: any) => n && n.id === id);
  const fail = (index: number, code: OpError["code"], message: string, nodeId?: string, field?: string) => {
    errors.push({ code, message, index, nodeId, field });
  };
  graph.nodes = graph.nodes || [];
  for (let index = 0; index < ops.length; index++) {
    const op: any = ops[index];
    switch (op.op) {
      case "add-node": {
        const n = op.node || {};
        if (!n.id || !n.url) { fail(index, "SCHEMA_INVALID", "add-node needs id and url"); break; }
        if (nodeById(n.id)) { fail(index, "CONFLICT", `node ${n.id} already exists`, n.id); break; }
        if (graph.nodes.some((x: any) => x.url === n.url)) { fail(index, "CONFLICT", `url ${n.url} is already used`, n.id); break; }
        const outputs = (n.outputs || []).map(port);
        const layout = n.layout || {};
        const now = Date.now();
        graph.nodes.push({
          id: n.id, url: n.url, version: graph.version || 0, graphId: graph.id, artifact: null, data: null,
          edges: outputs.map((o: any) => ({ field: o.name, connectors: [] })),
          properties: {
            inputs: (n.inputs || []).map(port), outputs, groups: [], name: n.name || n.url, description: "", tags: [], icon: "mdi-node-rectangle",
            positionAbsolute: false, appearsInPresentation: false, appearsInExport: false, createdOn: now, lastUpdate: now,
            x: layout.x || 0, y: layout.y || 0, z: layout.z || 0, presentation: { x: layout.x || 0, y: layout.y || 0, z: layout.z || 0 },
            ...(n.placement ? { placement: n.placement } : {}),
          },
          // A node always has something to render.  An empty `vue` template
          // compiles to nothing and the editor shows the node as an error, so
          // a node proposed by an agent gets the same empty component the
          // editor gives a node someone adds by hand.
          template: { set: (n.template && n.template.set) || "", vue: (n.template && n.template.vue) || DEFAULT_VUE_TEMPLATE },
        });
        touched.add(n.id);
        break;
      }
      case "remove-node": {
        const n = nodeById(op.nodeId);
        if (!n) { fail(index, "NOT_FOUND", `no node ${op.nodeId}`, op.nodeId); break; }
        graph.nodes = graph.nodes.filter((x: any) => x.id !== op.nodeId);
        // connectors into the removed node go with it, as the editor does
        graph.nodes.forEach((x: any) => (x.edges || []).forEach((e: any) => { e.connectors = (e.connectors || []).filter((c: any) => c.nodeId !== op.nodeId); }));
        touched.add(op.nodeId);
        break;
      }
      case "set-node-code": {
        const n = nodeById(op.nodeId);
        if (!n) { fail(index, "NOT_FOUND", `no node ${op.nodeId}`, op.nodeId); break; }
        if (op.template !== "set" && op.template !== "vue") { fail(index, "SCHEMA_INVALID", "template must be set or vue", op.nodeId); break; }
        n.template = n.template || { set: "", vue: "" };
        n.template[op.template] = String(op.text);
        touched.add(op.nodeId);
        break;
      }
      case "set-node-props": {
        const n = nodeById(op.nodeId);
        if (!n) { fail(index, "NOT_FOUND", `no node ${op.nodeId}`, op.nodeId); break; }
        const patch = op.patch || {};
        const bad = Object.keys(patch).filter((k) => PROTECTED_NODE_PROPS.includes(k));
        if (bad.length) { fail(index, "SCHEMA_INVALID", `${bad.join(", ")} must be set through their own operations`, op.nodeId); break; }
        n.properties = n.properties || {};
        if (Array.isArray(patch.outputs)) {
          // renaming an output renames its edge, as the editor's Rename IO does
          const before = (n.properties.outputs || []).map((p: any) => p.name);
          const after = patch.outputs.map((p: any) => p.name);
          n.edges = n.edges || [];
          after.forEach((name: string, i: number) => {
            const old = before[i];
            if (old && old !== name) {
              const edge = n.edges.find((e: any) => e.field === old);
              if (edge) edge.field = name;
            }
            if (!n.edges.some((e: any) => e.field === name)) n.edges.push({ field: name, connectors: [] });
          });
          n.edges = n.edges.filter((e: any) => after.includes(e.field));
        }
        if (Array.isArray(patch.inputs)) {
          const before = (n.properties.inputs || []).map((p: any) => p.name);
          const after = patch.inputs.map((p: any) => p.name);
          after.forEach((name: string, i: number) => {
            const old = before[i];
            if (old && old !== name) {
              graph.nodes.forEach((x: any) => (x.edges || []).forEach((e: any) => (e.connectors || []).forEach((c: any) => { if (c.nodeId === n.id && c.field === old) c.field = name; })));
            }
          });
        }
        Object.keys(patch).forEach((k) => {
          n.properties[k] = k === "inputs" || k === "outputs" ? patch[k].map(port) : patch[k];
        });
        touched.add(op.nodeId);
        break;
      }
      case "set-graph-props": {
        const patch = op.patch || {};
        const bad = Object.keys(patch).filter((k) => PROTECTED_GRAPH_KEYS.includes(k));
        if (bad.length) { fail(index, "SCHEMA_INVALID", `${bad.join(", ")} cannot be changed`); break; }
        graph.properties = { ...(graph.properties || {}), ...patch };
        break;
      }
      case "connect": {
        const from = nodeById(op.from && op.from.nodeId);
        if (!from) { fail(index, "NOT_FOUND", `no node ${op.from && op.from.nodeId}`, op.from && op.from.nodeId); break; }
        const edge = (from.edges || []).find((e: any) => e.field === op.from.field);
        if (!edge) { fail(index, "NOT_FOUND", `node ${from.id} has no output ${op.from.field}`, from.id, op.from.field); break; }
        const targetGraphId = (op.to && op.to.graphId) || graph.id;
        if (targetGraphId === graph.id) {
          const to = nodeById(op.to.nodeId);
          if (!to) { fail(index, "NOT_FOUND", `no node ${op.to.nodeId}`, op.to.nodeId); break; }
          if (!((to.properties && to.properties.inputs) || []).some((p: any) => p.name === op.to.field)) { fail(index, "NOT_FOUND", `node ${to.id} has no input ${op.to.field}`, to.id, op.to.field); break; }
        }
        if ((edge.connectors || []).some((c: any) => c.nodeId === op.to.nodeId && c.field === op.to.field && (c.graphId || graph.id) === targetGraphId)) {
          fail(index, "CONFLICT", `${from.id}.${op.from.field} is already connected to ${op.to.nodeId}.${op.to.field}`, from.id, op.from.field); break;
        }
        edge.connectors = edge.connectors || [];
        edge.connectors.push({ id: newConnectorId(`${graph.id}|${from.id}|${op.from.field}|${targetGraphId}|${op.to.nodeId}|${op.to.field}|${index}`), nodeId: op.to.nodeId, field: op.to.field, graphId: targetGraphId, version: graph.version || 0 });
        touched.add(from.id); touched.add(op.to.nodeId);
        break;
      }
      case "disconnect": {
        let found = false;
        graph.nodes.forEach((x: any) => (x.edges || []).forEach((e: any) => {
          const before = (e.connectors || []).length;
          e.connectors = (e.connectors || []).filter((c: any) => c.id !== op.connectorId);
          if (e.connectors.length !== before) { found = true; touched.add(x.id); }
        }));
        if (!found) fail(index, "NOT_FOUND", `no connector ${op.connectorId}`);
        break;
      }
      case "set-component-pin": {
        const n = nodeById(op.nodeId);
        if (!n) { fail(index, "NOT_FOUND", `no node ${op.nodeId}`, op.nodeId); break; }
        n.properties = n.properties || {};
        n.properties.component = { publishedId: op.pin.publishedId, version: op.pin.version, ...(op.pin.digest ? { digest: op.pin.digest } : {}) };
        touched.add(op.nodeId);
        break;
      }
      case "set-capabilities": {
        const n = nodeById(op.nodeId);
        if (!n) { fail(index, "NOT_FOUND", `no node ${op.nodeId}`, op.nodeId); break; }
        n.properties = n.properties || {};
        n.properties.capabilities = clone(op.granted || []);
        touched.add(op.nodeId);
        break;
      }
      case "set-containment": {
        const n = nodeById(op.nodeId);
        if (!n) break;
        if (op.containment !== "isolate" && op.containment !== "worker") {
          errors.push({ code: "SCHEMA_INVALID", message: `containment is isolate or worker, not ${op.containment}`, index });
          break;
        }
        n.properties = n.properties || {};
        n.properties.containment = op.containment;
        touched.add(op.nodeId);
        break;
      }
      case "set-placement": {
        const n = nodeById(op.nodeId);
        if (!n) { fail(index, "NOT_FOUND", `no node ${op.nodeId}`, op.nodeId); break; }
        n.properties = n.properties || {};
        n.properties.placement = op.placement;
        touched.add(op.nodeId);
        break;
      }
      case "set-budget": {
        if (op.nodeId) {
          const n = nodeById(op.nodeId);
          if (!n) { fail(index, "NOT_FOUND", `no node ${op.nodeId}`, op.nodeId); break; }
          n.properties = n.properties || {};
          n.properties.budget = clone(op.budget);
          touched.add(op.nodeId);
        } else {
          graph.properties = { ...(graph.properties || {}), budget: clone(op.budget) };
        }
        break;
      }
      case "set-iac-desired": {
        const n = nodeById(op.nodeId);
        if (!n) { fail(index, "NOT_FOUND", `no node ${op.nodeId}`, op.nodeId); break; }
        n.properties = n.properties || {};
        n.properties.iac = clone(op.desired);
        touched.add(op.nodeId);
        break;
      }
      default:
        fail(index, "SCHEMA_INVALID", `unknown operation ${op && op.op}`);
    }
    if (errors.length) break;
  }
  return { ok: errors.length === 0, projection: graph, errors, touched: Array.from(touched) };
}
