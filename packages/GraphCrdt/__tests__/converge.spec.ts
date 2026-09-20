import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { fromJSON, toJSON } from "../codec";
import { reconcile } from "../reconcile";
import { ROOT_KEY } from "../schema";
import { makeGraph, makeNode, makeConnector, copy } from "./fixtures";
import { applyUpdate, encodeState, encodeStateVector, UPDATE_EVENT } from "../updates";

/** Two peers that started from the same document and then diverged. */
function twoPeers(graph: any): [Y.Doc, Y.Doc] {
  const a = fromJSON(copy(graph));
  const b = new Y.Doc();
  applyUpdate(b, encodeState(a));
  return [a, b];
}

/** Exchange updates in both directions until both sides agree. */
function sync(a: Y.Doc, b: Y.Doc) {
  const aToB = encodeState(a, encodeStateVector(b));
  const bToA = encodeState(b, encodeStateVector(a));
  applyUpdate(b, aToB);
  applyUpdate(a, bToA);
}

/** Apply an edit the way the editor does: mutate a snapshot, then reconcile. */
function edit(doc: Y.Doc, mutate: (graph: any) => void, origin = "local") {
  const snapshot = toJSON(doc) as any;
  mutate(snapshot);
  reconcile(doc, snapshot, origin);
}

