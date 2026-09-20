# 9. Implementation plan

## 9.1 Repository-by-repository changes

### 9.1.1 graph-editor (editor + shared packages)
| Item | Existing symbol / file | Current behaviour [FACT] | Change | Interfaces | Tests | Compat |
|---|---|---|---|---|---|---|
| PB-120 publish `@plastic-io/graph-crdt` to npm with a version; add `namespaces.ts`, `diff.ts`, `ops.ts` | `packages/GraphCrdt/*` (source-shipped, `main: ./main.ts`) | server compiles TS from the sibling checkout via `file:` | build with `tsc` to `dist/`, semver, changelog | `semanticDiff`, `applyOps` | existing 43 tests + diff/ops specs | server pins version |
| PB-121 new `packages/GraphSchema` (`@plastic-io/graph-schema`) | — | types come from scheduler `.d.ts` | JSON Schemas + generated TS; Rust types via typify | §5.4 | schema round-trip tests | additive |
| PB-020/024 envelope + acks + resync | `packages/WssCrdtProvider/main.ts:163-230` (`flush`, `sendSync`, `onMessage`), no `open` hook | fire-and-forget, no reject handling, no resync | send `MutationEnvelope` v2; handle `ack`/`reject`; `open` → SyncStep1 + replay unacked; `GraphCrdtSession.replaceDoc()` in `packages/Graph/crdt.ts` | §5.1 | integration spec: reject → doc rebuilt; reconnect replay | legacy server accepts v2 envelope (ignores unknown) during rollout |
| PB-014 token attach | `packages/Auth0AuthenticationProvider/main.ts:138-149` (token obtained), `WssDocumentProvider/main.ts:84` (socket URL), `HTTPDataProvider.ts` (`setToken` never called) | token never sent | `Sec-WebSocket-Protocol: access_token.<jwt>`; `Authorization: Bearer` on HTTP; refresh on 401; auth mandatory when a server is configured | — | unit: headers present | local mode unchanged |
| PB-052 browser host | `packages/Node/NodeComponent.vue:34-72` (stores + `transact`), `packages/Orchestrator/schedulerWorker.ts:49` (`new Scheduler`), `src/main.ts:7-8` (`window.OpenAI`), `packages/Utils/main.ts:12-26` (`loadScripts`) | ambient authority in the worker; realm-level trust for templates | worker gets capability-scoped `host`; templates additionally get `host.ui` (stores stay, D-11 revised); remove `window.OpenAI`; replace `properties.scripts` with SRI-pinned `deps` | `HostBindings` | integration: worker `set` code sees `host`; existing templates unchanged | additive |
| PB-060/064 scheduler 2.1 + budgets in worker | `schedulerWorker.ts:61-68` (`panic`), `Orchestrator/main.ts:475-702` | panic = throwing listener | main-thread watchdog + `worker.terminate()`; `ExecutionHandle` RPC; budgets from revision | §4.6.6 | adversarial in jsdom worker | — |
| PB-110..114 panels | see §8.2.3 | stubs | new packages | — | per-panel integration | — |
| PB-115 nested navigation | `src/router`, `packages/Graph/project.ts` | none (GE-48) | route `/:documentId/instance/:nodeId` rendering `linkedGraph.graph` read-only with "edit source graph" link | — | — | — |
| PB-116/117 dead code + type-check | A1 §J list | fails `type-check` | remove dead modules/deps, fix SFC `lang`, add CI steps | — | CI green | — |
| PB-042 node publish UI | `NodePropertiesPanel.vue:118-120` | unreachable | button → `component.publish` via server | — | — | — |

