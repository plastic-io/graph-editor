import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { fromJSON, toJSON } from "../codec";
import { reconcile } from "../reconcile";
import { ROOT_KEY } from "../schema";
import { makeGraph, makeNode, makeConnector, copy } from "./fixtures";

function nodeMap(doc: Y.Doc): Y.Map<any> {
  return doc.getMap(ROOT_KEY).get("nodes") as Y.Map<any>;
}

describe("reconcile", () => {
  it("populates an empty document", () => {
    const doc = new Y.Doc();
    const graph = makeGraph();
    expect(reconcile(doc, copy(graph))).toBe(true);
    expect(toJSON(doc)).toEqual(graph);
  });

  it("is a no-op when nothing changed", () => {
    const graph = makeGraph();
    const doc = fromJSON(copy(graph));
    let updates = 0;
    doc.on("update", () => {
      updates += 1;
    });
    expect(reconcile(doc, copy(graph))).toBe(false);
    expect(updates).toBe(0);
  });

  it("applies a scalar change without disturbing anything else", () => {
    const graph = makeGraph();
    const doc = fromJSON(copy(graph));
    const untouched = nodeMap(doc).get("node-b");
    const target = copy(graph);
    target.nodes[0].properties.x = 999;

    expect(reconcile(doc, target)).toBe(true);
    expect((toJSON(doc) as any).nodes[0].properties.x).toBe(999);
    // the other node's Y type is the same object, so Vue keeps its bindings
    expect(nodeMap(doc).get("node-b")).toBe(untouched);
  });

  it("edits templates in place so remote cursors survive", () => {
    const graph = makeGraph();
    const doc = fromJSON(copy(graph));
    const template = (nodeMap(doc).get("node-a") as Y.Map<any>).get("template") as Y.Map<any>;
    const text = template.get("set") as Y.Text;

    const target = copy(graph);
    target.nodes[0].template.set = "edges.output = value + 1;";
    reconcile(doc, target);

    expect(template.get("set")).toBe(text);
    expect(text.toString()).toBe("edges.output = value + 1;");
  });

  it("sends only the changed characters of a template", () => {
    const graph = makeGraph();
    graph.nodes[0].template.vue = "x".repeat(5000);
    const doc = fromJSON(copy(graph));

    let bytes = 0;
    doc.on("update", (update: Uint8Array) => {
      bytes += update.byteLength;
    });

    const target = copy(graph);
    target.nodes[0].template.vue = "x".repeat(2500) + "Y" + "x".repeat(2500);
    reconcile(doc, target);

    expect((toJSON(doc) as any).nodes[0].template.vue).toBe(target.nodes[0].template.vue);
    // a whole-document rewrite would be several kilobytes
    expect(bytes).toBeLessThan(200);
  });

  it("adds and removes nodes by id", () => {
    const graph = makeGraph();
    const doc = fromJSON(copy(graph));
    const target = copy(graph);
    const fresh = makeNode({ id: "node-c" });
    fresh.properties.createdOn = 3;
    target.nodes.push(fresh as any);
    target.nodes = target.nodes.filter((n: any) => n.id !== "node-b");

    reconcile(doc, target);
    const out = toJSON(doc) as any;
    expect(out.nodes.map((n: any) => n.id)).toEqual(["node-a", "node-c"]);
  });

  it("matches connectors by id when one is removed from the middle", () => {
    const graph = makeGraph();
    graph.nodes[0].edges[0].connectors = [
      makeConnector({ id: "c1" }),
      makeConnector({ id: "c2" }),
      makeConnector({ id: "c3" }),
    ] as any;
    const doc = fromJSON(copy(graph));
    const target = copy(graph);
    target.nodes[0].edges[0].connectors.splice(1, 1);

    reconcile(doc, target);
    const out = toJSON(doc) as any;
    expect(out.nodes[0].edges[0].connectors.map((c: any) => c.id)).toEqual(["c1", "c3"]);
  });

  it("reorders inputs without losing their contents", () => {
    const node = makeNode({ id: "n1" });
    node.properties.inputs = [
      { name: "a", type: "String", external: false, visible: true },
      { name: "b", type: "Number", external: true, visible: false },
    ];
    const graph = makeGraph({ nodes: [node] });
    const doc = fromJSON(copy(graph));
    const target = copy(graph);
    target.nodes[0].properties.inputs.reverse();

    reconcile(doc, target);
    const out = (toJSON(doc) as any).nodes[0].properties.inputs;
    expect(out).toEqual([
      { name: "b", type: "Number", external: true, visible: false },
      { name: "a", type: "String", external: false, visible: true },
    ]);
  });

  it("reordering outputs reorders the matching edges", () => {
    const node = makeNode({ id: "n1" });
    node.properties.outputs = [
      { name: "first", type: "Object", external: false, visible: true },
      { name: "second", type: "Object", external: false, visible: true },
    ];
    node.edges = [
      { field: "first", connectors: [] },
      { field: "second", connectors: [] },
    ];
    const graph = makeGraph({ nodes: [node] });
    const doc = fromJSON(copy(graph));

    const target = copy(graph);
    target.nodes[0].properties.outputs.reverse();
    target.nodes[0].edges.reverse();
    reconcile(doc, target);

    expect((toJSON(doc) as any).nodes[0].edges.map((e: any) => e.field)).toEqual([
      "second",
      "first",
    ]);
  });

  it("renames an input and rewrites the connectors that referenced it", () => {
    const graph = makeGraph();
    const doc = fromJSON(copy(graph));
    const target = copy(graph);
    target.nodes[1].properties.inputs[0].name = "renamed";
    target.nodes[0].edges[0].connectors[0].field = "renamed";

    reconcile(doc, target);
    const out = toJSON(doc) as any;
    expect(out.nodes[1].properties.inputs[0].name).toBe("renamed");
    expect(out.nodes[0].edges[0].connectors[0].field).toBe("renamed");
  });

  it("replaces opaque node data as a unit", () => {
    const graph = makeGraph();
    const doc = fromJSON(copy(graph));
    const target = copy(graph);
    target.nodes[0].data = { rows: [1, 2, 3] };
    reconcile(doc, target);
    expect((toJSON(doc) as any).nodes[0].data).toEqual({ rows: [1, 2, 3] });

    const cleared = copy(toJSON(doc));
    cleared.nodes[0].data = null;
    reconcile(doc, cleared);
    expect((toJSON(doc) as any).nodes[0].data).toBeNull();
  });

  it("removes graph properties that disappear from the target", () => {
    const graph = makeGraph();
    const doc = fromJSON(copy(graph));
    const target = copy(graph);
    delete target.properties.description;
    reconcile(doc, target);
    expect((toJSON(doc) as any).properties.description).toBeUndefined();
  });

  it("tags its transaction with the origin it was given", () => {
    const graph = makeGraph();
    const doc = fromJSON(copy(graph));
    const origins: any[] = [];
    doc.on("update", (_u: Uint8Array, origin: any) => origins.push(origin));
    const target = copy(graph);
    target.properties.name = "Renamed";
    reconcile(doc, target, "my-origin");
    expect(origins).toEqual(["my-origin"]);
  });
});
