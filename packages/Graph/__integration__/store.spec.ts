import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import * as Y from "yjs";
import { useStore as useGraphStore, useGraphSnapshotStore } from "../store";
import { useStore as useOrchestratorStore } from "@plastic-io/graph-editor-vue3-orchestrator";
import {
  useStore as usePreferencesStore,
  UserPreferences,
} from "@plastic-io/graph-editor-vue3-preferences-provider";
import { applyUpdate, encodeState } from "@plastic-io/graph-crdt";

/** Stands in for the browser persistence provider, recording the update log. */
class MemoryProvider {
  readonly name = "memory";
  readonly historyPriority = 1;
  disconnected = 0;
  updates: { seq: number; time: number; description: string; update: Uint8Array }[] = [];
  session: any = null;
  seed: Uint8Array | null = null;

  async connect(graphId: string, session: any) {
    this.session = session;
    if (this.seed) {
      session.applyRemote(this.seed, "memory");
    }
    session.onUpdate((update: Uint8Array, origin: any) => {
      if (origin && origin.source === "memory") {
        return;
      }
      this.updates.push({
        seq: this.updates.length + 1,
        time: Date.now(),
        description:
          origin && origin.description
            ? origin.description
            : origin && origin.source === "seed"
              ? "Start"
              : "Remote change",
        update,
      });
    });
  }
  async history() {
    return this.updates.map(({ seq, time, description }) => ({
      seq,
      time,
      description,
      userId: "test",
    }));
  }
  async updatesFor(_graphId: string, entry: { seq: number }) {
    return this.updates.filter((u) => u.seq <= entry.seq).map((u) => u.update);
  }
  disconnect() {
    this.disconnected += 1;
    this.session = null;
  }
}

function setup(options: { legacyGraph?: any; provider?: MemoryProvider } = {}) {
  setActivePinia(createPinia());

  const preferences = usePreferencesStore();
  preferences.preferences = new UserPreferences();
  preferences.preferences.newNodeHelp = false;

  const orchestrator = useOrchestratorStore();
  // The scheduler spins up a real web worker, which a test environment has no
  // use for and jsdom cannot provide.
  orchestrator.createScheduler = async () => {};
  orchestrator.dataProviders.graph = {
    async get() {
      if (options.legacyGraph) {
        return options.legacyGraph;
      }
      throw new Error("Resource not found.");
    },
    async subscribe() {},
  } as any;

  const provider = options.provider || new MemoryProvider();
  orchestrator.syncProviders.push(provider);

  return {
    orchestrator,
    provider,
    graph: useGraphStore(),
    snapshotStore: useGraphSnapshotStore(),
  };
}