### 9.1.2 graph-server
| Item | Existing symbol / file | Current behaviour [FACT] | Change | Tests |
|---|---|---|---|---|
| PB-010..013 auth + policy | `handler.ts`, `serverless.yaml` (no authorizers), `broadcastService.ts:88-96` (`connect` persists raw event) | none | REST Lambda TOKEN authorizer (`src/auth/authorizer.ts`, JWKS, audience), WS `$connect` REQUEST authorizer reading `Sec-WebSocket-Protocol`; `connections/<id>` stores principal; `src/policy/{acl,rules,decide}.ts`; ACL docs under `policy/` | authorizer unit tests; policy table tests |
| PB-015 route hardening | `serverless.yaml` routes `sendToChannel`, `sendToConnection`, `broadcast`, `listSubscribers`, `listSubscriptions`, `addEvent`, `POST /toc/rebuild` (anon) | client-callable | remove client routes; `subscribe` checks `graph:observe`; `addEvent` removed (legacy bundle cutoff); rebuild behind `policy:admin` | route inventory test |
| PB-021..027 admission | `crdtService.ts:151-224` (`handleMessage`), `:330-358` (`postUpdate`), `crdtStore.ts:289-316` (`appendUpdate`) | append unparsed bytes | `src/admission/{admit,staging,materialise,idempotency}.ts`; both WS and HTTP call `admit()`; ack/reject frames; `mutations/<g>/<id>.json` If-None-Match | adversarial suite (§8.1.3); S-4 perf |
| PB-030..038 revisions/proposals | `crdtStore.ts:322-346` (`writeProjections`), `eventSourceService.ts` publish paths | projections from live doc every 10 s | `src/revisions/{store,commit,activate,rollback}.ts`; `src/proposals/*`; projections written at activation; `endpoints/<url>` index at activation | state-machine tests, CAS races |
| PB-033 executor loads active revision | `graphService.ts:194-197` (`init` reads `graphs/projections/endpoints/<url>.json`) | executes checkpoint | read `endpoints/<url>` → `active/<graphId>` → `revisions/<g>/<rev>.projection.json` | integration with dev server |
| PB-046 server linked-graph loading | `graphService.ts:406`; `dist/Loader.js` relative fetch (GS-31) | cannot load linked graphs | pre-flatten with shared `flattenLinkedGraphs()` before `new Scheduler` | linked fixtures from A3 |
| PB-051 server capability host | `graphService.ts:408-446` (`setContext` gives `openai,event,context,callback,AWS,console`), `:31-50` (`getSecret` every run) | ambient | `src/runtime/host/*` builds `host` from grants; secrets on demand; remove `AWS`/`require` | negative tests |
| PB-062/063 isolated-vm executor | `graphService.ts:209-262` (Worker per request), `:263-480` (`router`) | `worker_threads`, no limits | `src/runtime/executor.ts`: Worker → isolate → scheduler 2.1 bridged via references; watchdog on handler thread; `ExecutionHandle` records in `executions/` | adversarial (§8.1.4) in Lambda container |
| PB-053..057 observations/audit | `graphService.ts:125-143` (`send` → `graph-notify`) | fire-and-forget | `src/observations/{sink,store,index,redact}.ts`; `src/audit/chain.ts`; subscribe filtering | volume/redaction tests |
| PB-071..073 hybrid | `graphService.ts:172-181` (`$default` executeGraph), `broadcastService.ts` | `executeGraph` only | `edge.deliver` in/out, durable deliveries, resume, dedup | Playwright hybrid suite |
| PB-080..086 MCP | — | — | `src/mcp/{server,auth,tools/*,resources/*,tasks}.ts` on `POST /mcp`; RFC 9728 metadata Lambda; Function URL streaming for `subscriptions/listen` (S-3); delegation records | tool schema tests; auth tests |
| PB-090..093 IaC | — | — | `src/iac/{service,validator,feedback}.ts`; new stack `iac-orchestrator` (Step Functions, EventBridge rules, roles) in `infra/iac-orchestrator.yaml` | fixtures + fake AWS |
| PB-061 scheduler upgrade | `package.json:34` (2.0.1) | old semantics | pin 2.1.0; adapt `postGraph` to `ExecutionHandle.done` | existing 83 + new |
| Bug fixes on the path | `graphService.ts:145,152` (inverted cache), `:192` (`target` unused), `:55-85` (panic), `broadcastService.ts:251` (`listSubscribers`), `s3Service.ts:116-118` (pagination), `eventSourceService.ts:397-410` (publish continues), `serverless.yaml:160-162` (phantom `version`) | see A2 §I.2 | fix as part of the touching work items | regression tests |

