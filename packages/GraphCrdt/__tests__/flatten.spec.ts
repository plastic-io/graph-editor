import { describe, it, expect } from "vitest";
import { flattenLinkedGraphs, qualify } from "../flatten";

/**
 * Linked graphs, flattened (plan §4.2, PB-046).
 *
 * These are the cases the two hand-written copies of this got wrong or never
 * reached: a subgraph used twice, a subgraph with more than one input, and a
 * graph that contains itself.
 */
const port = (name: string) => ({ name, type: "Object", external: false, visible: true });
const node = (id: string, over: any = {}) => ({
  id,
  url: id,
  edges: over.edges || [{ field: "out", connectors: [] }],
  version: 0,
  graphId: over.graphId || "outer",
  artifact: null,
  data: null,
  properties: {
    inputs: [port("in")], outputs: [port("out")], groups: [], name: id, description: "",
    tags: [], icon: "", x: 0, y: 0, z: 0, createdOn: 1, presentation: { x: 0, y: 0, z: 0 },
    ...(over.properties || {}),
  },
  template: { set: over.set || "edges.out = value;", vue: "" },
  ...(over.linkedGraph ? { linkedGraph: over.linkedGraph } : {}),
});
const connector = (nodeId: string, field = "in") => ({ id: `c-${nodeId}-${field}`, nodeId, field, graphId: "outer", version: 0 });
const graph = (id: string, nodes: any[]) => ({ id, url: id, version: 0, nodes, properties: { name: id, description: "" } });

/** A subgraph with one way in and one way out. */
const inner = (id = "inner") => graph(id, [
  node("in-node", { graphId: id }),
  node("out-node", { graphId: id }),
]);

const linkedNode = (id: string, innerGraph: any, over: any = {}) => node(id, {
  ...over,
  linkedGraph: {
    id: innerGraph.id,
    version: 1,
    loaded: true,
    graph: innerGraph,
    fields: over.fields || {
      inputs: { in: { id: "in-node", field: "in" } },
      outputs: { out: { id: "out-node", field: "out" } },
    },
  },
});

describe("flattening a graph that carries another", () => {
  it("brings the inner nodes in, named by the host they came through", async () => {
    const outer = graph("outer", [
      node("entry", { edges: [{ field: "out", connectors: [connector("host")] }] }),
      linkedNode("host", inner()),
    ]);
    const { graph: flat, instances, warnings } = await flattenLinkedGraphs(outer);
    expect(warnings).toEqual([]);
    expect(flat.nodes.map((n: any) => n.id).sort()).toEqual(["entry", "host", "host/in-node", "host/out-node"]);
    expect(instances).toEqual([{ nodeId: "host", graphId: "inner", instancePath: ["host"] }]);
    // an inner node says which instance it belongs to
    const innerNode = flat.nodes.find((n: any) => n.id === "host/in-node");
    expect(innerNode).toMatchObject({ instancePath: ["host"], originalId: "in-node" });
  });

  it("aims what pointed at the host at the inner node that stands for that input", async () => {
    const outer = graph("outer", [
      node("entry", { edges: [{ field: "out", connectors: [connector("host")] }] }),
      linkedNode("host", inner()),
    ]);
    const { graph: flat } = await flattenLinkedGraphs(outer);
    const entry = flat.nodes.find((n: any) => n.id === "entry");
    expect(entry.edges[0].connectors[0]).toMatchObject({ nodeId: "host/in-node", field: "in" });
  });

  it("moves what left the host's output onto the inner node that produces it", async () => {
    const outer = graph("outer", [
      linkedNode("host", inner(), { edges: [{ field: "out", connectors: [connector("tail")] }] }),
      node("tail"),
    ]);
    const { graph: flat } = await flattenLinkedGraphs(outer);
    const host = flat.nodes.find((n: any) => n.id === "host");
    const produced = flat.nodes.find((n: any) => n.id === "host/out-node");
    expect(host.edges[0].connectors).toEqual([]);      // nothing leaves the shell
    expect(produced.edges.find((e: any) => e.field === "out").connectors[0]).toMatchObject({ nodeId: "tail" });
  });

  it("wires a subgraph with two ways in by the name of each, not by position", async () => {
    const two = graph("two-ways", [
      node("left", { graphId: "two-ways" }),
      node("right", { graphId: "two-ways" }),
    ]);
    const outer = graph("outer", [
      node("a", { edges: [{ field: "out", connectors: [connector("host", "second")] }] }),
      node("b", { edges: [{ field: "out", connectors: [connector("host", "first")] }] }),
      linkedNode("host", two, {
        fields: {
          inputs: { first: { id: "left", field: "in" }, second: { id: "right", field: "in" } },
          outputs: {},
        },
      }),
    ]);
    const { graph: flat } = await flattenLinkedGraphs(outer);
    const from = (id: string) => flat.nodes.find((n: any) => n.id === id).edges[0].connectors[0];
    expect(from("a")).toMatchObject({ nodeId: "host/right" });
    expect(from("b")).toMatchObject({ nodeId: "host/left" });
  });

  it("keeps two uses of one subgraph apart", async () => {
    const shared = inner("shared");
    const outer = graph("outer", [
      node("entry", { edges: [{ field: "out", connectors: [connector("first"), connector("second")] }] }),
      linkedNode("first", shared),
      linkedNode("second", shared),
    ]);
    const { graph: flat, instances } = await flattenLinkedGraphs(outer);
    expect(flat.nodes.map((n: any) => n.id).sort()).toEqual([
      "entry", "first", "first/in-node", "first/out-node", "second", "second/in-node", "second/out-node",
    ]);
    const entry = flat.nodes.find((n: any) => n.id === "entry");
    expect(entry.edges[0].connectors.map((c: any) => c.nodeId)).toEqual(["first/in-node", "second/in-node"]);
    expect(instances.map((i: any) => i.instancePath)).toEqual([["first"], ["second"]]);
  });

  it("keeps a connector inside a subgraph pointing inside it, and names the graph that runs", async () => {
    const wired = graph("wired", [
      node("first", { graphId: "wired", edges: [{ field: "out", connectors: [{ id: "inner-c", nodeId: "second", field: "in", graphId: "wired", version: 0 }] }] }),
      node("second", { graphId: "wired" }),
    ]);
    const outer = graph("outer", [linkedNode("host", wired, {
      fields: { inputs: { in: { id: "first", field: "in" } }, outputs: {} },
    })]);
    const { graph: flat } = await flattenLinkedGraphs(outer);
    const first = flat.nodes.find((n: any) => n.id === "host/first");
    expect(first.edges[0].connectors[0]).toMatchObject({ nodeId: "host/second", graphId: "outer" });
    // the node remembers where it came from without the scheduler going to look
    expect(first).toMatchObject({ graphId: "outer", originalGraphId: "wired" });
  });

  it("goes as deep as the nesting does", async () => {
    const deepest = graph("deepest", [node("leaf", { graphId: "deepest" })]);
    const middle = graph("middle", [
      linkedNode("nested", deepest, { fields: { inputs: { in: { id: "leaf", field: "in" } }, outputs: {} } }),
    ]);
    const outer = graph("outer", [
      node("entry", { edges: [{ field: "out", connectors: [connector("host")] }] }),
      linkedNode("host", middle, { fields: { inputs: { in: { id: "nested", field: "in" } }, outputs: {} } }),
    ]);
    const { graph: flat, warnings } = await flattenLinkedGraphs(outer);
    expect(warnings).toEqual([]);
    expect(flat.nodes.map((n: any) => n.id).sort()).toEqual(["entry", "host", "host/nested", "host/nested/leaf"]);
    // the way in reaches all the way down
    const entry = flat.nodes.find((n: any) => n.id === "entry");
    expect(entry.edges[0].connectors[0].nodeId).toBe("host/nested/leaf");
  });
});

