import { describe, it, expect } from "vitest";
import { fromJSON, toJSON } from "../codec";
import { reconcile } from "../reconcile";
import { applyOps } from "../ops";
import { semanticDiff } from "../diff";
import { makeGraph, makeNode, makeConnector, copy } from "./fixtures";

describe("applyOps", () => {
  it("adds, wires, edits and removes nodes, and the result reconciles into a document like an editor change", () => {
    const graph = makeGraph({ nodes: [makeNode({ id: "a" })] });
    const r = applyOps(graph, [
      { op: "add-node", node: { id: "b", url: "b", name: "B", inputs: [{ name: "in" }], outputs: [{ name: "out" }], template: { set: "edges.out = value;" }, layout: { x: 100, y: 50 } } },
      { op: "connect", from: { nodeId: "a", field: "output" }, to: { nodeId: "b", field: "in" } },
      { op: "set-node-code", nodeId: "b", template: "set", text: "edges.out = value * 2;" },
      { op: "set-graph-props", patch: { description: "wired" } },
    ]);
    expect(r.ok).toBe(true);
    expect(r.projection.nodes.map((n: any) => n.id)).toEqual(["a", "b"]);
    expect(r.projection.nodes[0].edges[0].connectors).toEqual([expect.objectContaining({ nodeId: "b", field: "in", graphId: "graph-1" })]);
    expect(r.projection.nodes[1].template.set).toBe("edges.out = value * 2;");
    // a node with no view of its own still draws its name: a div with no
    // content has no height, and left the node invisible and unmovable
    expect(r.projection.nodes[1].template.vue).toContain("node.properties.name");
    expect(r.projection.nodes[1].properties.x).toBe(100);
    expect(r.touched.sort()).toEqual(["a", "b"]);
    expect(graph.nodes).toHaveLength(1);   // input untouched
    const doc = fromJSON(copy(graph));
    expect(reconcile(doc, r.projection)).toBe(true);
    const d = semanticDiff(toJSON(fromJSON(copy(graph))), toJSON(doc));
    expect(d.nodesAdded).toEqual(["b"]);
    expect(d.connectorsAdded).toHaveLength(1);
    expect(d.namespaces).toEqual(["definition"]);
  });

  it("is deterministic: the same ops on the same graph give the same connector ids", () => {
    const graph = makeGraph({ nodes: [makeNode({ id: "a" }), makeNode({ id: "b" })] });
    const ops = [{ op: "connect", from: { nodeId: "a", field: "output" }, to: { nodeId: "b", field: "input" } }] as any;
    expect(applyOps(graph, ops).projection.nodes[0].edges[0].connectors[0].id).toBe(applyOps(graph, ops).projection.nodes[0].edges[0].connectors[0].id);
  });

  it("stops at the first failing operation and names it", () => {
    const graph = makeGraph({ nodes: [makeNode({ id: "a" })] });
    const r = applyOps(graph, [
      { op: "set-node-code", nodeId: "a", template: "set", text: "x" },
      { op: "connect", from: { nodeId: "a", field: "output" }, to: { nodeId: "missing", field: "in" } },
      { op: "remove-node", nodeId: "a" },
    ]);
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual([{ code: "NOT_FOUND", message: "no node missing", index: 1, nodeId: "missing", field: undefined }]);
    expect(r.projection.nodes).toHaveLength(1);
  });

  it("renaming ports through set-node-props renames edges and connectors like the editor's Rename IO", () => {
    const a = makeNode({ id: "a" });
    (a.edges[0].connectors as any[]).push(makeConnector({ id: "c1", nodeId: "b", field: "input" }));
    const graph = makeGraph({ nodes: [a, makeNode({ id: "b" })] });
    const r = applyOps(graph, [
      { op: "set-node-props", nodeId: "a", patch: { outputs: [{ name: "result" }] } },
      { op: "set-node-props", nodeId: "b", patch: { inputs: [{ name: "value" }] } },
    ]);
    expect(r.ok).toBe(true);
    expect(r.projection.nodes[0].edges[0].field).toBe("result");
    expect(r.projection.nodes[0].edges[0].connectors[0].field).toBe("value");
  });

  it("privilege and pins have their own operations; set-node-props refuses them", () => {
    const graph = makeGraph({ nodes: [makeNode({ id: "a" })] });
    expect(applyOps(graph, [{ op: "set-node-props", nodeId: "a", patch: { placement: "server" } }]).errors[0].code).toBe("SCHEMA_INVALID");
    const r = applyOps(graph, [
      { op: "set-placement", nodeId: "a", placement: "server" },
      { op: "set-capabilities", nodeId: "a", granted: ["net:https"] },
      { op: "set-component-pin", nodeId: "a", pin: { publishedId: "p", version: 3 } },
    ]);
    expect(r.ok).toBe(true);
    expect(r.projection.nodes[0].properties).toMatchObject({ placement: "server", capabilities: ["net:https"], component: { publishedId: "p", version: 3 } });
    const d = semanticDiff(graph, r.projection);
    expect(d.namespaces).toEqual(["capabilities", "definition", "placement"]);
    expect(d.privilegeDelta.placementToServer).toEqual(["a"]);
  });

  it("removing a node drops connectors into it; disconnect needs a real connector", () => {
    const a = makeNode({ id: "a" });
    (a.edges[0].connectors as any[]).push(makeConnector({ id: "c1", nodeId: "b", field: "input" }));
    const graph = makeGraph({ nodes: [a, makeNode({ id: "b" })] });
    const r = applyOps(graph, [{ op: "remove-node", nodeId: "b" }]);
    expect(r.projection.nodes).toHaveLength(1);
    expect(r.projection.nodes[0].edges[0].connectors).toEqual([]);
    expect(applyOps(graph, [{ op: "disconnect", connectorId: "nope" }]).errors[0].code).toBe("NOT_FOUND");
    expect(applyOps(graph, [{ op: "disconnect", connectorId: "c1" }]).projection.nodes[0].edges[0].connectors).toEqual([]);
  });
});

describe("a node an agent adds is a node a person can see", () => {
  /**
   * It used to be added with `<template><div></div></template>`, to dodge an
   * SFC parser error on empty input.  The error was fixed at the compiler, and
   * a div with no content has no height — so the node was on the canvas,
   * drawn, and invisible: two ports and a hairline, nothing to click.  Empty is
   * what the editor's own nodes carry, and the editor draws its body for them.
   */
  it("draws its own name, so there is something to read and something to drag", () => {
    const graph = makeGraph({ nodes: [makeNode({ id: "a" })] });
    const r = applyOps(graph, [{ op: "add-node", node: { id: "fresh", url: "fresh", name: "Fresh" } }]);
    expect(r.ok).toBe(true);
    const node = r.projection.nodes.find((n: any) => n.id === "fresh");
    expect(node.template.vue).toContain("v-card");
    expect(node.template.vue).toContain("node.properties.name");
    expect(node.template.set).toBe("");
  });

  it("keeps a view the caller asked for", () => {
    const graph = makeGraph({ nodes: [makeNode({ id: "a" })] });
    const r = applyOps(graph, [{ op: "add-node", node: { id: "drawn", url: "drawn", template: { vue: "<template><b>hello</b></template>" } } }]);
    expect(r.projection.nodes.find((n: any) => n.id === "drawn").template.vue).toBe("<template><b>hello</b></template>");
  });
});