### 9.1.3 plastic-io (TS scheduler) → 2.1.0
| Item | Symbol | Change |
|---|---|---|
| PB-060 | `src/Scheduler.ts:282-330` (`url`), `src/Node.ts:238-317` (setter), `:335` (unawaited `parseAndRun`), `src/Edge.ts:14-64` | `url()` returns `ExecutionHandle`; `ExecutionScope` counts in-flight promises; `end` when zero or budget; `CancellationToken` checked at `beginedge` and per connector; hop/fan-out/depth counters; `host` binding injected (`new AsyncFunction(…,"host",…)`); contract validation hooks (`onOutput`, `onInput`); events carry `executionId/spanId/parentSpanId/seq`; fix `graph` reassignment on cross-graph connectors (`src/Node.ts:247-249`, RT-13); upgrade meriyah to 4.x behind an option (top-level `await`, RT-05) |
| tests | `tests/unit/Scheduler.spec.js` | assert ordering, async completion, fan-out concurrency, cancellation, budgets, cross-graph |
| compat | consumers on 2.0.x | 2.1 keeps `url()` thenable (handle has `.then`) so existing callers work; `afterSet` restores `err` for parity with 2.0.1 |

### 9.1.4 plastic-io-rust (last workstream, M6: security upgrade on both domains)
PB-130 generate `schema.rs` from graph-schema; PB-131 rewrite `Scheduler::edge` setter to one accessor per *field* dispatching all connectors (RT-26), transport full JSON (RT-29), classic-script → function-body compile with `return`; PB-132 crate `v8` 152.x, isolate per execution, `heap_limits`, near-heap-limit + OOM handlers, watchdog thread with `IsolateHandle::terminate_execution`, no `process::exit` (RT-33), dispose platform; PB-133 host bindings mirroring `host`; PB-134 embed as the server executor behind the same `ExecutionHandle` (Lambda custom runtime or container) after M5; PB-135 browser build (wasm, embedded QuickJS/Boa for node code, same `host` bridge) so `set` code is isolated from the page realm.

## 9.2 Concrete shared types (TS; Rust generated)
See §5.1 (`MutationEnvelope`, `AdmissionResult`, `MutationOp`), §4.3.2 (`ComponentManifest`, `PortContract`), §4.5.2 (`CapabilityRequirement/Grant`), §4.5.3 (`Observation`), §4.6.4/4.6.6 (`BudgetSpec`, `ExecutionHandle`), §4.7.1 (`Revision`), §4.9.2 (`IacDesiredState/Observed`), §8.1.2/8.1.7 (`ComponentTest`, `IntentJourney`), plus:
```ts
interface Proposal { proposalId; graphId; baseRevision; ops: MutationOp[]; update?: string; digest: string; state: 'draft'|'validated'|'awaiting-review'|'approved'|'rejected'|'simulated'|'committed'|'activating'|'active'|'failed'|'rolled-back'|'expired'|'cancelled'; validation; impact; decisions: { by; decision; digest; policyVersion; at }[]; simulation?; resultRevision?; createdBy; at; expiresAt; }
interface PrincipalRef { sub: string; kind: 'human'|'agent'|'system'|'synthetic'; tenant: string; delegatedBy?: string; }
interface Placement { placement: 'browser'|'server'|'portable'; }
```
Rust: `#[derive(Serialize, Deserialize, JsonSchema)]` structs generated from the same JSON Schema; unknown fields rejected only for `MutationEnvelope`/`IacDesiredState` (`deny_unknown_fields`), ignored for graph documents (forward compatibility).

