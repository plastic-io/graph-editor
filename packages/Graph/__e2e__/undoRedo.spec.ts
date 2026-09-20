import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { GraphCrdtSession } from "../crdt";
import { toJSON, applyUpdate, encodeState } from "@plastic-io/graph-crdt";
import { storeHarness, baseGraph, buildNode, summarise, report } from "./harness";

/** The bounded document should be a fraction of the unbounded one. */
function session_expect_ratio(bounded: number, unbounded: number) {
  expect(bounded * 2).toBeLessThan(unbounded);
}

/** Apply one edit the way an editor action does, through the snapshot. */
function commit(session: GraphCrdtSession, store: any, description: string, mutate: (graph: any) => void) {
  mutate(store.graphSnapshot);
  session.commit(description, store.graphSnapshot);
}

function names(store: any): string[] {
  return store.graph.nodes.map((n: any) => n.properties.name);
}

describe("undo and redo end to end", () => {
  it("walks a deep history all the way back and all the way forward", () => {
    const session = new GraphCrdtSession("undo-deep", { maxUndoSteps: 1000 });
    session.seed(baseGraph("undo-deep"));
    const store = storeHarness(session);

    const DEPTH = 500;
    const checkpoints: Record<number, string> = {};
    for (let i = 0; i < DEPTH; i += 1) {
      commit(session, store, `Create New Node`, (graph) => {
        graph.nodes.push(buildNode(i));
      });
      if (i % 100 === 99) {
        checkpoints[i + 1] = JSON.stringify(store.graph.nodes.map((n: any) => n.id));
      }
    }
    expect(store.historyPosition).toBe(DEPTH);
    expect(store.graph.nodes).toHaveLength(DEPTH);

    const undoSamples: number[] = [];
    for (let i = DEPTH; i > 0; i -= 1) {
      const started = performance.now();
      session.undo();
      undoSamples.push(performance.now() - started);
      if (checkpoints[i - 1]) {
        expect(JSON.stringify(store.graph.nodes.map((n: any) => n.id))).toBe(checkpoints[i - 1]);
      }
    }
    expect(store.graph.nodes).toHaveLength(0);
    expect(store.historyPosition).toBe(0);
    // The snapshot has to follow, or the next save would put everything back.
    expect(store.graphSnapshot.nodes).toHaveLength(0);

    const redoSamples: number[] = [];
    for (let i = 0; i < DEPTH; i += 1) {
      const started = performance.now();
      session.redo();
      redoSamples.push(performance.now() - started);
    }
    expect(store.graph.nodes).toHaveLength(DEPTH);
    expect(store.historyPosition).toBe(DEPTH);
    expect(JSON.stringify(store.graph.nodes.map((n: any) => n.id))).toBe(checkpoints[DEPTH]);

    report("undo and redo over a 500 step history", [
      { phase: "undo", ...summarise(undoSamples) },
      { phase: "redo", ...summarise(redoSamples) },
    ]);
    session.destroy();
  });

  it("keeps only the most recent actions undoable, and stays correct past that", () => {
    // A small bound so the behaviour is visible without a long run.  The real
    // default is larger; what matters is that it exists, because an unbounded
    // history pins every deleted item and the document never stops growing.
    const session = new GraphCrdtSession("undo-bounded", { maxUndoSteps: 20 });
    session.seed(baseGraph("undo-bounded"));
    const store = storeHarness(session);

    for (let i = 0; i < 200; i += 1) {
      commit(session, store, `Create New Node`, (graph) => {
        graph.nodes.push(buildNode(i));
      });
    }
    expect(store.graph.nodes).toHaveLength(200);
    // Only the tail of the history is offered.
    expect(store.historyPosition).toBeLessThanOrEqual(21);
    expect(store.events.length).toBeLessThanOrEqual(21);

    // Undoing everything still available walks back exactly that far and no
    // further, leaving the older work in place.
    let undone = 0;
    while (session.undo()) {
      undone += 1;
    }
    expect(undone).toBeGreaterThan(0);
    expect(store.graph.nodes).toHaveLength(200 - undone);
    expect(store.graphSnapshot.nodes).toHaveLength(200 - undone);
    expect(store.historyPosition).toBe(0);

    // And the document is still fully usable: a new edit lands normally.
    commit(session, store, "Create New Node", (graph) => {
      graph.nodes.push(buildNode(999));
    });
    expect(store.graph.nodes).toHaveLength(200 - undone + 1);
    session.destroy();
  });

  it("releasing old history lets the document shrink back", () => {
    const churn = (maxUndoSteps: number) => {
      const session = new GraphCrdtSession(`undo-size-${maxUndoSteps}`, { maxUndoSteps });
      session.seed(baseGraph("undo-size"));
      const store = storeHarness(session);
      for (let i = 0; i < 600; i += 1) {
        commit(session, store, "Create New Node", (graph) => {
          graph.nodes.push(buildNode(i));
          if (graph.nodes.length > 50) {
            graph.nodes.shift();
          }
        });
      }
      const size = session.byteLength;
      session.destroy();
      return size;
    };

    const bounded = churn(50);
    const unbounded = churn(100000);
    report("600 create-and-delete events, 50 nodes live", [
      { history: "bounded to 50", bytes: bounded },
      { history: "unbounded", bytes: unbounded },
    ]);
    // Keeping every action undoable keeps every deleted node alive with it.
    expect(bounded).toBeLessThan(unbounded);
    session_expect_ratio(bounded, unbounded);
  });

  it("restores every kind of change exactly", () => {
    const session = new GraphCrdtSession("undo-kinds");
    session.seed({ ...baseGraph("undo-kinds"), nodes: [buildNode(0), buildNode(1)] });
    const store = storeHarness(session);
    const original = JSON.stringify(store.graph);

    commit(session, store, "Update Graph Properties", (g) => {
      g.properties.name = "Renamed";
    });
    commit(session, store, "Move Nodes", (g) => {
      g.nodes[0].properties.x = 999;
      g.nodes[0].properties.y = 888;
    });
    commit(session, store, "Add Input", (g) => {
      g.nodes[1].properties.inputs.push({ name: "extra", type: "String", external: false, visible: true });
    });
    commit(session, store, "Add Connector", (g) => {
      g.nodes[0].edges[0].connectors.push({
        id: "c1", nodeId: g.nodes[1].id, field: "extra", graphId: "undo-kinds", version: 0,
      });
    });
    commit(session, store, "Update Template", (g) => {
      g.nodes[0].template.set = "edges.out = value * 2;\n";
    });
    commit(session, store, "Delete", (g) => {
      g.nodes.splice(1, 1);
    });

    expect(store.events.map((e: any) => e.description)).toEqual([
      "Update Graph Properties",
      "Move Nodes",
      "Add Input",
      "Add Connector",
      "Update Template",
      "Delete",
    ]);

    for (let i = 0; i < 6; i += 1) {
      session.undo();
    }
    // Byte-for-byte back where it started.
    expect(JSON.stringify(store.graph)).toBe(original);

    for (let i = 0; i < 6; i += 1) {
      session.redo();
    }
    expect(store.graph.properties.name).toBe("Renamed");
    expect(store.graph.nodes).toHaveLength(1);
    expect(store.graph.nodes[0].properties.x).toBe(999);
    expect(store.graph.nodes[0].template.set).toContain("value * 2");
    session.destroy();
  });

  it("keeps the label on a step as it moves between the stacks", () => {
    const session = new GraphCrdtSession("undo-labels");
    session.seed(baseGraph("undo-labels"));
    const store = storeHarness(session);
    const labels = ["Create New Node", "Move Nodes", "Group", "Delete"];
    labels.forEach((label, index) => {
      commit(session, store, label, (g) => {
        g.properties.description = `step ${index}`;
      });
    });

    expect(store.events.map((e: any) => e.description)).toEqual(labels);
    session.move(-4);
    expect(store.historyPosition).toBe(0);
    // Undone steps stay in the list under their own names so the history panel
    // can still offer them.
    expect(store.events.map((e: any) => e.description)).toEqual(labels);
    session.move(4);
    expect(store.events.map((e: any) => e.description)).toEqual(labels);
    expect(store.historyPosition).toBe(4);
    session.destroy();
  });

  it("collapses a continuous gesture into one step and a new one after it", () => {
    const session = new GraphCrdtSession("undo-gesture");
    session.seed({ ...baseGraph("undo-gesture"), nodes: [buildNode(0)] });
    const store = storeHarness(session);
    const nodeMap = session.doc.getMap("graph").get("nodes") as Y.Map<any>;
    const move = (x: number) => {
      session.transactLocal("Move Nodes", () => {
        (nodeMap.get("node-00000") as Y.Map<any>).get("properties").set("x", x);
      }, "drag");
    };

    commit(session, store, "Update Graph Properties", (g) => {
      g.properties.name = "Before the drag";
    });
    for (let i = 1; i <= 60; i += 1) {
      move(i * 5);
    }
    session.endLiveEdit();

    expect(store.graph.nodes[0].properties.x).toBe(300);
    expect(store.events.map((e: any) => e.description)).toEqual([
      "Update Graph Properties",
      "Move Nodes",
    ]);

    session.undo();
    // The whole drag goes at once, and the edit before it is untouched.
    expect(store.graph.nodes[0].properties.x).toBe(0);
    expect(store.graph.properties.name).toBe("Before the drag");

    session.undo();
    expect(store.graph.properties.name).toBe("E2E Graph");
    session.destroy();
  });

  it("a new edit clears what was waiting to be redone", () => {
    const session = new GraphCrdtSession("undo-branch");
    session.seed(baseGraph("undo-branch"));
    const store = storeHarness(session);

    commit(session, store, "First", (g) => { g.properties.description = "first"; });
    commit(session, store, "Second", (g) => { g.properties.description = "second"; });
    session.undo();
    expect(store.graph.properties.description).toBe("first");
    expect(store.events.map((e: any) => e.description)).toEqual(["First", "Second"]);

    commit(session, store, "Third", (g) => { g.properties.description = "third"; });
    // "Second" is gone: history moved onto a new branch.
    expect(store.events.map((e: any) => e.description)).toEqual(["First", "Third"]);
    session.redo();
    expect(store.graph.properties.description).toBe("third");
    session.destroy();
  });

  it("never rolls back a collaborator's work", () => {
    const local = new GraphCrdtSession("undo-shared");
    local.seed({ ...baseGraph("undo-shared"), nodes: [buildNode(0), buildNode(1)] });
    const store = storeHarness(local);

    const peer = new Y.Doc();
    applyUpdate(peer, encodeState(local.doc));

    // Interleave: local edit, remote edit, local edit, remote edit.
    commit(local, store, "Move Nodes", (g) => { g.nodes[0].properties.x = 100; });
    peer.transact(() => {
      (peer.getMap("graph").get("nodes") as Y.Map<any>)
        .get("node-00001").get("properties").set("name", "Renamed by peer");
    });
    local.applyRemote(encodeState(peer), "peer");

    commit(local, store, "Move Nodes", (g) => { g.nodes[0].properties.x = 200; });
    peer.transact(() => {
      (peer.getMap("graph").get("nodes") as Y.Map<any>)
        .get("node-00001").get("properties").set("description", "Described by peer");
    });
    local.applyRemote(encodeState(peer), "peer");

    expect(store.graph.nodes[0].properties.x).toBe(200);
    expect(names(store)).toContain("Renamed by peer");

    local.undo();
    local.undo();

    // Both local moves are gone; neither of the peer's edits was touched.
    expect(store.graph.nodes[0].properties.x).toBe(0);
    expect(names(store)).toContain("Renamed by peer");
    expect(store.graph.nodes[1].properties.description).toBe("Described by peer");
    expect(store.historyPosition).toBe(0);
    local.destroy();
  });

  it("survives undo and redo hammered a thousand times", () => {
    const session = new GraphCrdtSession("undo-hammer");
    session.seed(baseGraph("undo-hammer"));
    const store = storeHarness(session);

    for (let i = 0; i < 40; i += 1) {
      commit(session, store, "Create New Node", (g) => { g.nodes.push(buildNode(i)); });
    }
    const full = JSON.stringify(store.graph);

    let seed = 7;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 1000; i += 1) {
      if (random() < 0.5) {
        session.undo();
      } else {
        session.redo();
      }
      // The projection must always agree with the document underneath it.
      expect(store.graph.nodes.length).toBe(store.historyPosition);
    }

    while (session.redo()) {
      // wind all the way forward
    }
    expect(JSON.stringify(store.graph)).toBe(full);
    expect(store.graphSnapshot.nodes).toHaveLength(40);
    expect(toJSON(session.doc).nodes).toHaveLength(40);
    session.destroy();
  });
});
