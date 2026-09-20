import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { fromJSON, toJSON, isEmpty, schemaVersionOf } from "../codec";
import { SCHEMA_VERSION, ROOT_KEY } from "../schema";
import { makeGraph, makeNode, copy } from "./fixtures";

describe("codec", () => {
  it("round trips a graph without loss", () => {
    const graph = makeGraph();
    const doc = fromJSON(copy(graph));
    expect(toJSON(doc)).toEqual(graph);
  });

  it("reports an empty document", () => {
    const doc = new Y.Doc();
    expect(isEmpty(doc)).toBe(true);
    expect(toJSON(doc)).toBeNull();
    fromJSON(makeGraph(), doc);
    expect(isEmpty(doc)).toBe(false);
  });

  it("stamps the schema version", () => {
    const doc = fromJSON(makeGraph());
    expect(schemaVersionOf(doc)).toBe(SCHEMA_VERSION);
    // meta is internal and must not leak into the projection
    expect((toJSON(doc) as any).meta).toBeUndefined();
  });

  it("stores templates as collaborative text", () => {
    const doc = fromJSON(makeGraph());
    const nodes = doc.getMap(ROOT_KEY).get("nodes") as Y.Map<any>;
    const node = nodes.get("node-a") as Y.Map<any>;
    const template = node.get("template") as Y.Map<any>;
    expect(template.get("set")).toBeInstanceOf(Y.Text);
    expect(template.get("vue")).toBeInstanceOf(Y.Text);
    const props = doc.getMap(ROOT_KEY).get("properties") as Y.Map<any>;
    expect(props.get("template")).toBeInstanceOf(Y.Text);
  });

  it("keys nodes by id rather than by array position", () => {
    const doc = fromJSON(makeGraph());
    const nodes = doc.getMap(ROOT_KEY).get("nodes") as Y.Map<any>;
    expect(Array.from(nodes.keys()).sort()).toEqual(["node-a", "node-b"]);
  });

  it("keys edges by field and preserves output ordering on read", () => {
    const node = makeNode({ id: "n1" });
    node.properties.outputs = [
      { name: "second", type: "Object", external: false, visible: true },
      { name: "first", type: "Object", external: false, visible: true },
    ];
    node.edges = [
      { field: "first", connectors: [] },
      { field: "second", connectors: [] },
    ];
    const graph = makeGraph({ nodes: [node] });
    const doc = fromJSON(copy(graph));
    const out = toJSON(doc) as any;
    // edge order follows output order, which is the invariant the editor's
    // changeOutputOrder action relies on
    expect(out.nodes[0].edges.map((e: any) => e.field)).toEqual(["second", "first"]);
  });

  it("orders nodes deterministically by creation time then id", () => {
    const first = makeNode({ id: "zzz" });
    first.properties.createdOn = 1;
    const second = makeNode({ id: "aaa" });
    second.properties.createdOn = 2;
    const doc = fromJSON(makeGraph({ nodes: [second, first] }));
    expect((toJSON(doc) as any).nodes.map((n: any) => n.id)).toEqual(["zzz", "aaa"]);
  });

  it("treats node data as an opaque value", () => {
    const node = makeNode({ id: "n1", data: { deep: { nested: [1, 2, 3] } } });
    const doc = fromJSON(makeGraph({ nodes: [node] }));
    expect((toJSON(doc) as any).nodes[0].data).toEqual({ deep: { nested: [1, 2, 3] } });
  });

  it("defaults missing structural properties so the canvas can read them", () => {
    const node: any = makeNode({ id: "n1" });
    delete node.properties.presentation;
    delete node.properties.groups;
    delete node.properties.inputs;
    const doc = fromJSON(makeGraph({ nodes: [node] }));
    const out = (toJSON(doc) as any).nodes[0];
    expect(out.properties.presentation).toEqual({ x: 0, y: 0, z: 0 });
    expect(out.properties.groups).toEqual([]);
    expect(out.properties.inputs).toEqual([]);
  });
});