## 9.3 Workstream dependency graph
Diagram: appendix A10.6.
```
W0 discovery/baseline (done) ──► W1 schema+crdt packages (PB-120,121) ──► W2 identity+policy (PB-010..015)
                                                                         ├─► W3 admission (PB-020..027) ──► W5 revisions/proposals (PB-030..038) ──► W8 MCP write tools (PB-082,083)
                                                                         │                                  └─► W6 activation-bound executor (PB-033) ──► W9 hybrid (PB-070..074)
                                                                         ├─► W4 scheduler 2.1 (PB-060,061) ──► W7 containment (PB-062..066, S-1) ──┘
                                                                         ├─► W10 capabilities+observations (PB-050..057) ──► W9, W11 components/publication (PB-040..047)
                                                                         ├─► W12 MCP read (PB-080,081,084,086, S-3) ──► W8
                                                                         └─► W13 editor visibility (PB-110..114, S-2) (parallel after W3 ack protocol is fixed)
W14 IaC (PB-090..095, S-5) depends on W5, W10, W2 ;  W15 testing/journeys (PB-100..107) runs alongside every W ;  W16 migration/substrate (PB-122..125) depends on W1, W5 ;  W17 Rust (PB-130..134, S-6) last (after M5), depends on W1, W4
```
Parallelisable: W1‖W2 start immediately; W4‖W10‖W12‖W13 after W1; W7 needs only W4 and S-1; W11 needs W10. Serialised on settled semantics: W3 (admission contract) must be frozen before W8/W13 ack UI; W5 before W6/W9.

### Spikes (each ≤ 1 week, exit criteria explicit)
| Spike | Question | Method | Artifact | Exit criterion | Decision enabled |
|---|---|---|---|---|---|
| S-1 | Does isolated-vm build/run in Lambda nodejs18.x with acceptable cold start, and survive isolate OOM? | build in the Lambda container image; run adversarial set | report + Dockerfile | `while(true)` stopped ≤ budget+100 ms; OOM at 128 MB does not kill the Worker; cold start ≤ +300 ms | D-4 (isolated-vm vs worker limits) |
| S-2 | Best UX for rejected optimistic edits with Yjs | prototype `replaceDoc` + quarantined draft in the editor | demo + user notes | no data loss; ≤ 1 s recovery on a 500-node graph | reject-recovery design |
| S-3 | Can `subscriptions/listen` run on a Lambda Function URL with response streaming behind Auth0? | prototype with SDK v2 server | measurements | 10-minute stream with keep-alive comments; reconnect works | D-3 |
| S-4 | Cost of staging validation (load+clone+apply+diff) at 10k-update graphs | bench with the stress harness (`packages/Graph/__e2e__/harness.ts`) | numbers | p95 ≤ 250 ms with warm cache; else snapshot cadence change | admission perf plan |
| S-5 | EventBridge callback latency vs polling for CFN status | trivial stack in `pio-test-` env | numbers | median callback ≤ 15 s | orchestrator wait design |
| S-6 | Rust viability: fan-out fix + v8 152 upgrade effort | 3-day timeboxed port | report | tests with order assertions pass | go/no-go for W17 |