describe("what cannot be flattened is said, not attempted", () => {
  it("names the path when a graph contains itself", async () => {
    const self: any = graph("loop", []);
    self.nodes.push(linkedNode("again", self));
    const { graph: flat, warnings } = await flattenLinkedGraphs(self);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ code: "LINKED_GRAPH_CYCLE", nodeId: "again", graphId: "loop" });
    expect(warnings[0].message).toContain("cannot be run inside itself");
    expect(flat.nodes.map((n: any) => n.id)).toEqual(["again"]);
  });

  it("names the path when two graphs contain each other", async () => {
    const a: any = graph("a", []);
    const b: any = graph("b", []);
    a.nodes.push(linkedNode("to-b", b));
    b.nodes.push(linkedNode("to-a", a));
    const { warnings } = await flattenLinkedGraphs(a);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe("LINKED_GRAPH_CYCLE");
    expect(warnings[0].path).toEqual(["a", "b", "a"]);
  });

  it("stops at the depth it was given and says where", async () => {
    const leaf = graph("leaf-3", [node("leaf", { graphId: "leaf-3" })]);
    const two = graph("level-2", [linkedNode("down", leaf)]);
    const one = graph("level-1", [linkedNode("down", two)]);
    // one link deep is allowed, so the second one is where it stops
    const { warnings } = await flattenLinkedGraphs(one, { maxDepth: 1 });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe("LINKED_GRAPH_TOO_DEEP");
    expect(warnings[0].nodeId).toBe("down/down");
  });

  it("says when the graph a node links to cannot be loaded", async () => {
    const outer = graph("outer", [linkedNode("host", inner())]);
    const { graph: flat, warnings } = await flattenLinkedGraphs(outer, { resolve: () => null });
    expect(warnings[0]).toMatchObject({ code: "LINKED_GRAPH_MISSING", nodeId: "host", graphId: "inner" });
    expect(warnings[0].message).toContain("nothing it contains will run");
    expect(flat.nodes.map((n: any) => n.id)).toEqual(["host"]);
  });

  it("asks for the graph rather than assuming the node carries it", async () => {
    const asked: string[] = [];
    const outer = graph("outer", [node("host", {
      linkedGraph: { id: "elsewhere", version: 2, fields: { inputs: {}, outputs: {} } },
    })]);
    const { graph: flat } = await flattenLinkedGraphs(outer, {
      resolve: async (n: any) => { asked.push(n.linkedGraph.id); return inner("elsewhere"); },
    });
    expect(asked).toEqual(["elsewhere"]);
    expect(flat.nodes.map((n: any) => n.id).sort()).toEqual(["host", "host/in-node", "host/out-node"]);
  });

  it("leaves the graph it was given alone", async () => {
    const outer = graph("outer", [
      node("entry", { edges: [{ field: "out", connectors: [connector("host")] }] }),
      linkedNode("host", inner()),
    ]);
    const before = JSON.stringify(outer);
    await flattenLinkedGraphs(outer);
    expect(JSON.stringify(outer)).toBe(before);
  });
});

