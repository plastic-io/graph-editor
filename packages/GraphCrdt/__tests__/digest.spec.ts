import { describe, it, expect } from "vitest";
import { canonical, definitionView, layoutView } from "../digest";
import { makeGraph, makeNode, copy } from "./fixtures";

describe("revision digest views", () => {
  it("canonical JSON sorts keys at every level and drops undefined", () => {
    expect(canonical({ b: 1, a: { d: [3, { z: 1, y: undefined }], c: null } })).toBe('{"a":{"c":null,"d":[3,{"z":1}]},"b":1}');
  });

  it("moving a node changes the layout view but not the definition view", () => {
    const graph = makeGraph({ nodes: [makeNode({ id: "n1" })] });
    const moved = copy(graph);
    moved.nodes[0].properties.x = 999;
    moved.version = (moved.version || 0) + 1;
    moved.properties.lastUpdate = 1;
    expect(canonical(definitionView(moved))).toBe(canonical(definitionView(graph)));
    expect(canonical(layoutView(moved))).not.toBe(canonical(layoutView(graph)));
  });

  it("editing code changes the definition view but not the layout view", () => {
    const graph = makeGraph({ nodes: [makeNode({ id: "n1" })] });
    const edited = copy(graph);
    edited.nodes[0].template.set = "edges.output = 2;";
    expect(canonical(definitionView(edited))).not.toBe(canonical(definitionView(graph)));
    expect(canonical(layoutView(edited))).toBe(canonical(layoutView(graph)));
  });
});
