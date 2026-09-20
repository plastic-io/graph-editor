import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { GraphCrdtSession } from "../crdt";
import { toJSON, encodeState } from "@plastic-io/graph-crdt";
import {
  storeHarness,
  baseGraph,
  buildNode,
  summarise,
  stateSize,
  freshSize,
  legacySize,
  report,
  kb,
  round,
} from "./harness";

const EVENT_COUNT = 10000;

/**
 * Ten thousand events through the real pipeline, measuring how long each one
 * takes and how large the document becomes.
 *
 * The numbers are printed rather than merely asserted, because the useful
 * signal is the shape of the growth: an edit should cost the same whether it
 * is the first or the ten thousandth, and the stored document should grow with
 * the graph rather than with the number of times it has been edited.  The
 * assertions are deliberately loose so they catch a regression in that shape
 * without failing on a slow machine.
 */
describe("CRDT under load", () => {
  it("handles ten thousand text edits at steady cost", () => {
    const session = new GraphCrdtSession("stress-text");
    session.seed({ ...baseGraph("stress-text"), nodes: [buildNode(0)] });
    const store = storeHarness(session);

    const text = (session.doc.getMap("graph").get("nodes") as Y.Map<any>)
      .get("node-00000")
      .get("template")
      .get("set") as Y.Text;

    const samples: number[] = [];
    const sizeAt: Record<string, number> = {};
    for (let i = 0; i < EVENT_COUNT; i += 1) {
      const started = performance.now();
      text.insert(text.length, i % 80 === 79 ? "\n" : "x");
      samples.push(performance.now() - started);
      if (i === 999 || i === 4999 || i === EVENT_COUNT - 1) {
        sizeAt[`after ${i + 1}`] = stateSize(session);
      }
    }

    const timing = summarise(samples);
    const firstThousand = summarise(samples.slice(0, 1000));
    const lastThousand = summarise(samples.slice(-1000));

    report("10k text edits", [
      { phase: "all", ...timing },
      { phase: "first 1k", ...firstThousand },
      { phase: "last 1k", ...lastThousand },
    ]);
    report("document size (KB)", [
      Object.fromEntries(Object.entries(sizeAt).map(([k, v]) => [k, kb(v)])),
    ]);

    expect(text.length).toBe(EVENT_COUNT + "edges.out = value;\n".length);
    // The document holds the text, not a record of every keystroke that made
    // it, so it stays close to the size of its content.
    expect(sizeAt[`after ${EVENT_COUNT}`]).toBeLessThan(EVENT_COUNT * 12);
    // A late edit must not cost meaningfully more than an early one.
    expect(lastThousand.p95Ms).toBeLessThan(Math.max(2, firstThousand.p95Ms * 8 + 1));
    expect(timing.meanMs).toBeLessThan(2);
    session.destroy();
  });

  it("handles ten thousand property writes without the cost drifting", () => {
    const session = new GraphCrdtSession("stress-props");
    const nodes = Array.from({ length: 200 }, (_, i) => buildNode(i));
    session.seed({ ...baseGraph("stress-props"), nodes });
    const store = storeHarness(session);
    const nodeMap = session.doc.getMap("graph").get("nodes") as Y.Map<any>;

    const samples: number[] = [];
    for (let i = 0; i < EVENT_COUNT; i += 1) {
      const id = `node-${String(i % 200).padStart(5, "0")}`;
      const started = performance.now();
      // No batch key: each write is its own undoable action, which is what a
      // property panel produces, and what lets the history stay bounded.
      session.transactLocal("Move Nodes", () => {
        const properties = (nodeMap.get(id) as Y.Map<any>).get("properties") as Y.Map<any>;
        properties.set("x", i);
        properties.set("y", i * 2);
      });
      samples.push(performance.now() - started);
    }

    const timing = summarise(samples);
    const firstThousand = summarise(samples.slice(0, 1000));
    const lastThousand = summarise(samples.slice(-1000));
    report("10k property writes over 200 nodes", [
      { phase: "all", ...timing },
      { phase: "first 1k", ...firstThousand },
      { phase: "last 1k", ...lastThousand },
      {
        phase: "projection",
        count: store.projectionCount,
        totalMs: round(store.projectionMs),
        meanMs: round(store.projectionMs / Math.max(1, store.projectionCount)),
        p50Ms: 0,
        p95Ms: 0,
        maxMs: 0,
      },
    ]);
    const size = stateSize(session);
    const fresh = freshSize(session);
    report("document size (KB)", [
      { nodes: 200, afterEvents: kb(size), sameContentFresh: kb(fresh), ratio: round(size / fresh) },
    ]);

    const last = toJSON(session.doc) as any;
    const moved = last.nodes.find((n: any) => n.id === "node-00199");
    expect(moved.properties.x).toBe(EVENT_COUNT - 1);
    expect(store.graph.nodes).toHaveLength(200);
    expect(lastThousand.p95Ms).toBeLessThan(Math.max(3, firstThousand.p95Ms * 8 + 1));
    // Ten thousand edits must not leave a document many times the size of what
    // it holds.  Overwriting a value costs a little, bounded by the history we
    // keep, not by how long the session ran.
    expect(size).toBeLessThan(fresh * 4);
    session.destroy();
  });

  it("keeps ten thousand structural events consistent across two peers", () => {
    const alice = new GraphCrdtSession("stress-sync");
    alice.seed(baseGraph("stress-sync"));
    const bob = new GraphCrdtSession("stress-sync-peer");
    bob.applyRemote(encodeState(alice.doc), "bootstrap");

    const inFlight: { to: "alice" | "bob"; update: Uint8Array }[] = [];
    alice.onUpdate((update, origin) => {
      if (!(origin && origin.source === "wire")) {
        inFlight.push({ to: "bob", update });
      }
    });
    bob.onUpdate((update, origin) => {
      if (!(origin && origin.source === "wire")) {
        inFlight.push({ to: "alice", update });
      }
    });

    const makeNode = (index: number) => {
      const node = buildNode(index);
      const yNode = new Y.Map();
      yNode.set("id", node.id);
      yNode.set("url", node.url);
      yNode.set("graphId", node.graphId);
      yNode.set("version", 0);
      yNode.set("artifact", null);
      yNode.set("data", null);
      const properties = new Y.Map();
      properties.set("createdOn", index);
      properties.set("x", node.properties.x);
      properties.set("y", node.properties.y);
      properties.set("z", 0);
      properties.set("name", node.properties.name);
      properties.set("presentation", new Y.Map());
      properties.set("groups", new Y.Array());
      properties.set("inputs", new Y.Array());
      properties.set("outputs", new Y.Array());
      yNode.set("properties", properties);
      yNode.set("edges", new Y.Map());
      const template = new Y.Map();
      template.set("set", new Y.Text());
      template.set("vue", new Y.Text());
      yNode.set("template", template);
      return { id: node.id, yNode };
    };

    // The graph is held near a realistic working size by removing an older
    // node for every new one, so the run measures ten thousand events rather
    // than the cost of a ten thousand node graph, which the save-cost test
    // below covers separately.
    const LIVE = 300;
    const live: string[] = [];
    const samples: number[] = [];
    for (let i = 0; i < EVENT_COUNT; i += 1) {
      const session = i % 2 === 0 ? alice : bob;
      const started = performance.now();
      session.transactLocal("Create New Node", (root: any) => {
        const nodes = root.get("nodes");
        const { id, yNode } = makeNode(i);
        nodes.set(id, yNode);
        live.push(id);
        if (live.length > LIVE) {
          const oldest = live.shift() as string;
          if (nodes.get(oldest)) {
            nodes.delete(oldest);
          }
        }
      });
      samples.push(performance.now() - started);
      if (i % 250 === 249) {
        inFlight.splice(0, inFlight.length).forEach((item) => {
          (item.to === "alice" ? alice : bob).applyRemote(item.update, "wire");
        });
      }
    }
    inFlight.splice(0, inFlight.length).forEach((item) => {
      (item.to === "alice" ? alice : bob).applyRemote(item.update, "wire");
    });

    const aliceJson = toJSON(alice.doc) as any;
    const bobJson = toJSON(bob.doc) as any;
    const timing = summarise(samples);
    report("10k structural events across two peers", [
      { phase: "all", ...timing },
      { phase: "first 1k", ...summarise(samples.slice(0, 1000)) },
      { phase: "last 1k", ...summarise(samples.slice(-1000)) },
    ]);
    const size = stateSize(alice);
    const fresh = freshSize(alice);
    const legacy = legacySize(alice);
    report("after 10k events", [
      {
        liveNodes: aliceJson.nodes.length,
        stateKb: kb(size),
        sameContentFresh: kb(fresh),
        ratio: round(size / fresh),
        olderEncodingKb: kb(legacy),
        savedByV2: `${Math.round((1 - size / legacy) * 100)}%`,
        peersAgree: JSON.stringify(aliceJson) === JSON.stringify(bobJson) ? "yes" : "no",
      },
    ]);
    // The encoding this project uses is the more compact of the two.
    expect(size).toBeLessThan(legacy);

    // Both peers end up with exactly the same graph, having each made half the
    // changes without ever waiting for the other.
    expect(aliceJson).toEqual(bobJson);
    expect(aliceJson.nodes.length).toBeGreaterThan(0);
    // A deletion leaves a marker behind so that concurrent edits can still be
    // ordered against it, so the document is bigger than its live content.
    // What must not happen is growth with the number of events: ten thousand
    // create-and-delete cycles on a three hundred node graph.
    expect(size).toBeLessThan(fresh * 8);
    alice.destroy();
    bob.destroy();
  });

  it("reports what a full save costs as the graph grows", () => {
    const session = new GraphCrdtSession("stress-commit");
    session.seed(baseGraph("stress-commit"));
    const store = storeHarness(session);

    const rows: Record<string, number>[] = [];
    for (const size of [10, 50, 100, 250, 500]) {
      while (store.graphSnapshot.nodes.length < size) {
        store.graphSnapshot.nodes.push(buildNode(store.graphSnapshot.nodes.length));
      }
      session.commit("Create New Node", store.graphSnapshot);

      const samples: number[] = [];
      for (let i = 0; i < 20; i += 1) {
        store.graphSnapshot.nodes[i % size].properties.x = i;
        const started = performance.now();
        session.commit("Move Nodes", store.graphSnapshot);
        samples.push(performance.now() - started);
      }
      const timing = summarise(samples);
      rows.push({ nodes: size, meanMs: timing.meanMs, p95Ms: timing.p95Ms, stateKb: kb(stateSize(session)) });
    }

    report("cost of one full save, by graph size", rows);
    // Saving walks the whole graph, so it grows with the graph.  What must not
    // happen is a jump out of proportion to it.
    const smallest = rows[0].meanMs || 0.01;
    const largest = rows[rows.length - 1].meanMs;
    expect(largest).toBeLessThan(Math.max(50, smallest * 400));
    session.destroy();
  });
});