describe("naming", () => {
  it("leaves the top level alone and qualifies what is inside", () => {
    expect(qualify("node", [])).toBe("node");
    expect(qualify("node", ["host"])).toBe("host/node");
    expect(qualify("node", ["host", "nested"])).toBe("host/nested/node");
  });
});

/**
 * A runtime that instantiates a linked graph when a value arrives at it
 * (plastic-io 2.3 and later) runs what flattening cannot: a graph that
 * contains itself, one instance per turn.  Flattening's job there is to get
 * out of the way and leave the link where the runtime will find it.
 */
describe("what a runtime that can make calls is given", () => {
  const selfReferential = () => {
    const self: any = graph("loop", []);
    self.nodes.push(linkedNode("again", self));
    return self;
  };

  it("keeps the link on the node so the runtime can call it", async () => {
    const { graph: flat, warnings } = await flattenLinkedGraphs(selfReferential(), { leaveForRuntime: true });
    const host = flat.nodes.find((n: any) => n.id === "again");
    expect(host.linkedGraph).toBeTruthy();
    expect(host.loadedGraph).toBeUndefined();
    expect(warnings[0].message).toContain("left for the runtime to call, one instance per turn");
  });

  it("drops it, as a flat-only runtime needs, when it is not asked to", async () => {
    const { graph: flat, warnings } = await flattenLinkedGraphs(selfReferential());
    const host = flat.nodes.find((n: any) => n.id === "again");
    expect(host.linkedGraph).toBeUndefined();
    expect(warnings[0].message).toContain("cannot be run inside itself");
  });

  it("leaves every link, not only the ones flattening could not resolve", async () => {
    // A copy inlined here is nodes, not a call: no instance, no state of its
    // own, and a different arrangement from the domain that had to load it.
    const outer = graph("outer", [
      node("entry", { edges: [{ field: "out", connectors: [connector("host")] }] }),
      linkedNode("host", inner()),
    ]);
    const { graph: flat, warnings, instances } = await flattenLinkedGraphs(outer, { leaveForRuntime: true });
    expect(warnings).toEqual([]);
    expect(flat.nodes.map((n: any) => n.id).sort()).toEqual(["entry", "host"]);
    expect(flat.nodes.find((n: any) => n.id === "host").linkedGraph).toBeTruthy();
    expect(instances).toEqual([{ nodeId: "host", graphId: "inner", instancePath: ["host"] }]);
  });

  it("flattens the same graph for a runtime that cannot call, exactly as before", async () => {
    const outer = graph("outer", [
      node("entry", { edges: [{ field: "out", connectors: [connector("host")] }] }),
      linkedNode("host", inner()),
    ]);
    const { graph: flat } = await flattenLinkedGraphs(outer);
    expect(flat.nodes.map((n: any) => n.id).sort()).toEqual(["entry", "host", "host/in-node", "host/out-node"]);
  });
});

describe("a link this side cannot resolve", () => {
  it("is left for a runtime that loads at the moment of the call", async () => {
    const outer = graph("outer", [node("host", {})]);
    (outer.nodes[0] as any).linkedGraph = {
      id: "elsewhere", version: 3,
      fields: { inputs: { in: { id: "inner", field: "in" } }, outputs: {} },
    };
    const { graph: flat, warnings } = await flattenLinkedGraphs(outer, { leaveForRuntime: true, resolve: () => null });
    expect(flat.nodes[0].linkedGraph).toMatchObject({ id: "elsewhere", version: 3 });
    // nothing failed: the link was never flattening's to resolve
    expect(warnings).toEqual([]);
  });

  it("is still dropped, with the reason, where nothing can call it", async () => {
    const outer = graph("outer", [node("host", {})]);
    (outer.nodes[0] as any).linkedGraph = { id: "elsewhere", version: 3, fields: { inputs: {}, outputs: {} } };
    const { graph: flat, warnings } = await flattenLinkedGraphs(outer, { resolve: () => null });
    expect(flat.nodes[0].linkedGraph).toBeUndefined();
    expect(warnings[0].message).toContain("nothing it contains will run");
  });
});
