// Spike S-4: cost of staged admission (load merged head → clone → apply candidate → project before/after → diff)
// Run from the repo root:  npx vitest run --config docs/polymorphic-application-plan/spikes/vitest.config.ts
import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { fromJSON, toJSON, reconcile, encodeState, applyUpdate, mergeUpdates, deepEqual } from "../../../packages/GraphCrdt/main";
import { makeGraph, makeNode, makeConnector } from "../../../packages/GraphCrdt/__tests__/fixtures";

function buildGraph(n: number) {
  const nodes: any[] = [];
  for (let i = 0; i < n; i++) {
    const id = `n${i}`;
    const conn = i > 0 ? [makeConnector({ id: `c${i}`, nodeId: `n${i - 1}`, field: "in" })] : [];
    nodes.push(makeNode({ id, url: id, edges: [{ field: "out", connectors: conn }], template: { set: `edges.out = value + ${i};\n`, vue: "<template><div>node ${i}</div></template>" } }));
  }
  return makeGraph({ nodes });
}
const pct = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]; };
const r1 = (x: number) => Math.round(x * 10) / 10;

// A server-side "admit" for one candidate update, timed by phase.
function admitOnce(snapshot: Uint8Array, tail: Uint8Array[], candidate: Uint8Array) {
  const t: Record<string, number> = {};
  let t0 = performance.now();
  const merged = tail.length ? mergeUpdates([snapshot, ...tail]) : snapshot;          // CrdtStore.loadMerged (server) [FACT]
  t.merge = performance.now() - t0; t0 = performance.now();
  const staging = new Y.Doc(); applyUpdate(staging, merged);                             // staging clone
  t.clone = performance.now() - t0; t0 = performance.now();
  const before = toJSON(staging);                                                        // projection before
  t.projectBefore = performance.now() - t0; t0 = performance.now();
  applyUpdate(staging, candidate);                                                       // apply the candidate
  t.applyCandidate = performance.now() - t0; t0 = performance.now();
  const after = toJSON(staging);                                                         // projection after
  t.projectAfter = performance.now() - t0; t0 = performance.now();
  // semantic diff (node-granular, as diff.ts would do): changed/added/removed node ids + graph props
  const b = new Map(before.nodes.map((n: any) => [n.id, n])); const a = new Map(after.nodes.map((n: any) => [n.id, n]));
  const changed: string[] = [];
  for (const [id, n] of a) { const o = b.get(id); if (!o || !deepEqual(o, n)) changed.push(id); }
  for (const id of b.keys()) if (!a.has(id)) changed.push(id);
  t.diff = performance.now() - t0;
  staging.destroy();
  t.total = t.merge + t.clone + t.projectBefore + t.applyCandidate + t.projectAfter + t.diff;
  return { t, changed, bytes: merged.byteLength };
}

describe("S-4 staged admission cost", () => {
  const rows: string[] = [];
  for (const nodes of [100, 500, 2000]) {
    for (const tailLen of [0, 200, 2000]) {
      it(`${nodes} nodes, ${tailLen} updates since snapshot`, () => {
        const graph = buildGraph(nodes);
        const doc = fromJSON(graph);
        const snapshot = encodeState(doc);
        // build a tail of granular updates by reconciling small snapshot edits (like the editor does)
        const tail: Uint8Array[] = [];
        doc.on("updateV2", (u: Uint8Array) => tail.push(u));
        for (let k = 0; k < tailLen; k++) {
          const g = toJSON(doc); const n = g.nodes[k % nodes]; n.properties.x = k; n.properties.lastUpdate = 1000 + k;
          reconcile(doc, g, { source: "bench" });
        }
        doc.off("updateV2", () => {});
        // candidates: 20 distinct single-node edits produced by a "client" holding the same state
        const client = new Y.Doc(); applyUpdate(client, mergeUpdates([snapshot, ...tail]));
        const candidates: Uint8Array[] = [];
        client.on("updateV2", (u: Uint8Array) => candidates.push(u));
        for (let k = 0; k < 20; k++) { const g = toJSON(client); g.nodes[(k * 7) % nodes].template.set = `edges.out = value * ${k};\n`; reconcile(client, g, { source: "client" }); }
        const phases: Record<string, number[]> = {}; let bytes = 0; let changedOk = true;
        for (const c of candidates) { const r = admitOnce(snapshot, tail, c); bytes = r.bytes; for (const [k, v] of Object.entries(r.t)) (phases[k] ||= []).push(v); if (r.changed.length !== 1) changedOk = false; }
        expect(changedOk).toBe(true);
        const fmt = (k: string) => `${r1(pct(phases[k], 50))}/${r1(pct(phases[k], 95))}`;
        rows.push(`| ${nodes} | ${tailLen} | ${Math.round(bytes / 1024)} KB | ${fmt("merge")} | ${fmt("clone")} | ${fmt("projectBefore")} | ${fmt("applyCandidate")} | ${fmt("projectAfter")} | ${fmt("diff")} | **${fmt("total")}** |`);
      }, 600000);
    }
  }
  it("prints the table", () => {
    const header = "| nodes | tail updates | merged bytes | merge p50/p95 ms | clone | project before | apply candidate | project after | diff | total p50/p95 ms |\n|---|---|---|---|---|---|---|---|---|---|";
    console.log("\nS-4 RESULTS (" + process.version + ", " + process.arch + ")\n" + header + "\n" + rows.join("\n") + "\n");
  });
});