describe("graph store on the CRDT engine", () => {
  it("reloads the graph from the server after a rejected change, clearing the browser copy", async () => {
    const { graph, orchestrator, provider } = setup();
    const removed: string[] = [];
    // stands in for the IndexedDB provider: the only one whose copy must be cleared
    orchestrator.syncProviders.push({
      name: "indexeddb",
      historyPriority: 1,
      async connect() {},
      disconnect() {},
      async remove(graphId: string) { removed.push(graphId); },
    } as any);
    await graph.open("reject-me");
    const first = graph.crdtSession;
    graph.createNewNode({ x: 1, y: 2 } as any);
    graph.updateGraphFromSnapshot("Add node");
    expect(graph.graph.nodes).toHaveLength(1);
    // what the server holds: the graph as it stood before the refused change
    provider.seed = provider.updates[0].update;
    await graph.reloadFromServer("test: the server refused the change");
    expect(removed).toEqual(["reject-me"]);
    expect(graph.crdtSession).not.toBe(first);
    expect(graph.graphLoaded).toBe(true);
    expect(graph.graph.id).toBe("reject-me");
    expect(graph.graph.nodes).toHaveLength(0);
    expect(provider.disconnected).toBe(1);
  });

  it("creates a new graph when nothing is stored", async () => {
    const { graph } = setup();
    await graph.open("brand-new");
    expect(graph.isNewGraph).toBe(true);
    expect(graph.graph.id).toBe("brand-new");
    expect(graph.graph.nodes).toEqual([]);
    expect(graph.crdtSession).toBeTruthy();
    expect(graph.graphLoaded).toBe(true);
  });

  it("imports a pre-CRDT graph out of the legacy store", async () => {
    const legacyGraph = {
      id: "legacy-1",
      version: 7,
      url: "LegacyGraph",
      nodes: [
        {
          id: "old-node",
          edges: [{ field: "out", connectors: [] }],
          version: 7,
          graphId: "legacy-1",
          artifact: null,
          url: "oldnode",
          data: null,
          properties: {
            inputs: [],
            outputs: [{ name: "out", type: "Object", external: false, visible: true }],
            groups: [],
            name: "Old Node",
            description: "",
            createdOn: 5,
            tags: [],
            icon: "mdi-node-rectangle",
            positionAbsolute: false,
            appearsInPresentation: false,
            appearsInExport: false,
            x: 1,
            y: 2,
            z: 0,
            presentation: { x: 1, y: 2, z: 0 },
          },
          template: { set: "old set", vue: "<template><b/></template>" },
        },
      ],
      properties: { name: "Legacy", description: "", icon: "mdi-graph", template: "<div/>" },
    };
    const { graph } = setup({ legacyGraph });
    await graph.open("legacy-1");
    expect(graph.isNewGraph).toBe(false);
    expect(graph.graph.nodes).toHaveLength(1);
    expect(graph.graph.nodes[0].properties.name).toBe("Old Node");
    expect(graph.graph.nodes[0].template.set).toBe("old set");
  });

  it("creating a node reaches the document, the graph and the scheduler copy", async () => {
    const { graph, snapshotStore } = setup();
    await graph.open("g1");
    graph.createNewNode({ x: 120, y: 240 });

    expect(graph.graphSnapshot.nodes).toHaveLength(1);
    expect(graph.graph.nodes).toHaveLength(1);
    expect(snapshotStore.graph.nodes).toHaveLength(1);
    expect(graph.crdtSession.projection().nodes).toHaveLength(1);
    expect(graph.events.map((e: any) => e.description)).toEqual(["Create New Node"]);
  });

  it("undo and redo run through the whole editor pipeline", async () => {
    const { graph, snapshotStore } = setup();
    await graph.open("g1");
    graph.createNewNode({ x: 10, y: 10 });
    const nodeId = graph.graph.nodes[0].id;

    graph.selectedNodes = [graph.graph.nodes[0]];
    graph.addInput({ nodeId, name: "extra", type: "String", external: false, visible: true });
    expect(graph.graph.nodes[0].properties.inputs.map((i: any) => i.name)).toEqual(["extra"]);
    expect(graph.historyPosition).toBe(2);

    graph.undo();
    expect(graph.graph.nodes[0].properties.inputs).toEqual([]);
    expect(graph.graphSnapshot.nodes[0].properties.inputs).toEqual([]);
    expect(graph.historyPosition).toBe(1);

    graph.redo();
    expect(graph.graph.nodes[0].properties.inputs.map((i: any) => i.name)).toEqual(["extra"]);
    expect(snapshotStore.graph.nodes[0].properties.inputs.map((i: any) => i.name)).toEqual([
      "extra",
    ]);

    graph.undo();
    graph.undo();
    expect(graph.graph.nodes).toEqual([]);
    expect(graph.historyPosition).toBe(0);
  });

  it("labels history entries with the action that produced them", async () => {
    const { graph } = setup();
    await graph.open("g1");
    graph.createNewNode({ x: 0, y: 0 });
    const nodeId = graph.graph.nodes[0].id;
    graph.addOutput({ nodeId, name: "out2", type: "Object", external: false, visible: true });
    graph.selectedNodes = [graph.graph.nodes[0]];
    graph.groupSelected();

    expect(graph.events.map((e: any) => e.description)).toEqual([
      "Create New Node",
      "Add Output",
      "Group",
    ]);
    graph.moveHistoryPosition(-2);
    expect(graph.historyPosition).toBe(1);
    // undone entries stay in the list so the panel can offer a redo
    expect(graph.events.map((e: any) => e.description)).toEqual([
      "Create New Node",
      "Add Output",
      "Group",
    ]);
  });

  it("deleting a node also drops the connectors that pointed at it", async () => {
    const { graph } = setup();
    await graph.open("g1");
    graph.createNewNode({ x: 0, y: 0 });
    graph.createNewNode({ x: 100, y: 0 });
    const [a, b] = graph.graphSnapshot.nodes;
    graph.addOutput({ nodeId: a.id, name: "out", type: "Object", external: false, visible: true });
    graph.addInput({ nodeId: b.id, name: "in", type: "Object", external: false, visible: true });

    const find = (id: string) => graph.graph.nodes.find((n: any) => n.id === id);
    const edge = graph.graphSnapshot.nodes.find((n: any) => n.id === a.id).edges
      .find((e: any) => e.field === "out");
    edge.connectors.push({
      id: "c1",
      nodeId: b.id,
      field: "in",
      graphId: "g1",
      version: 1,
    });
    graph.updateGraphFromSnapshot("Add Connector");
    expect(find(a.id).edges.find((e: any) => e.field === "out").connectors).toHaveLength(1);

    graph.selectedNodes = [find(b.id)];
    graph.deleteSelected();
    expect(graph.graph.nodes).toHaveLength(1);
    expect(find(a.id).edges.find((e: any) => e.field === "out").connectors).toEqual([]);
  });

  it("a remote edit survives the next local save", async () => {
    const { graph } = setup();
    await graph.open("g1");
    graph.createNewNode({ x: 0, y: 0 });

    // a collaborator adds their own node to a copy of the document
    const peer = new Y.Doc();
    applyUpdate(peer, encodeState(graph.crdtSession.doc));
    const peerRoot = peer.getMap("graph");
    const peerNodes = peerRoot.get("nodes") as Y.Map<any>;
    const mine = graph.crdtSession.doc.getMap("graph").get("nodes") as Y.Map<any>;
    const templateNode = mine.get(Array.from(mine.keys())[0]) as Y.Map<any>;
    peer.transact(() => {
      peerNodes.set("peer-node", templateNode.clone());
      (peerNodes.get("peer-node") as Y.Map<any>).set("id", "peer-node");
    });
    graph.crdtSession.applyRemote(encodeState(peer), "peer");

    expect(graph.graph.nodes).toHaveLength(2);
    expect(graph.graphSnapshot.nodes).toHaveLength(2);

    // the next local save must not wipe out what the collaborator did
    graph.createNewNode({ x: 300, y: 300 });
    expect(graph.graph.nodes).toHaveLength(3);
    expect(graph.crdtSession.projection().nodes).toHaveLength(3);
  });

  it("does not write to the document when nothing actually changed", async () => {
    const { graph, provider } = setup();
    await graph.open("g1");
    graph.createNewNode({ x: 0, y: 0 });
    const before = provider.updates.length;
    graph.updateGraphFromSnapshot("No-op");
    expect(provider.updates.length).toBe(before);
  });

  it("bumps the graph version once per saved change", async () => {
    const { graph } = setup();
    await graph.open("g1");
    const start = graph.graph.version;
    graph.createNewNode({ x: 0, y: 0 });
    expect(graph.graph.version).toBe(start + 1);
    graph.createNewNode({ x: 50, y: 50 });
    expect(graph.graph.version).toBe(start + 2);
  });

  it("rewinds to an earlier point and commits it as an ordinary edit", async () => {
    const { graph } = setup();
    await graph.open("g1");
    graph.createNewNode({ x: 0, y: 0 });
    graph.createNewNode({ x: 60, y: 0 });
    expect(graph.graph.nodes).toHaveLength(2);

    const history = await graph.listRewindHistory();
    expect(history.map((h: any) => h.description)).toEqual([
      "Start",
      "Create New Node",
      "Create New Node",
    ]);

    await graph.previewRewind(history[1]);
    expect(graph.graph.nodes).toHaveLength(1);
    expect(graph.inRewindMode).toBe(true);

    await graph.exitRewind();
    expect(graph.graph.nodes).toHaveLength(2);
    expect(graph.inRewindMode).toBe(false);

    await graph.commitRewind(history[1]);
    expect(graph.graph.nodes).toHaveLength(1);
    expect(graph.events[graph.events.length - 1].description).toBe("Revert");

    // and the revert itself is undoable
    graph.undo();
    expect(graph.graph.nodes).toHaveLength(2);
  });

  it("a drag streams positions and still undoes in one step", async () => {
    const { graph, provider } = setup();
    await graph.open("g1");
    graph.createNewNode({ x: 0, y: 0 });
    const nodeId = graph.graph.nodes[0].id;
    const updatesBefore = provider.updates.length;

    // three frames of a drag
    for (const x of [10, 20, 30]) {
      graph.setNodePositions([{ id: nodeId, x, y: x * 2 }], false);
    }
    graph.endNodeDrag();

    expect(graph.graph.nodes[0].properties.x).toBe(30);
    expect(graph.graph.nodes[0].properties.y).toBe(60);
    // every frame reached the document, so collaborators saw the drag happen
    expect(provider.updates.length).toBeGreaterThan(updatesBefore);
    // but it is a single entry in the history
    expect(graph.events.map((e: any) => e.description)).toEqual([
      "Create New Node",
      "Move Nodes",
    ]);

    graph.undo();
    expect(graph.graph.nodes[0].properties.x).toBe(0);
    expect(graph.graphSnapshot.nodes[0].properties.x).toBe(0);
  });

  it("a drag does not disturb a node someone else is editing", async () => {
    const { graph } = setup();
    await graph.open("g1");
    graph.createNewNode({ x: 0, y: 0 });
    graph.createNewNode({ x: 100, y: 0 });
    const [first, second] = graph.graph.nodes.map((n: any) => n.id);

    // a collaborator renames the second node mid-drag
    const peer = new Y.Doc();
    applyUpdate(peer, encodeState(graph.crdtSession.doc));
    graph.setNodePositions([{ id: first, x: 5, y: 5 }], false);
    peer.transact(() => {
      const nodes = peer.getMap("graph").get("nodes") as Y.Map<any>;
      (nodes.get(second) as Y.Map<any>).get("properties").set("name", "Renamed by peer");
    });
    graph.crdtSession.applyRemote(encodeState(peer), "peer");
    graph.setNodePositions([{ id: first, x: 15, y: 15 }], false);
    graph.endNodeDrag();

    const find = (id: string) => graph.graph.nodes.find((n: any) => n.id === id);
    expect(find(first).properties.x).toBe(15);
    expect(find(second).properties.name).toBe("Renamed by peer");
  });

  it("hands the code editor the shared text behind a template", async () => {
    const { graph } = setup();
    await graph.open("g1");
    graph.createNewNode({ x: 0, y: 0 });
    const nodeId = graph.graph.nodes[0].id;

    const vue = graph.nodeTemplateText(nodeId, "vue");
    const set = graph.nodeTemplateText(nodeId, "set");
    expect(vue).toBeTruthy();
    expect(set).toBeTruthy();
    expect(vue.toString()).toBe(graph.graph.nodes[0].template.vue);

    // Typing flows back out through the projection, though not synchronously:
    // text edits are batched so that a burst of keystrokes does not rebuild
    // the whole graph once per character.
    vue.insert(0, "<!-- typed -->");
    expect(graph.graph.nodes[0].template.vue.startsWith("<!-- typed -->")).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(graph.graph.nodes[0].template.vue.startsWith("<!-- typed -->")).toBe(true);
    expect(graph.graphSnapshot.nodes[0].template.vue.startsWith("<!-- typed -->")).toBe(true);

    expect(graph.graphTemplateText()).toBeTruthy();
    expect(graph.nodeTemplateText("no-such-node", "vue")).toBeNull();
    expect(graph.nodeTemplateText(nodeId, "nope")).toBeNull();
  });

  it("two people typing in the same template keep both edits", async () => {
    const { graph } = setup();
    await graph.open("g1");
    graph.createNewNode({ x: 0, y: 0 });
    const nodeId = graph.graph.nodes[0].id;
    const local = graph.nodeTemplateText(nodeId, "set");
    local.delete(0, local.length);
    local.insert(0, "const a = 1;\nconst b = 2;\n");

    const peer = new Y.Doc();
    applyUpdate(peer, encodeState(graph.crdtSession.doc));
    const peerText = (peer.getMap("graph").get("nodes") as Y.Map<any>)
      .get(nodeId)
      .get("template")
      .get("set");
    peerText.insert(peerText.toString().indexOf("const b"), "const middle = 0;\n");
    local.insert(0, "// header\n");

    graph.crdtSession.applyRemote(encodeState(peer), "peer");
    await new Promise((resolve) => setTimeout(resolve, 400));

    const merged = graph.graph.nodes[0].template.set;
    expect(merged).toContain("// header");
    expect(merged).toContain("const middle = 0;");
    expect(merged).toContain("const a = 1;");
    expect(merged).toContain("const b = 2;");
  });

  it("releases the previous graph when another one is opened", async () => {
    const { graph, provider } = setup();
    await graph.open("g1");
    graph.createNewNode({ x: 0, y: 0 });
    const first = graph.crdtSession;
    expect(graph.historyPosition).toBe(1);

    await graph.open("g2");
    expect(provider.disconnected).toBe(1);
    expect(graph.crdtSession).not.toBe(first);
    // history belongs to the graph, so it does not follow you to the next one
    expect(graph.historyPosition).toBe(0);
    expect(graph.events).toEqual([]);
  });

  it("reopens a graph from the stored update log", async () => {
    const provider = new MemoryProvider();
    const first = setup({ provider });
    await first.graph.open("g1");
    first.graph.createNewNode({ x: 0, y: 0 });
    const expected = first.graph.graph.nodes[0].id;
    const state = encodeState(first.graph.crdtSession.doc);

    const reopened = new MemoryProvider();
    reopened.seed = state;
    const second = setup({ provider: reopened });
    await second.graph.open("g1");
    expect(second.graph.isNewGraph).toBe(false);
    expect(second.graph.graph.nodes.map((n: any) => n.id)).toEqual([expected]);
  });
});
