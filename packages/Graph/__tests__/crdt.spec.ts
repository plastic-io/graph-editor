import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { GraphCrdtSession, projectUpdates } from "../crdt";
import patchInto from "../project";
import { makeGraph, makeNode, copy } from "../../GraphCrdt/__tests__/fixtures";
import { applyUpdate, encodeState } from "@plastic-io/graph-crdt";

/**
 * Mirrors what the Pinia store does: one committed graph, one working
 * snapshot, and the copy the scheduler watches, all fed from the projection.
 */
function storeLike(session: GraphCrdtSession) {
  const projection = session.projection();
  const store: any = {
    graph: patchInto(null, projection),
    graphSnapshot: patchInto(null, projection),
    schedulerCopy: patchInto(null, projection),
  };
  session.onProjection((next: any, info: any) => {
    store.graph = patchInto(store.graph, next);
    if (!info.local) {
      store.graphSnapshot = patchInto(store.graphSnapshot, next);
    }
    store.schedulerCopy = patchInto(store.schedulerCopy, next);
  });
  session.onHistory((events: any[], position: number) => {
    store.events = events;
    store.historyPosition = position;
  });
  session.refresh();
  return store;
}

describe("GraphCrdtSession", () => {
  it("seeds an empty document and projects it", () => {
    const session = new GraphCrdtSession("graph-1");
    expect(session.isEmpty).toBe(true);
    session.seed(makeGraph());
    expect(session.isEmpty).toBe(false);
    expect((session.projection() as any).id).toBe("graph-1");
    session.destroy();
  });

  it("does not re-seed a document that already has content", () => {
    const session = new GraphCrdtSession("graph-1");
    session.seed(makeGraph());
    expect(session.seed(makeGraph({ id: "other" }))).toBe(false);
    expect((session.projection() as any).id).toBe("graph-1");
    session.destroy();
  });

  it("keeps a seed out of the undo stack", () => {
    const session = new GraphCrdtSession("graph-1");
    session.seed(makeGraph());
    expect(session.historyPosition).toBe(0);
    expect(session.historyEvents()).toEqual([]);
    session.destroy();
  });

  it("records one history entry per commit", () => {
    const session = new GraphCrdtSession("graph-1");
    session.seed(makeGraph());
    const store = storeLike(session);

    store.graphSnapshot.properties.name = "First";
    session.commit("Update Graph Properties", store.graphSnapshot);
    store.graphSnapshot.nodes[0].properties.x = 50;
    session.commit("Move Nodes", store.graphSnapshot);

    expect(store.historyPosition).toBe(2);
    expect(store.events.map((e: any) => e.description)).toEqual([
      "Update Graph Properties",
      "Move Nodes",
    ]);
    session.destroy();
  });

  it("undo rewinds the snapshot as well as the committed graph", () => {
    const session = new GraphCrdtSession("graph-1");
    session.seed(makeGraph());
    const store = storeLike(session);

    store.graphSnapshot.nodes[0].properties.x = 500;
    session.commit("Move Nodes", store.graphSnapshot);
    expect(store.graph.nodes[0].properties.x).toBe(500);

    session.undo();
    expect(store.graph.nodes[0].properties.x).toBe(10);
    // the working snapshot must follow, or the next save would put it back
    expect(store.graphSnapshot.nodes[0].properties.x).toBe(10);
    expect(store.historyPosition).toBe(0);

    session.redo();
    expect(store.graph.nodes[0].properties.x).toBe(500);
    expect(store.graphSnapshot.nodes[0].properties.x).toBe(500);
    expect(store.historyPosition).toBe(1);
    session.destroy();
  });

  it("history lists undone entries after the current position", () => {
    const session = new GraphCrdtSession("graph-1");
    session.seed(makeGraph());
    const store = storeLike(session);
    ["One", "Two", "Three"].forEach((name, index) => {
      store.graphSnapshot.nodes[0].properties.x = index + 1;
      session.commit(name, store.graphSnapshot);
    });
    session.move(-2);
    expect(store.historyPosition).toBe(1);
    expect(store.events.map((e: any) => e.description)).toEqual([
      "One",
      "Two",
      "Three",
    ]);
    session.destroy();
  });

  it("keeps the three projected trees independent", () => {
    const session = new GraphCrdtSession("graph-1");
    session.seed(makeGraph());
    const store = storeLike(session);
    store.graphSnapshot.nodes[0].properties.x = 33;
    session.commit("Move Nodes", store.graphSnapshot);
    // mutating one tree must not reach into another
    store.graph.nodes[0].properties.x = 999;
    expect(store.schedulerCopy.nodes[0].properties.x).toBe(33);
    expect(store.graphSnapshot.nodes[0].properties.x).toBe(33);
    session.destroy();
  });

  it("applies a remote update into the snapshot so it is not reverted", () => {
    const local = new GraphCrdtSession("graph-1");
    local.seed(makeGraph());
    const store = storeLike(local);

    // a peer that started from the same state adds a node
    const peer = new Y.Doc();
    applyUpdate(peer, encodeState(local.doc));
    const peerSession = new GraphCrdtSession("graph-1-peer");
    applyUpdate(peerSession.doc, encodeState(peer));
    const peerSnapshot = peerSession.projection() as any;
    const added = makeNode({ id: "node-c" });
    added.properties.createdOn = 9;
    peerSnapshot.nodes.push(added);
    peerSession.commit("Create New Node", peerSnapshot);

    local.applyRemote(encodeState(peerSession.doc), "test-peer");

    expect(store.graph.nodes.map((n: any) => n.id)).toEqual([
      "node-a",
      "node-b",
      "node-c",
    ]);
    expect(store.graphSnapshot.nodes.map((n: any) => n.id)).toEqual([
      "node-a",
      "node-b",
      "node-c",
    ]);
    // remote work is not undoable locally
    expect(store.historyPosition).toBe(0);

    // and a following local save keeps the remote node
    store.graphSnapshot.properties.name = "After remote";
    local.commit("Update Graph Properties", store.graphSnapshot);
    expect(local.projection().nodes).toHaveLength(3);

    local.destroy();
    peerSession.destroy();
  });

  it("replays an update log back to an earlier point in time", () => {
    const session = new GraphCrdtSession("graph-1");
    const updates: Uint8Array[] = [];
    session.onUpdate((update: Uint8Array) => updates.push(update));
    session.seed(makeGraph());
    const store = storeLike(session);

    store.graphSnapshot.properties.name = "Step one";
    session.commit("One", store.graphSnapshot);
    store.graphSnapshot.properties.name = "Step two";
    session.commit("Two", store.graphSnapshot);

    expect((projectUpdates(updates, 1) as any).properties.name).toBe("My Graph");
    expect((projectUpdates(updates, 2) as any).properties.name).toBe("Step one");
    expect((projectUpdates(updates) as any).properties.name).toBe("Step two");
    session.destroy();
  });

  it("batches text edits but applies structural changes at once", async () => {
    const session = new GraphCrdtSession("graph-1");
    session.seed(makeGraph());
    const store = storeLike(session);

    const template = (session.doc.getMap("graph").get("nodes") as any)
      .get("node-a")
      .get("template")
      .get("set");

    template.insert(0, "// typed ");
    // nothing on screen waits for this, so it is allowed to arrive late
    expect(store.graph.nodes[0].template.set.startsWith("// typed ")).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(store.graph.nodes[0].template.set.startsWith("// typed ")).toBe(true);

    // a structural change is not batched
    store.graphSnapshot.nodes[0].properties.x = 123;
    session.commit("Move Nodes", store.graphSnapshot);
    expect(store.graph.nodes[0].properties.x).toBe(123);
    session.destroy();
  });

  it("reports no change when the snapshot is committed untouched", () => {
    const session = new GraphCrdtSession("graph-1");
    session.seed(makeGraph());
    const snapshot = copy(session.projection());
    expect(session.commit("No-op", snapshot)).toBe(false);
    session.destroy();
  });
});
