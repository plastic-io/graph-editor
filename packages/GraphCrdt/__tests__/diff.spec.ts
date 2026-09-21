import { describe, it, expect } from "vitest";
import { fromJSON, toJSON } from "../codec";
import { reconcile } from "../reconcile";
import { semanticDiff, describeDiff } from "../diff";
import { makeGraph, makeNode, makeConnector, copy } from "./fixtures";

/** The diff as the server computes it: projections before and after one reconcile. */
function diffAfter(graph: any, mutate: (g: any) => void) {
  const doc = fromJSON(copy(graph));
  const before = toJSON(doc);
  const next = copy(graph);
  mutate(next);
  reconcile(doc, next);
  return semanticDiff(before, toJSON(doc));
}

describe("semanticDiff", () => {
  it("is empty when nothing changed", () => {
    const d = diffAfter(makeGraph(), () => {});
    expect(d.empty).toBe(true);
    expect(d.namespaces).toEqual([]);
    expect(describeDiff(d)).toBe("no change");
  });

  it("creating the graph is a seed of definition ops", () => {
    const graph = makeGraph({ nodes: [makeNode({ id: "n1" }), makeNode({ id: "n2" })] });
    const d = semanticDiff(null, toJSON(fromJSON(copy(graph))));
    expect(d.seed).toBe(true);
    expect(d.nodesAdded.sort()).toEqual(["n1", "n2"]);
    expect(d.ops.filter((o) => o.op === "add-node")).toHaveLength(2);
    expect(d.namespaces).toContain("definition");
    // `meta` is not part of the projection; the server's staging step reads it
    // straight off the documents (schemaVersionOf), so it is not in this diff.
    expect(d.namespaces).not.toContain("meta");
  });

  it("moving a node is layout only", () => {
    const graph = makeGraph({ nodes: [makeNode({ id: "n1" })] });
    const d = diffAfter(graph, (g) => { g.nodes[0].properties.x = 500; g.nodes[0].properties.presentation.x = 500; });
    expect(d.namespaces).toEqual(["layout"]);
    expect(d.ops).toEqual([{ op: "set-node-props", namespace: "layout", nodeId: "n1", keys: ["presentation", "x"] }]);
    expect(d.nodesChanged).toEqual(["n1"]);
  });

  it("editing code is the code namespace, per template field", () => {
    const graph = makeGraph({ nodes: [makeNode({ id: "n1" })] });
    const d = diffAfter(graph, (g) => { g.nodes[0].template.set = "edges.output = 1;"; });
    expect(d.namespaces).toEqual(["code"]);
    expect(d.ops).toEqual([{ op: "set-node-code", namespace: "code", nodeId: "n1", field: "template.set" }]);
  });

  it("renaming the graph and a node is definition", () => {
    const graph = makeGraph({ nodes: [makeNode({ id: "n1" })] });
    const d = diffAfter(graph, (g) => { g.properties.name = "renamed"; g.nodes[0].properties.name = "n"; });
    expect(d.namespaces).toEqual(["definition"]);
    expect(d.graphKeysChanged).toEqual(["properties.name"]);
    expect(d.ops).toEqual([
      { op: "set-graph-props", namespace: "definition", keys: ["name"] },
      { op: "set-node-props", namespace: "definition", nodeId: "n1", keys: ["name"] },
    ]);
  });

  it("wiring is definition; wiring into a server node is a privileged edge", () => {
    const a = makeNode({ id: "a" });
    const b = makeNode({ id: "b" });
    const graph = makeGraph({ nodes: [a, b] });
    const plain = diffAfter(graph, (g) => { (g.nodes[0].edges[0].connectors as any[]).push(makeConnector({ id: "c1", nodeId: "b" })); });
    expect(plain.namespaces).toEqual(["definition"]);
    expect(plain.connectorsAdded).toEqual([{ connectorId: "c1", from: { nodeId: "a", field: "output" }, to: { nodeId: "b", field: "input", graphId: "graph-1" } }]);
    expect(plain.privilegeDelta.privilegedEdges).toEqual([]);

    const server = makeNode({ id: "s" });
    (server.properties as any).placement = "server";
    const g2 = makeGraph({ nodes: [a, server] });
    const priv = diffAfter(g2, (g) => { (g.nodes[0].edges[0].connectors as any[]).push(makeConnector({ id: "c2", nodeId: "s" })); });
    expect(priv.privilegeDelta.privilegedEdges.map((e) => e.connectorId)).toEqual(["c2"]);
  });

  it("placement and capabilities are privilege namespaces with a delta", () => {
    const graph = makeGraph({ nodes: [makeNode({ id: "n1" })] });
    const d = diffAfter(graph, (g) => {
      g.nodes[0].properties.placement = "server";
      g.nodes[0].properties.capabilities = ["net:https", "aws:s3:read"];
    });
    expect(d.namespaces).toEqual(["capabilities", "placement"]);
    expect(d.privilegeDelta.placementToServer).toEqual(["n1"]);
    expect(d.privilegeDelta.capabilitiesAdded).toEqual([{ nodeId: "n1", capabilities: ["net:https", "aws:s3:read"] }]);
    expect(d.privilegeDelta.infrastructure).toBe(true);
  });

  it("removing a node removes its connectors too", () => {
    const a = makeNode({ id: "a" });
    (a.edges[0].connectors as any[]).push(makeConnector({ id: "c1", nodeId: "b" }));
    const graph = makeGraph({ nodes: [a, makeNode({ id: "b" })] });
    const d = diffAfter(graph, (g) => { g.nodes.splice(0, 1); });
    expect(d.nodesRemoved).toEqual(["a"]);
    expect(d.connectorsRemoved.map((c) => c.connectorId)).toEqual(["c1"]);
    expect(d.ops.map((o) => o.op)).toEqual(["remove-node", "disconnect"]);
  });

  it("server-owned namespaces are named so policy can refuse them", () => {
    const before = toJSON(fromJSON(copy(makeGraph())));
    const after = { ...before, observedStatus: { deployed: true } };
    const d = semanticDiff(before, after);
    expect(d.namespaces).toEqual(["observed"]);
    expect(d.ops).toEqual([{ op: "set-observed", namespace: "observed", keys: ["observedStatus"] }]);
  });
});
