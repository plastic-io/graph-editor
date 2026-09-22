import type { Page } from "@playwright/test";
import { SERVER } from "../hybrid/harness";

/**
 * The graphs these tests run, built the way a person builds them: in the
 * editor, through the same store action every edit goes through.
 *
 * The component is a graph with two **external** ports — what publishing turns
 * into its contract, and what a host wires to — a field that leaves on two
 * connectors at once, and a node carrying the published component itself.
 */

const port = (name: string, external = false) => ({ name, type: "Object", external, visible: true });

export interface NodeSpec {
  id: string;
  set?: string;
  inputs?: any[];
  outputs?: any[];
  edges?: any[];
  linkedGraph?: any;
  properties?: Record<string, any>;
}

/** What the editor's import produces for a published graph (mutation.ts addGraphItem). */
export function importedNode(id: string, publishedId: string, version: number, artifact: any | null, manifest: any, over: Partial<NodeSpec> = {}): NodeSpec {
  const fields = externalFields(artifact || embeddedShapeOf(manifest));
  return {
    id,
    inputs: Object.keys(fields.inputs).map((name) => ({ ...port(name), type: "Object" })),
    outputs: Object.keys(fields.outputs).map((name) => port(name)),
    edges: Object.keys(fields.outputs).map((name) => ({ field: name, connectors: [] as any[] })),
    linkedGraph: {
      id: publishedId,
      version,
      revisionId: manifest && manifest.provenance && manifest.provenance.fromGraph ? manifest.provenance.fromGraph.revisionId : undefined,
      data: {},
      // A link that carries its graph is one flattening can resolve; one that
      // does not is a call the runtime makes when a value arrives.
      loaded: !!artifact,
      graph: artifact || undefined,
      properties: {},
      fields,
    },
    properties: {
      icon: "mdi-lan",
      name: id,
      component: manifest ? { publishedId: manifest.publishedId, version: manifest.version, digest: manifest.digest } : undefined,
    },
    ...over,
  };
}

/** The same rule the editor uses: a port marked external is a published edge. */
function externalFields(graph: any) {
  const inputs: Record<string, any> = {};
  const outputs: Record<string, any> = {};
  ((graph && graph.nodes) || []).forEach((n: any) => {
    (((n.properties || {}).inputs) || []).forEach((p: any) => {
      if (p.external) inputs[p.name] = { id: n.id, field: p.name, type: p.type, visible: true, external: false };
    });
    (((n.properties || {}).outputs) || []).forEach((p: any) => {
      if (p.external) outputs[p.name] = { id: n.id, field: p.name, type: p.type, visible: true, external: false };
    });
  });
  return { inputs, outputs };
}

/** For a by-reference import there is no copy to read the contract from. */
function embeddedShapeOf(manifest: any) {
  const nodes = (kind: "inputs" | "outputs") => (manifest && manifest.contract && manifest.contract[kind] ? manifest.contract[kind] : [])
    .map((p: any) => ({ id: p.nodeId, properties: { [kind]: [{ ...p, external: true }] } }));
  return { nodes: nodes("inputs").concat(nodes("outputs")) };
}

/** Add nodes to the open graph through the editor's own commit path. */
async function addNodes(page: Page, specs: NodeSpec[], name: string) {
  await page.evaluate(async ({ specs, name }: any) => {
    const app: any = document.querySelector("#app");
    const pinia = app.__vue_app__.config.globalProperties.$pinia;
    const graph = pinia._s.get("graph");
    const graphId = graph.graphSnapshot.id;
    specs.forEach((spec: any) => {
      graph.graphSnapshot.nodes.push({
        id: spec.id,
        url: spec.id,
        edges: spec.edges || [{ field: "out", connectors: [] }],
        version: 0,
        graphId,
        artifact: null,
        data: null,
        ...(spec.linkedGraph ? { linkedGraph: spec.linkedGraph } : {}),
        properties: {
          inputs: spec.inputs || [{ name: "in", type: "Object", external: false, visible: true }],
          outputs: spec.outputs || [{ name: "out", type: "Object", external: false, visible: true }],
          groups: [],
          name: spec.id,
          description: "",
          createdOn: Date.now(),
          lastUpdate: Date.now(),
          tags: [],
          icon: "mdi-node-rectangle",
          positionAbsolute: false,
          appearsInPresentation: false,
          appearsInExport: false,
          x: 0, y: 0, z: 0,
          presentation: { x: 0, y: 0, z: 0, order: 0 },
          ...(spec.properties || {}),
        },
        template: { set: spec.set || "", vue: "" },
      });
    });
    graph.graphSnapshot.properties.name = name;
    await graph.updateGraphFromSnapshot("Build " + name);
  }, { specs, name });
  await page.waitForTimeout(1500);
}

const connector = (nodeId: string, field: string, graphId: string) =>
  ({ id: `c-${nodeId}-${field}-${Math.random().toString(36).slice(2, 7)}`, nodeId, field, graphId, version: 0 });

