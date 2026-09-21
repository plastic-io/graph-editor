import { describe, it, expect } from "vitest";
import { canonical, definitionView, layoutView, componentView } from "../digest";
import { makeGraph, makeNode, makeConnector, copy } from "./fixtures";

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

  it("a component's view survives what an importer does to its copy", () => {
    const graph = makeGraph({ nodes: [makeNode({ id: "n1" })] });
    const published = { ...copy(graph), url: "g", version: 7, publishedOn: 1, publishedBy: "x" };
    const embedded = copy(published);
    delete embedded.url; delete embedded.artifact; embedded.version = 0;
    embedded.nodes[0].properties.x = 999;              // moved on screen
    expect(canonical(componentView("graph", embedded))).toBe(canonical(componentView("graph", published)));
    const drifted = copy(embedded);
    drifted.nodes[0].template.set = "changed";
    expect(canonical(componentView("graph", drifted))).not.toBe(canonical(componentView("graph", published)));

    const node = makeNode({ id: "p1" });
    (node.edges[0].connectors as any[]).push(makeConnector({ id: "c1" }));
    delete (node.properties.inputs[0] as any).visible;
    const imported = copy(node);
    imported.id = "host-1"; imported.url = "elsewhere"; imported.loaded = true; imported.edges[0].connectors = [];
    imported.properties.inputs[0].visible = true;
    expect(canonical(componentView("node", imported))).toBe(canonical(componentView("node", node)));
  });
});
