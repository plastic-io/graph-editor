import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import {
  UPDATE_FORMAT,
  UPDATE_EVENT,
  encodeState,
  applyUpdate,
  mergeUpdates,
  diffUpdate,
  stateVectorFromUpdate,
  encodeStateVector,
  isEmptyUpdate,
  documentSize,
} from "../updates";
import { fromJSON, toJSON } from "../codec";
import { reconcile } from "../reconcile";
import { makeGraph, makeNode, copy } from "./fixtures";

describe("update format", () => {
  it("is the V2 encoding, and says so", () => {
    expect(UPDATE_FORMAT).toBe(2);
    expect(UPDATE_EVENT).toBe("updateV2");
  });

  it("round trips a document", () => {
    const source = fromJSON(makeGraph());
    const target = new Y.Doc();
    applyUpdate(target, encodeState(source));
    expect(toJSON(target)).toEqual(toJSON(source));
  });

  it("emits updates on the event this format uses", () => {
    const doc = fromJSON(makeGraph());
    const seen: Uint8Array[] = [];
    doc.on(UPDATE_EVENT as any, (update: Uint8Array) => seen.push(update));
    const snapshot = toJSON(doc) as any;
    snapshot.properties.name = "Changed";
    reconcile(doc, snapshot, "test");

    expect(seen).toHaveLength(1);
    const replayed = new Y.Doc();
    applyUpdate(replayed, encodeState(doc, encodeStateVector(replayed)));
    expect((toJSON(replayed) as any).properties.name).toBe("Changed");
  });

  it("sends only the difference when given a state vector", () => {
    const source = fromJSON(makeGraph());
    const behind = new Y.Doc();
    applyUpdate(behind, encodeState(source));

    const snapshot = toJSON(source) as any;
    snapshot.nodes.push(makeNode({ id: "node-c" }));
    reconcile(source, snapshot, "test");

    const whole = encodeState(source);
    const difference = encodeState(source, encodeStateVector(behind));
    expect(difference.byteLength).toBeLessThan(whole.byteLength);

    applyUpdate(behind, difference);
    expect(toJSON(behind)).toEqual(toJSON(source));
  });

  it("computes the same difference from stored bytes as from a document", () => {
    const source = fromJSON(makeGraph());
    const behind = new Y.Doc();
    applyUpdate(behind, encodeState(source));
    const snapshot = toJSON(source) as any;
    snapshot.properties.description = "later";
    reconcile(source, snapshot, "test");

    // This is the server's position: it holds bytes, not a document.
    const stored = encodeState(source);
    const fromBytes = diffUpdate(stored, encodeStateVector(behind));
    const fromDoc = encodeState(source, encodeStateVector(behind));

    const viaBytes = new Y.Doc();
    applyUpdate(viaBytes, encodeState(behind));
    applyUpdate(viaBytes, fromBytes);
    const viaDoc = new Y.Doc();
    applyUpdate(viaDoc, encodeState(behind));
    applyUpdate(viaDoc, fromDoc);
    expect(toJSON(viaBytes)).toEqual(toJSON(viaDoc));
    expect((toJSON(viaBytes) as any).properties.description).toBe("later");
  });

  it("state vectors do not depend on the update format", () => {
    const doc = fromJSON(makeGraph());
    const fromTheDocument = encodeStateVector(doc);
    const fromStoredBytes = stateVectorFromUpdate(encodeState(doc));
    expect(Array.from(fromStoredBytes)).toEqual(Array.from(fromTheDocument));
  });

  it("recognises an update that carries nothing", () => {
    const doc = fromJSON(makeGraph());
    // A peer that is already up to date gets a well formed update describing
    // no changes, which is not zero bytes, so length is the wrong test.
    const nothing = encodeState(doc, encodeStateVector(doc));
    expect(nothing.byteLength).toBeGreaterThan(0);
    expect(isEmptyUpdate(nothing)).toBe(true);
    expect(isEmptyUpdate(encodeState(doc))).toBe(false);
  });

  it("merges updates into something smaller than their sum", () => {
    const doc = fromJSON(makeGraph());
    const base = encodeState(doc);
    const pieces: Uint8Array[] = [];
    doc.on(UPDATE_EVENT as any, (update: Uint8Array) => pieces.push(update));
    for (let i = 0; i < 40; i += 1) {
      const snapshot = toJSON(doc) as any;
      snapshot.nodes[0].properties.x = i;
      reconcile(doc, snapshot, "test");
    }

    const separate = pieces.reduce((total, piece) => total + piece.byteLength, 0);
    const merged = mergeUpdates([base, ...pieces]);
    expect(merged.byteLength).toBeLessThan(base.byteLength + separate);

    // This is what the server does with a log: fold it into one update and
    // hand that to a peer, which must land on the same document.
    const rebuilt = new Y.Doc();
    applyUpdate(rebuilt, merged);
    expect(toJSON(rebuilt)).toEqual(toJSON(doc));
    expect((toJSON(rebuilt) as any).nodes[0].properties.x).toBe(39);
  });

  it("compresses a real graph better than the older encoding", () => {
    const nodes = Array.from({ length: 120 }, (_, i) =>
      makeNode({ id: `node-${i}`, properties: { ...makeNode({ id: `node-${i}` }).properties, createdOn: i } }),
    );
    const doc = fromJSON(makeGraph({ nodes }));
    const v2 = documentSize(doc);
    const v1 = Y.encodeStateAsUpdate(doc).byteLength;
    // eslint-disable-next-line no-console
    console.log(`120 node graph: V1 ${v1} bytes, V2 ${v2} bytes, saved ${Math.round((1 - v2 / v1) * 100)}%`);
    expect(v2).toBeLessThan(v1);
  });

  it("merging a single update leaves it untouched", () => {
    const doc = fromJSON(makeGraph());
    const only = encodeState(doc);
    expect(mergeUpdates([only])).toBe(only);
  });
});