/**
 * The component.  `in` is the published way in; `echo` the published way out;
 * `tick` leaves `in` on **two** connectors at once; `call` carries this same
 * published graph, which is what makes running it recursion.
 */
export async function buildComponent(page: Page, graphId: string) {
  const visit = `
    var path = instance ? instance.path.join("/") : "";
    var depth = instance ? instance.depth : 0;
    if (instance) { instance.state.mine = (instance.state.mine || 0) + 1; }
    var seen = {path: path, depth: depth, node: node.id, n: value.n, tag: value.tag, mine: instance ? instance.state.mine : 0};
    host.emit("visit", seen);
    state.visits = (state.visits || []).concat([seen]);
    edges.out = {path: path, depth: depth, n: value.n};
  `;
  await addNodes(page, [
    {
      id: "in",
      set: "edges.tick = {n: value.n, tag: value.tag};",
      inputs: [port("in", true)],                       // the published way in
      outputs: [port("tick")],
      edges: [{ field: "tick", connectors: [connector("echo", "in", graphId), connector("down", "in", graphId)] }],
    },
    {
      id: "echo",
      set: visit,
      inputs: [port("in")],
      outputs: [port("out", true)],                     // the published way out
      edges: [{ field: "out", connectors: [] }],
    },
    {
      id: "down",
      set: "if (value.n > 0) { edges.go = {n: value.n - 1, tag: value.tag}; }",
      inputs: [port("in")],
      outputs: [port("go")],
      edges: [{ field: "go", connectors: [connector("call", "in", graphId)] }],
    },
    {
      id: "call",
      inputs: [port("in")],
      outputs: [port("out")],
      edges: [{ field: "out", connectors: [connector("collect", "in", graphId)] }],
      linkedGraph: {
        id: graphId, version: 1, loaded: false, data: {}, properties: {},
        fields: { inputs: { in: { id: "in", field: "in" } }, outputs: { out: { id: "echo", field: "out" } } },
      },
      properties: { icon: "mdi-lan" },
    },
    {
      id: "collect",
      set: `state.returns = (state.returns || []).concat([{node: node.id, from: value.path, depth: value.depth}]); host.emit("returned", value);`,
      inputs: [port("in")],
      outputs: [],
      edges: [],
    },
  ], "Ripple");
}

/** The host: one field out to both imported copies, and one node they both reach. */
export async function buildHost(page: Page, graphId: string, imports: NodeSpec[]) {
  const wired = imports.map((spec) => ({
    ...spec,
    edges: (spec.edges || []).map((edge: any) => ({ ...edge, connectors: [connector("done", "in", graphId)] })),
  }));
  await addNodes(page, [
    {
      id: "start",
      set: "edges.into = {n: value.n, tag: value.tag};",
      inputs: [port("in")],
      outputs: [port("into")],
      edges: [{ field: "into", connectors: imports.map((spec) => connector(spec.id, "in", graphId)) }],
    },
    ...wired,
    {
      id: "done",
      set: `state.done = (state.done || []).concat([{from: value.path, depth: value.depth, n: value.n}]); host.emit("done", value);`,
      inputs: [port("in")],
      outputs: [],
      edges: [],
    },
  ], "Ripple host");
}

/* ------------------------------------------------------------------ *
 * running it
 * ------------------------------------------------------------------ */

/** Publish the open graph as a component; the version is its revision's seq. */
export async function publish(graphId: string): Promise<any> {
  const response = await fetch(`${SERVER}/crdt/${graphId}/publish`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: "e2e" }),
  });
  const body = await response.json();
  if (!body.manifest) {
    throw new Error(`publish failed: ${JSON.stringify(body)}`);
  }
  return body.manifest;
}

/** Run it on the server, the way the deployed server runs one. */
export async function runThere(graphId: string, nodeUrl: string, value: any): Promise<any> {
  const response = await fetch(`${SERVER}/debug/run`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ graphId, nodeUrl, field: "in", value }),
  });
  return await response.json();
}

/**
 * Run it in this browser through the same entry a node template uses, so the
 * execution has an id the editor can find it by and the observations reach the
 * server the way a real run does.
 */
export async function runHere(page: Page, nodeUrl: string, value: any): Promise<string> {
  return await page.evaluate(({ nodeUrl, value }: any) => {
    const app: any = document.querySelector("#app");
    const orchestrator: any = app.__vue_app__.config.globalProperties.$pinia._s.get("orchestrator");
    return orchestrator.scheduler.instance.url(nodeUrl, value, "in");
  }, { nodeUrl, value });
}

/** What each instance said it saw, from the execution's own observations. */
export async function observed(graph: string, executionId: string, kind: string) {
  const detail = await (await fetch(`${SERVER}/crdt/${graph}/executions/${executionId}`)).json();
  return (detail.observations || [])
    .filter((o: any) => o.kind === "custom" && o.payload && o.payload.kind === kind)
    .map((o: any) => (o.payload.data && o.payload.data.value !== undefined ? o.payload.data.value : o.payload.data));
}