## 9.4 Milestones
| M | Scope | Excludes | Deps | Deliverables | Owner role | Effort (assumes 1 senior FS eng + reviewer) | Risks | Acceptance | Rollback |
|---|---|---|---|---|---|---|---|---|---|
| M0 | this plan; CI running all suites; fix type-check; scheduler 2.1 spec | code changes beyond CI | — | plan, CI green, spike briefs | lead | 1–2 wk | — | CI runs tests+type-check on PR | n/a |
| M1 | W1, W2, W3, W4, minimal W7 (wall/hop budgets + Worker terminate), route hardening | isolated-vm, MCP, revisions | S-1, S-4 | authenticated tenant-scoped server; admission with ack/reject; editor sync status; scheduler 2.1 pinned by both | backend + editor | 6–10 wk | Yjs staging perf; auth on WS | §1.6 guarantees a–c; adversarial admission suite green | feature flag `admissionMode: legacy|strict` per stage; redeploy previous stack |
| M2 | W12 (MCP read + propose + validate), W13 proposal panel, agent delegation records | commit/activate by agents | M1, S-3 | `/mcp` with read tools/resources, `proposal.create/validate`, Proposal review UI, Agent activity | backend + editor | 4–6 wk | SDK v2 maturity | worked traversal (§6.7 steps 1–6) reproducible; §1.6 guarantee d | disable `/mcp` route |
| M3 | W5, W6, W10, W11 (contracts + immutable publish), W9 basic hybrid, W7 isolated-vm, first journey (W15) | IaC, replay/shadow, Rust | M2, S-1, S-2 | commit→activate→hybrid execution→observations→contract validation→one journey; capability host in both domains | backend + editor + runtime | 6–10 wk | isolate perf | traces §6.1, §6.3, §6.4 executable as tests; journey green in CI | activation pointer revert |
| M4 | W14 IaC | prod environments | M3, S-5 | IacStack component, orchestrator stack, roles, deployment panel, runbook | backend + AWS | 5–8 wk | IAM scoping errors | §6.6 success/failure in isolated env | remove orchestrator stack; graphs keep desired state |
| M5 | full budgets/OOM, publication migration, replay/shadow, rollback/compensation, editor workflows, hardening, retention | Rust | M4 | per-component budgets, simulation classes, rollback reports, journeys at scale, alarms | all | 8–14 wk | scope | §8.1 gates enforced; threat negative tests all green | per-feature flags |
| M6 | W17 Rust runtime on server (V8 isolates) and browser (wasm + embedded JS engine) as the security upgrade — last, after M5 | — | S-6, M5 complete | Rust executor behind `ExecutionHandle` on both domains | Rust eng | 14–24 wk | crate upgrade churn; wasm JS-engine parity with V8 semantics | A3 §G table rows "same"; browser `set` code cannot reach the page realm | not deployed by default |

Smallest useful demonstration: M2 (§1.6). Effort is uncertain by ±50 % until S-1/S-4 report.

## 9.5 Backward compatibility and migration
- Stored graphs: unchanged layout; new keys are additive; `meta.schemaVersion` → 2 when `properties.component`, `placement`, `capabilities` appear; readers accept 1 and 2. Migration = a `system` mutation per graph run by a backfill Lambda (idempotent, recorded), derived placement per §4.8.1, `properties.component` derived from `artifact` strings where the artifact still exists (digest computed then), else `unresolved`.
- Yjs documents: V2 stays; no rewrite. Revision snapshots are new objects.
- Historical revisions: none exist; the first revision cut per graph is "rev0 = current head".
- Published components: legacy `graphs/projections/published/artifacts/*` are read-only; a backfill writes manifests with digests into `components/`; consumers keep `artifact` strings.
- Editor clients: envelope v2 is accepted by the new server; old bundles (CDN-cached) sending v1 are accepted only for `legacy-client` principals until the cutoff (30 days), then rejected with a reload prompt.
- Runtime protocols: scheduler 2.1 keeps `url()` thenable; `afterSet.err` restored; server 2.0.1→2.1 changes completion timing (RT-19 #2) — the executor is rewritten anyway.
- MCP schemas: `schemaVersion` per input; additive fields only within a major.
- Active deployments: activation pointers are created by the migration as "active = rev0"; until then executors fall back to today's endpoint file behind flag `executionSource: checkpoint|active`.
- Templates: no migration; existing templates keep their store access (D-11 revised).
- Mixed versions: server first (accepts both envelopes), editor second, MCP last; readers/writers table in `appendix/A5` follow-up. Interrupted migration: backfill is idempotent per graph with a progress marker; re-run resumes.

## 9.6 Operational rollout and rollback
Stage `dev` first with `admissionMode: strict`, then a new `staging` stage; the public editor keeps local-only default until M2 lands. Rollback = redeploy the previous Serverless package (kept in S3 by the framework) and flip flags; data written by new code is additive so old code ignores it. Substrate repair route = CI deploy from a tag with the OIDC role; break-glass = documented IAM role.
