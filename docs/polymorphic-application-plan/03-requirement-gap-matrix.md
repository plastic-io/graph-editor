# 3. Requirement and gap matrix

Classification: **PA** present and adequate · **PI** present but incomplete · **AB** absent · **CO** contradictory · **UV** unverified. Work items `PB-nnn`, spikes `S-n` and decisions `D-n` are defined in §9–§10. Requirement IDs are from appendix A5 (the brief, section by section).

| Req | Requirement (short) | Current evidence | Class | Target design | Work items | Tests / acceptance | Open |
|---|---|---|---|---|---|---|---|
| R-2.1 | Graph is authoritative; agents propose transactions | One Y.Doc per graph is the only write path for editors (GS-13..20); no proposal concept | PI | §4.1, §4.4 admission, §4.7 proposals | PB-020..027, PB-035 | admission suite: every mutation has actor+id+base; no S3 write outside `CrdtStore.appendUpdate`/`RevisionStore` | — |
| R-2.2 | Deploy-once model with substrate repair route | Serverless deploy from laptop; no CI deploy; no backups (GS-A.3) | PI | §4.10 substrate evolution | PB-124, PB-125, PB-095 | restore drill from S3 versioning; deploy from tag via CI | D-8 backup retention |
| R-2.3 | Published component = unit of reuse/version/permission/test | Artifacts exist but overwritable; instance embeds copy; no contract/tests/capabilities (GS-26, GE-46/51) | PI | §4.3 ComponentManifest | PB-040..047 | publish twice same version → 412; import verifies digest | — |
| R-2.4 | Edges are bindings + observability; no hidden channels | False in all domains (§2.5) | CO | §4.5 capability host + observations | PB-050..057 | negative tests: `require`, `AWS`, `fetch` undefined in sandbox; every effect emits observation | — |
| R-2.5 | One graph across browser/server with distinct authority | Server runs checkpoint, browser runs snapshot; no ownership rule (GS-27, GE-36) | AB | §4.8 hybrid execution | PB-070..074 | dedup test: N browsers, 1 effect | — |
| R-2.6 | Glossary tied to types | — | done | §2.6 | — | — | — |
| R-3.x | Evidence ledger, classification, open questions | — | done | §2, appendices, §10 | — | — | — |
| R-4.1 | Server map | A2 | done | — | — | — | — |
| R-4.2 | Editor map | A1 | done | — | — | — | — |
| R-4.3 | Rust map | A3 §D–F | done | — | — | — | — |
| R-4.4 | TS scheduler map + skew | A3 §A–C | done | — | PB-061 | server on 2.0.4 with completion semantics | — |
| R-4.5 | Cross-repo ownership/diagram/debt | §2.3–2.5 | done | §5.3 schema package | PB-120, PB-121 | — | — |
| R-5.1 | Authoritative vs derived; secrets separate | Layout/runtime state mixed in one doc; no secrets model; embedded copies | PI | §4.1 table | PB-021 (namespaces), PB-050 | diff shows `layout` vs `definition` namespaces | — |
| R-5.2 | Publication/version/immutability/deps/upgrade | overwritable; integer versions only; no deps | PI | §4.3 | PB-041, PB-043, PB-044 | cycle detection test; missing version → unresolved state | — |
| R-5.3 | Proposals at graph/instance/definition level; consumers visible; activation unit | none | AB | §4.3.4, §4.7 | PB-035, PB-044 | impact report lists consumers | D-6 |
| R-5.4 | Type extensions + serialization | — | AB | §5.3 | PB-121 | schema round-trip TS↔Rust | — |
| R-5.5 | Boundary validation/assignability/error payloads | port `type` is free text (GE-B.2) | AB | §4.3.5 | PB-045 | ajv on every edge delivery in tests | — |
| R-5.6 | Cache keys/invalidation, immutable identity | none | AB | §4.3.6 | PB-041, PB-043 | digest mismatch → clear error | — |
| R-5.7 | Reference integrity, detached resources | delete strips connectors (GE-C.1) | PI | §4.3.7 | PB-044, PB-093 | rollback keeps stack; drift report | — |
| R-5.8 | Worked recursive example | — | — | §6.5 | — | — | — |
| R-6.1 | Single admission choke point for all clients | one write path but 6 bypass routes (A2 §I.1) | CO | §4.4 | PB-015, PB-020..027 | route inventory test: only `yjs`, `POST /crdt/{id}/update` (authenticated) and `/mcp` mutate | — |
| R-6.2 | Verify check-before-admit; bypasses; raw-Yjs problem | no check exists (GS-05/13); raw updates carry no intent | CO | §4.4.2 staging mediation | PB-021 | garbage frame rejected before store/fan-out | S-4 |
| R-6.3 | Submission mechanism | raw V2 updates | PI | D-1: editor keeps raw updates + envelope; agents send semantic ops materialised server-side | PB-020, PB-026 | same MutationRecord from both paths (trace §6.1) | D-1 |
| R-6.4 | Admission contract fields; server-derived values; bound decision | none | AB | §5.1 `MutationEnvelope`, `AdmissionResult` | PB-020, PB-023 | forged `sub` ignored; decision digest = committed bytes | — |
| R-6.5 | Batch/concurrency/stale/conflict/undo/offline/reconnect; rejection handling | fire-and-forget; no resync (GE-23/24) | AB | §4.4.4 | PB-024, PB-027, S-2 | reject → local doc rebuilt from server state; offline edits re-admitted individually | S-2 |
| R-6.6 | Separate authorities; propagation; revocation; no self-broadening | none | AB | §4.4.3 matrix | PB-013, PB-022 | ACL edit via ordinary update → rejected (namespace `policy` not in Y.Doc) | — |
| R-6.7 | Authorization matrix + decision procedure | none | AB | §7.2 | PB-013, PB-022 | table-driven policy tests | — |
| R-7.1 | Map edges to bindings; inventory effects | §2.5 | done/CO | §4.5 | PB-051, PB-052 | — | — |
| R-7.2 | Capability grant model; anti-escalation | none | AB | §4.5.2 | PB-050, PB-022 | nested request > parent → publish rejected | — |
| R-7.3 | Edge activity as trace with correlation ids | events exist, not persisted, no ids (RT-09, GS-30) | PI | §4.5.3 `Observation` | PB-053, PB-054 | every hop has executionId/spanId/revisionId | — |
| R-7.4 | Ordering/delivery/retention/redaction/subscriptions | none | AB | §4.5.4 | PB-054..057 | volume cap test; redaction test | D-9 retention |
| R-7.5 | Summary → hop traceability; leakage | none | AB | §4.5.5 | PB-055 | subscriber without `inspect-payloads` sees `[redacted]` | — |
| R-7.6 | Envelope/representation/storage examples | — | — | §5.2, §6.3 | — | — | — |
| R-8.1 | Hybrid path browser↔server | `executeGraph` WS + `graph-notify` (GE-41, GS-30) | PI | §4.8 | PB-071 | trace §6.3 | — |
| R-8.2 | Placement in contract; what crosses | none; `tags:["browser"]` only hint | AB | §4.8.1 | PB-070 | server refuses browser-only node; secretRef never serialised | — |
| R-8.3 | Ownership; no-browser/multi-browser/reconnect/restart/timeout | none | AB | §4.8.2 | PB-071..073 | dedup and replay tests | — |
| R-8.4 | Hyperedge semantics across domains | in-process only (RT-06/08) | PI | §4.8.3 | PB-060, PB-071 | partial-failure test | — |
| R-8.5 | Structure changes vs running work; version skew | executors follow live doc (C3) | CO | §4.7.4 pinning | PB-033, PB-074 | in-flight keeps old revision | — |
| R-8.6 | Sequence diagram | — | — | §6.3 | — | — | — |
| R-9.1 | Boundary assessment | none in TS; Rust isolate per node but no limits (RT-25/34) | done | §4.6.1 | — | — | — |
| R-9.2 | Thread/isolate ownership, fairness | Rust: caller thread, re-entrant nested isolates (RT-30); server: one `worker_threads` Worker per request (GS-A2 F.2) | done | §4.6.2 | PB-062 | — | — |
| R-9.3 | Real termination plan | absent everywhere (RT-14/34, GS-12) | AB | §4.6.3 (isolated-vm timeout/dispose; rusty_v8 `IsolateHandle::terminate_execution`) | PB-062, PB-063, S-1 | `while(true)` terminated ≤ budget+100 ms; sibling unaffected | S-1 |
| R-9.4/9.5 | Hierarchical budgets and dimensions | absent | AB | §4.6.4 | PB-060, PB-064, PB-065 | fan-out storm capped; child cannot exceed parent | D-4 |
| R-9.6 | OOM separate from cancel; adversarial cases | Rust: fatal OOM kills process (RT-35) | AB | §4.6.5 | PB-066 | heap bomb → isolate disposed, Lambda survives | S-1 |
| R-9.7 | Lifecycle diagrams, handle types, acceptance | — | — | §4.6.6, §5.3 | — | — | — |
| R-10.1 | MCP as interface to same primitives/admission | none | AB | §5 | PB-080..087 | tool → service call, never S3 direct (static import test) | — |
| R-10.2 | Actual SDK/protocol versions; transport/auth/session | A4 | done | §5.0 | PB-080 | — | D-3 |
| R-10.3 | Coverage of required capabilities | — | AB | §5.1 catalog | PB-081..085 | — | — |
| R-10.4/10.5/10.6 | Per-tool/resource specs, envelopes | — | AB | §5.1, §5.2 | PB-081..083 | schema tests: unknown field → SCHEMA_INVALID | — |
| R-11.x | Bounded, revision-aware traversal; summaries; worked example | none | AB | §4.2 summaries, §6.2 | PB-081 | truncation flags present; cursor stable per revision | — |
| R-12.1 | Yjs ↔ immutable revisions; compaction | snapshots + ULID log; no revision (GS-17/19) | PI | §4.7.1 | PB-030, PB-031, PB-038 | revision reconstructible from log after compaction | — |
| R-12.2 | Mutation lifecycle states | none | AB | §4.7.2 | PB-035, PB-036 | state machine tests incl. crash recovery | — |
| R-12.3 | Semantic diffs; provenance; tamper evidence | none | AB | §4.7.3 | PB-034, PB-056 | diff of fixture pairs; hash chain verified | D-10 signatures |
| R-12.4 | Commit vs activation; consistency; recovery | none | AB | §4.7.4 | PB-032, PB-033 | crash between commit and activation → recover | — |
| R-12.5/12.6 | Replay/simulation/shadow | none | AB | §4.7.5 | PB-035 (simulate), PB-106 | effect classes enforced in simulation | — |
| R-12.7 | Rollback per layer; residual drift | rewind exists (GE-55) as an ordinary edit | PI | §4.7.6 | PB-037, PB-093 | rollback report lists drift | — |
| R-13.1–13.11 | IaC component, orchestration, IAM, feedback, examples | absent; IAM has no CFN/CodeBuild (GS-02) | AB | §4.9, §6.4, §7.4 | PB-090..095 | fixture-driven state machine tests; policy denies | D-2, S-5 |
| R-14.1–14.7 | Component-centred testing, journeys, gates | unit tests exist (61/16/83/27/18); no component/journey tests; CI runs none for editor | PI | §8.1–8.2 | PB-100..107 | CI green incl. type-check | — |
| R-15.1–15.6 | Editor visibility of agents/proposals/state | stubs and unused highlight state exist (GE-43/45) | AB | §8.3 | PB-110..117 | integration tests per panel | — |
| R-16.1 | Threat model | — | — | §7.1 | — | negative tests listed per threat | — |
| R-16.2 | Six traces | — | — | §6.1, §6.3–6.6 | — | — | — |
| R-17.x | Work items, types, dependency graph, milestones, compat, substrate | — | — | §9, §10 | — | — | — |
| R-18.x | Format, backlog, self-review | — | — | §10, §10.4 | — | — | — |

**Behaviour that stays unchanged** (adequate today, R-3.2): the GraphCrdt codec/reconcile/updates/protocol modules; the editor's action → commit gateway → undo pipeline; S3 update/snapshot layout and TOC document; WebSocket chunking and 410 cleanup; the scheduler's document model, connector-order fan-out and event names; the dev server and test doubles; the Serverless packaging of the substrate.