describe("convergence", () => {
  it("survives a concurrent delete and move, the case index based diffs got wrong", () => {
    const graph = makeGraph();
    const extra = makeNode({ id: "node-c" });
    extra.properties.createdOn = 3;
    graph.nodes.push(extra as any);
    const [a, b] = twoPeers(graph);

    // peer A deletes the first node
    edit(a, (g) => {
      g.nodes = g.nodes.filter((n: any) => n.id !== "node-a");
    });
    // peer B, not yet knowing that, moves the last node
    edit(b, (g) => {
      const node = g.nodes.find((n: any) => n.id === "node-c");
      node.properties.x = 777;
      node.properties.y = 888;
    });

    sync(a, b);

    const left = toJSON(a) as any;
    const right = toJSON(b) as any;
    expect(left).toEqual(right);
    expect(left.nodes.map((n: any) => n.id)).toEqual(["node-b", "node-c"]);
    const moved = left.nodes.find((n: any) => n.id === "node-c");
    expect(moved.properties.x).toBe(777);
    expect(moved.properties.y).toBe(888);
  });

  it("keeps a rename and a new connector made at the same time", () => {
    const graph = makeGraph();
    const [a, b] = twoPeers(graph);

    // peer A renames node-b's input, fixing up the connector that points at it
    edit(a, (g) => {
      g.nodes[1].properties.inputs[0].name = "renamed";
      g.nodes[0].edges[0].connectors[0].field = "renamed";
    });
    // peer B adds a second output and wires it up
    edit(b, (g) => {
      g.nodes[1].properties.outputs.push({
        name: "extra",
        type: "Object",
        external: false,
        visible: true,
      });
      g.nodes[1].edges.push({
        field: "extra",
        connectors: [makeConnector({ id: "con-new", nodeId: "node-a", field: "input" })],
      });
    });

    sync(a, b);

    const left = toJSON(a) as any;
    expect(left).toEqual(toJSON(b));
    expect(left.nodes[1].properties.inputs[0].name).toBe("renamed");
    expect(left.nodes[0].edges[0].connectors[0].field).toBe("renamed");
    const extra = left.nodes[1].edges.find((e: any) => e.field === "extra");
    expect(extra.connectors.map((c: any) => c.id)).toEqual(["con-new"]);
  });

  it("merges simultaneous edits to the same template character by character", () => {
    const graph = makeGraph();
    graph.nodes[0].template.set = "const a = 1;\nconst b = 2;\n";
    const [a, b] = twoPeers(graph);

    edit(a, (g) => {
      g.nodes[0].template.set = "const a = 100;\nconst b = 2;\n";
    });
    edit(b, (g) => {
      g.nodes[0].template.set = "const a = 1;\nconst b = 200;\n";
    });

    sync(a, b);

    const merged = (toJSON(a) as any).nodes[0].template.set;
    expect(merged).toEqual((toJSON(b) as any).nodes[0].template.set);
    // both edits are present, which a last-writer-wins string could not do
    expect(merged).toContain("100");
    expect(merged).toContain("200");
  });

  it("keeps both connectors when two people wire the same edge at once", () => {
    const graph = makeGraph();
    const [a, b] = twoPeers(graph);

    edit(a, (g) => {
      g.nodes[0].edges[0].connectors.push(
        makeConnector({ id: "from-a", nodeId: "node-b", field: "input" }),
      );
    });
    edit(b, (g) => {
      g.nodes[0].edges[0].connectors.push(
        makeConnector({ id: "from-b", nodeId: "node-b", field: "input" }),
      );
    });

    sync(a, b);

    const left = toJSON(a) as any;
    expect(left).toEqual(toJSON(b));
    const ids = left.nodes[0].edges[0].connectors.map((c: any) => c.id).sort();
    expect(ids).toEqual(["con-1", "from-a", "from-b"]);
  });

  it("keeps both nodes when two people create one at the same time", () => {
    const graph = makeGraph();
    const [a, b] = twoPeers(graph);

    edit(a, (g) => {
      const n = makeNode({ id: "from-a" });
      n.properties.createdOn = 10;
      g.nodes.push(n);
    });
    edit(b, (g) => {
      const n = makeNode({ id: "from-b" });
      n.properties.createdOn = 11;
      g.nodes.push(n);
    });

    sync(a, b);
    const left = toJSON(a) as any;
    expect(left).toEqual(toJSON(b));
    expect(left.nodes.map((n: any) => n.id)).toEqual([
      "node-a",
      "node-b",
      "from-a",
      "from-b",
    ]);
  });

  it("does not let a move on one node overwrite a move on another", () => {
    const graph = makeGraph();
    const [a, b] = twoPeers(graph);

    edit(a, (g) => {
      g.nodes[0].properties.x = 111;
    });
    edit(b, (g) => {
      g.nodes[1].properties.x = 222;
    });

    sync(a, b);
    const left = toJSON(a) as any;
    expect(left).toEqual(toJSON(b));
    expect(left.nodes[0].properties.x).toBe(111);
    expect(left.nodes[1].properties.x).toBe(222);
  });

  it("converges when the same field is edited on both sides", () => {
    const graph = makeGraph();
    const [a, b] = twoPeers(graph);
    edit(a, (g) => {
      g.properties.name = "From A";
    });
    edit(b, (g) => {
      g.properties.name = "From B";
    });
    sync(a, b);
    expect(toJSON(a)).toEqual(toJSON(b));
    expect(["From A", "From B"]).toContain((toJSON(a) as any).properties.name);
  });

  it("converges after a long offline divergence on both sides", () => {
    const graph = makeGraph();
    const [a, b] = twoPeers(graph);

    for (let i = 0; i < 25; i += 1) {
      edit(a, (g) => {
        const n = makeNode({ id: `a-${i}` });
        n.properties.createdOn = 100 + i;
        g.nodes.push(n);
        g.nodes[0].properties.x = i;
      });
      edit(b, (g) => {
        const n = makeNode({ id: `b-${i}` });
        n.properties.createdOn = 200 + i;
        g.nodes.push(n);
        g.nodes[1].properties.y = i;
      });
    }

    sync(a, b);
    const left = toJSON(a) as any;
    expect(left).toEqual(toJSON(b));
    expect(left.nodes).toHaveLength(52);
    expect(left.nodes[0].properties.x).toBe(24);
    expect(left.nodes[1].properties.y).toBe(24);
  });

  it("order of update delivery does not matter", () => {
    const graph = makeGraph();
    const base = fromJSON(copy(graph));
    const baseState = encodeState(base);

    const updates: Uint8Array[] = [];
    const peers = ["p1", "p2", "p3"].map((name) => {
      const doc = new Y.Doc();
      applyUpdate(doc, baseState);
      // Listen for the encoding this project uses.  A Y.Doc emits both, and
      // taking the wrong one produces bytes that the reader misinterprets
      // rather than rejects.
      doc.on(UPDATE_EVENT as any, (u: Uint8Array) => updates.push(u));
      edit(doc, (g) => {
        const n = makeNode({ id: `node-${name}` });
        n.properties.createdOn = 500;
        g.nodes.push(n);
        g.nodes[0].properties.name = `named by ${name}`;
      });
      return doc;
    });

    const forward = new Y.Doc();
    applyUpdate(forward, baseState);
    updates.forEach((u) => applyUpdate(forward, u));

    const backward = new Y.Doc();
    applyUpdate(backward, baseState);
    [...updates].reverse().forEach((u) => applyUpdate(backward, u));

    expect(toJSON(forward)).toEqual(toJSON(backward));
    expect((toJSON(forward) as any).nodes.map((n: any) => n.id).sort()).toEqual([
      "node-a",
      "node-b",
      "node-p1",
      "node-p2",
      "node-p3",
    ]);
    expect(peers).toHaveLength(3);
  });

  it("a delete wins over a concurrent edit to the deleted node", () => {
    const graph = makeGraph();
    const [a, b] = twoPeers(graph);
    edit(a, (g) => {
      g.nodes = g.nodes.filter((n: any) => n.id !== "node-b");
    });
    edit(b, (g) => {
      g.nodes[1].properties.name = "still editing";
    });
    sync(a, b);
    const left = toJSON(a) as any;
    expect(left).toEqual(toJSON(b));
    expect(left.nodes.map((n: any) => n.id)).toEqual(["node-a"]);
  });

  it("undo only rolls back the local user's own work", () => {
    const graph = makeGraph();
    const [a, b] = twoPeers(graph);
    const undo = new Y.UndoManager(a.getMap(ROOT_KEY), {
      trackedOrigins: new Set(["local"]),
    });

    edit(a, (g) => {
      g.nodes[0].properties.x = 42;
    }, "local");
    edit(b, (g) => {
      g.nodes[1].properties.x = 99;
    }, "local");
    sync(a, b);

    expect((toJSON(a) as any).nodes[0].properties.x).toBe(42);
    expect((toJSON(a) as any).nodes[1].properties.x).toBe(99);

    undo.undo();

    // A's own change is rolled back, B's is untouched
    expect((toJSON(a) as any).nodes[0].properties.x).toBe(10);
    expect((toJSON(a) as any).nodes[1].properties.x).toBe(99);

    undo.redo();
    expect((toJSON(a) as any).nodes[0].properties.x).toBe(42);
  });
});
