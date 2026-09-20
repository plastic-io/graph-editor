import { describe, it, expect } from "vitest";
import patchInto from "../project";

describe("patchInto", () => {
  it("keeps the identity of objects that did not change", () => {
    const target: any = { nodes: [{ id: "a", x: 1 }, { id: "b", x: 2 }] };
    const untouched = target.nodes[1];
    patchInto(target, { nodes: [{ id: "a", x: 99 }, { id: "b", x: 2 }] });
    expect(target.nodes[1]).toBe(untouched);
    expect(target.nodes[0].x).toBe(99);
  });

  it("matches array entries by id rather than by position", () => {
    const target: any = { nodes: [{ id: "a" }, { id: "b" }, { id: "c" }] };
    const c = target.nodes[2];
    patchInto(target, { nodes: [{ id: "a" }, { id: "c" }] });
    // deleting b must not make c's identity shift onto b's old slot
    expect(target.nodes.map((n: any) => n.id)).toEqual(["a", "c"]);
    expect(target.nodes[1]).toBe(c);
  });

  it("removes keys that disappeared", () => {
    const target: any = { a: 1, b: 2 };
    patchInto(target, { a: 1 });
    expect(Object.keys(target)).toEqual(["a"]);
  });

  it("does not share new subtrees between two patched trees", () => {
    const source = { nodes: [{ id: "a", properties: { x: 1 } }] };
    const one: any = patchInto(null, source);
    const two: any = patchInto(null, source);
    one.nodes[0].properties.x = 42;
    expect(two.nodes[0].properties.x).toBe(1);
    expect(source.nodes[0].properties.x).toBe(1);
  });

  it("does not share newly inserted nodes between trees", () => {
    const first: any = { nodes: [] };
    const second: any = { nodes: [] };
    const projection = { nodes: [{ id: "a", properties: { x: 1 } }] };
    patchInto(first, projection);
    patchInto(second, projection);
    first.nodes[0].properties.x = 7;
    expect(second.nodes[0].properties.x).toBe(1);
  });

  it("shrinks and grows positional arrays", () => {
    const target: any = { list: [1, 2, 3] };
    patchInto(target, { list: [1] });
    expect(target.list).toEqual([1]);
    patchInto(target, { list: [1, 2, 3, 4] });
    expect(target.list).toEqual([1, 2, 3, 4]);
  });

  it("replaces a value when its type changes", () => {
    const target: any = { value: { a: 1 } };
    patchInto(target, { value: "now a string" });
    expect(target.value).toBe("now a string");
  });
});
