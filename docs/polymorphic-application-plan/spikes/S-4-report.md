# Spike S-4 — cost of staged admission (result: exit criterion met, no cache layer needed for M1)

**Question.** What does one staged admission cost (load the merged head, clone it into a staging doc, apply the candidate update, project before/after, diff) at realistic graph and update-log sizes? Exit criterion from §9.3: p95 ≤ 250 ms with a warm cache.

**Method.** `spikes/s4-staging-cost.spec.ts` (vitest, run from the repo root with `--config docs/polymorphic-application-plan/spikes/vitest.config.ts`). Graphs of 100/500/2000 nodes built with the GraphCrdt test fixtures; a tail of 0/200/2000 granular updates produced by `reconcile()` exactly as the editor does; 20 candidate single-node code edits per cell produced by a second client on the same state; each admission timed by phase with the real `mergeUpdatesV2` / `applyUpdateV2` / `toJSON` / `deepEqual` from `packages/GraphCrdt`. CPU only — no S3 I/O. Workstation: Node v25.7.0, arm64 (Apple silicon).

**Result (p50/p95 ms per admission).**

| nodes | tail updates | merged bytes | merge | clone | project before | apply candidate | project after | diff | **total** |
|---|---|---|---|---|---|---|---|---|---|
| 100 | 0 | 64 KB | 0/0 | 2.8/5.5 | 0.4/1.9 | 0.1/0.3 | 0.3/0.4 | 0.3/0.6 | **4/6.7** |
| 100 | 200 | 66 KB | 2/7.1 | 2.1/4.5 | 0.3/3 | 0/0.1 | 0.2/0.7 | 0.3/1.6 | **5.4/10.5** |
| 100 | 2000 | 77 KB | 47.2/50.6 | 3.4/4.8 | 0.4/0.4 | 0.1/0.1 | 0.2/0.3 | 0.3/0.4 | **51.7/55.1** |
| 500 | 0 | 324 KB | 0/0 | 10.8/13.6 | 2.2/9.7 | 0.1/0.6 | 1.6/4.1 | 1.8/11 | **18.4/35.8** |
| 500 | 200 | 326 KB | 7.9/9.5 | 10.4/27 | 2.3/2.6 | 0.1/0.2 | 1.4/2 | 1.6/1.9 | **23.8/39.2** |
| 500 | 2000 | 339 KB | 43.7/54.3 | 12.4/15.5 | 2.2/5.1 | 0.1/0.2 | 1.8/5.2 | 1.6/5.3 | **63/75.6** |
| 2000 | 0 | 1303 KB | 0/0 | 52.2/82.3 | 9.3/35.2 | 0.2/0.2 | 7.1/10.3 | 5.8/8.1 | **76.7/104** |
| 2000 | 200 | 1306 KB | 24.8/26.7 | 54.7/75.9 | 9.3/12 | 0.1/0.3 | 7.1/9.4 | 6.7/7.8 | **102.8/125.9** |
| 2000 | 2000 | 1329 KB | 66.7/75 | 72.4/93.5 | 12.9/20 | 0.2/0.7 | 10.8/21.8 | 7.3/10.7 | **173.7/191.3** |

Every candidate produced exactly one changed node in the diff (correctness check in the spec).

**Reading.** The candidate itself is free (≤ 1 ms); cost is dominated by `merge` (grows with the unsnapshotted tail) and `clone` (grows with graph size). At the largest cell the whole admission is under the 250 ms criterion with **no cache at all**. A Lambda at 1024 MB on x86 will be slower than this workstation (assume 2–3×), which still meets the criterion for graphs ≤ 500 nodes with the current 10 s checkpoint cadence (tails of tens of updates, not thousands) and needs the warm per-Lambda doc cache keyed by head id (already in §4.4.2) only for graphs above ~1000 nodes.

**What the bench does not measure.** S3 I/O: today's `loadMerged` issues one sequential GET per unsnapshotted update (A2 §D.5), which dwarfs the CPU cost for long tails; the snapshot cadence, not the diff engine, is the lever. Memory: a 2000-node doc plus its staging clone is ~2.6 MB of update bytes and roughly 10× that in heap — fine for a 1024 MB Lambda.

**Decision enabled.** Admission (PB-021) is implemented without a cache layer in M1; the per-Lambda head cache is a follow-on tied to graph size telemetry. The spec stays in the repo as a regression bench for the diff engine.
