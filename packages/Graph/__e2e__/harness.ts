import * as Y from "yjs";
import { fromJSON, encodeState } from "@plastic-io/graph-crdt";
import { GraphCrdtSession } from "../crdt";
import patchInto from "../project";

/** Wall-clock statistics for a run of timed operations. */
export interface Timing {
  count: number;
  totalMs: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
}

export function summarise(samples: number[]): Timing {
  const sorted = [...samples].sort((a, b) => a - b);
  const total = samples.reduce((sum, value) => sum + value, 0);
  const at = (pct: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * pct))] || 0;
  return {
    count: samples.length,
    totalMs: round(total),
    meanMs: round(total / (samples.length || 1)),
    p50Ms: round(at(0.5)),
    p95Ms: round(at(0.95)),
    maxMs: round(sorted[sorted.length - 1] || 0),
  };
}

export function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function kb(bytes: number): number {
  return Math.round((bytes / 1024) * 10) / 10;
}

/** Size of the document if it were sent to a peer that has nothing. */
export function stateSize(session: GraphCrdtSession): number {
  return encodeState(session.doc).byteLength;
}

/** The same document in the older encoding, for comparison in reports. */
export function legacySize(session: GraphCrdtSession): number {
  return Y.encodeStateAsUpdate(session.doc).byteLength;
}

/**
 * What a document holding the same live content would cost if it had just been
 * built, with no history behind it.
 *
 * Comparing against this rather than against a fixed number of kilobytes is
 * what makes the size assertions meaningful: they say the document is
 * proportional to the graph in it, not to the number of times it has been
 * edited, which is the property that actually has to hold.
 */
export function freshSize(session: GraphCrdtSession): number {
  const projection = session.projection();
  const fresh = fromJSON(projection || {});
  const size = encodeState(fresh).byteLength;
  fresh.destroy();
  return size;
}

/** Print a small table so a regression is visible in the run output. */
export function report(title: string, rows: Record<string, string | number>[]) {
  const line = "-".repeat(title.length);
  console.log(`\n${title}\n${line}`);
  console.table(rows);
}

/**
 * The three plain-JSON trees the editor keeps, fed from the session exactly
 * as the Pinia store feeds them.  Using the real wiring is the point: a change
 * that made projection quadratic would show up here.
 */
export function storeHarness(session: GraphCrdtSession) {
  const store: any = {
    graph: null,
    graphSnapshot: null,
    schedulerCopy: null,
    events: [],
    historyPosition: 0,
    projectionCount: 0,
    projectionMs: 0,
  };
  const seed = session.projection();
  store.graph = patchInto(null, seed);
  store.graphSnapshot = patchInto(null, seed);
  store.schedulerCopy = patchInto(null, seed);

  session.onProjection((next: any, info: any) => {
    const started = performance.now();
    store.graph = patchInto(store.graph, next);
    if (!info.local) {
      store.graphSnapshot = patchInto(store.graphSnapshot, next);
    }
    store.schedulerCopy = patchInto(store.schedulerCopy, next);
    store.projectionCount += 1;
    store.projectionMs += performance.now() - started;
  });
  session.onHistory((events: any[], position: number) => {
    store.events = events;
    store.historyPosition = position;
  });
  session.refresh();
  return store;
}

export function baseGraph(id = "e2e-graph") {
  return {
    id,
    version: 0,
    url: "E2EGraph",
    nodes: [] as any[],
    properties: {
      name: "E2E Graph",
      description: "",
      exportable: false,
      icon: "mdi-graph",
      createdBy: "e2e",
      createdOn: 1,
      lastUpdate: 1,
      height: 150,
      width: 300,
      timeout: 30000,
      logLevel: 2,
      template: "<template><div/></template>",
    },
  };
}

export function buildNode(index: number) {
  const id = `node-${String(index).padStart(5, "0")}`;
  return {
    id,
    edges: [{ field: "out", connectors: [] as any[] }],
    version: 0,
    graphId: "e2e-graph",
    artifact: null,
    url: id,
    data: null,
    properties: {
      inputs: [{ name: "in", type: "Object", external: false, visible: true }],
      outputs: [{ name: "out", type: "Object", external: false, visible: true }],
      groups: [] as string[],
      name: `Node ${index}`,
      description: "",
      createdOn: index,
      lastUpdate: index,
      tags: [] as string[],
      icon: "mdi-node-rectangle",
      positionAbsolute: false,
      appearsInPresentation: false,
      appearsInExport: false,
      x: (index % 50) * 120,
      y: Math.floor(index / 50) * 90,
      z: 0,
      presentation: { x: 0, y: 0, z: 0 },
    },
    template: {
      set: "edges.out = value;\n",
      vue: "<template><div>node</div></template>",
    },
  };
}
