# 6. Worked workflows and required traces

Legend per hop: **actor** · **domain** · **data** · **code (repo/path/symbol)** · **check** · **state change** · **observation** · **correlation** · **persistence** · **failure**. `[FACT]` = the hop exists today at that symbol; `[NEW]` = proposed.

## 6.1 Trace 1 — a human edit and an equivalent MCP mutation converge

Scenario: rename output `out` → `ok` on node `validate` in graph `g1` at HEAD `rev7`.

| # | Hop | Human (Graph Editor) | Agent (MCP) |
|---|---|---|---|
| 1 | intent | actor human `auth0|u1` · browser · `NodeEdgePropertiesPanel` → `updateNodeFields` (`packages/Graph/mutation.ts:580-629` [FACT]) rewrites port name and edge field on the snapshot | actor agent `agent:a1` delegated by `u1` · MCP client · `tools/call proposal.create {baseRevision:"rev7", ops:[{op:"set-node-props", nodeId:"validate", patch:{outputs:[…renamed…]}}, …]}` [NEW] |
| 2 | materialise | `updateGraphFromSnapshot("Rename IO")` → `GraphCrdtSession.commit` → `reconcile()` → V2 update U_h (`mutation.ts:423-439`, `crdt.ts:273-278`, `reconcile.ts:479-547` [FACT]) | server `admission.materialise`: `applyOps(toJSON(head), ops)` → `reconcile(staging, …)` → U_a captured on `updateV2` [NEW, same `reconcile`] |
| 3 | transport | `WssCrdtProvider.flush` → `MutationEnvelope {schemaVersion:2, mutationId:m1, update:U_h, description:"Rename IO"}` over WS `yjs` (`WssCrdtProvider/main.ts:163-191` [FACT], envelope [NEW]); token was presented at `$connect` (subprotocol `access_token.<jwt>`) [NEW] | HTTPS `POST /mcp` with `Authorization: Bearer` (audience = MCP URL), `Mcp-Method: tools/call`, `Mcp-Name: proposal.create` [NEW] |
| 4 | principal | `connections/<id>` record holds `{sub:u1, tenant:t1}` written by the `$connect` authorizer; `crdtSync` derives principal from `connectionId` [NEW; today `userIdOf` = connectionId label only, GS-05] | JWT verified (JWKS), `sub=a1`, delegation `policy/agents/a1/g1.json` → `{delegatedBy:u1, scopes:[graph:read, graph:propose]}` [NEW] |
| 5 | staging + diff | `admit()`: load head (`CrdtStore.loadMerged` [FACT]), clone, `applyUpdateV2(staging, U_h)`, `semanticDiff` → `{ports.renamed:[validate.out→ok], edges.renamed:[…]}` [NEW] | identical function on U_a → identical diff (same ops on same head) |
| 6 | policy | `decide(u1, acl(g1), diff)` → allow (`graph:commit` on definition namespace) | `decide(a1∘u1, acl, diff)` → `graph:propose` only → **proposal created**, `decision:"approval-required"` if policy requires review for `definition` changes by agents; else agent may `proposal.commit` if it also holds `graph:commit` |
| 7 | commit | append U_h at `graphs/g1/crdt/v2/updates/<ulid>~<label>.bin` [FACT key layout], write `MutationRecord m1` (audit, hash-chained) [NEW], `fanOut` to `graph-crdt-g1` except sender [FACT `crdtService.ts:206-214`], **ack** `{mutationId:m1, decision:"accepted", updateId, headStateVector}` to sender [NEW] | on `proposal.commit` (by an approver or the agent): append U_a, `MutationRecord m2 {proposalId}`, HEAD CAS → `rev8`, fan-out, `notifications/resources/updated plastic://graph/g1` |
| 8 | replication | other editors: `session.applyRemote` [FACT]; SyncStatus shows nothing (remote) | same bytes to the same replicas; editors additionally receive `mutation.committed {mutationId, actor:{sub:a1, delegatedBy:u1}, proposalId}` and the Agent Activity panel lists it [NEW] |
| 9 | persistence | update object + audit record + (on cut) revision manifest | same |
| 10 | runtime | nothing runs: execution follows `active/g1` (still rev6); the editor's local preview worker reloads the snapshot [FACT GE-36] and is labelled "preview" [NEW] | same; `revision.activate rev8` is a separate authorized step |
| F | failure | reject (e.g. rename would break a contract with `onViolation:reject` downstream): no store/fan-out; `reject {code:"CONTRACT_MISMATCH"}` → editor rebuilds doc from server state, toast, undo stack reset (§4.4.4) | `proposal.create` returns `isError` with the same code; nothing stored except the rejected attempt in audit |

Convergence proof point: hops 5–9 are the same code path with the same inputs; the only difference is who supplied U (raw bytes vs server-materialised) and which grants applied.

## 6.2 Trace 2 — a denied or stale mutation is rejected before propagation

1. Agent `a1` with only `graph:read` calls `proposal.create` → hop 6 → `ADMISSION_DENIED {required:["graph:propose"]}`; audit `mutation.rejected`; no proposal document; no fan-out; the agent's next `resources/read plastic://graph/g1` shows HEAD unchanged. The agent cannot obtain more authority by switching to WS: the `$connect` authorizer resolves the same `a1` principal (PB-012) and `crdtSync` applies the same policy.
2. Human `u2` whose `graph:commit` was revoked while offline reconnects: `WssCrdtProvider` `open` hook [NEW] sends `SyncStep1`, receives the server diff, then sends its three unacknowledged envelopes; each is admitted individually; all three rejected with `ADMISSION_DENIED`; the client (a) records them in SyncStatus as rejected with reasons, (b) rebuilds the doc from `GET /crdt/g1/state?sv=` (fresh `Y.Doc`, `GraphCrdtSession.replaceDoc`), (c) offers "copy rejected changes" (spike S-2 UX); IndexedDB history keeps the rejected updates locally, flagged, so nothing is lost.
3. Stale base: `proposal.commit {baseRevision:"rev7"}` after another commit moved HEAD to `rev8` → HEAD CAS fails → `STALE_BASE {rebaseTo:"rev8"}`; the proposal stays `validated` but is marked `stale`; `proposal.validate {rebase:true}` re-applies structural ops on rev8 and re-runs validation; code ops touching lines changed since rev7 → `CONFLICT` with both hunks; the proposer must resubmit.
4. Malformed update (the verified poisoning frame [FACT GS-13]): `Y.decodeUpdateV2` throws inside the staging step → `SCHEMA_INVALID`, nothing stored, sender's rate-limit bucket decremented; the graph stays readable (negative test in §8.1 reproduces the local experiment and asserts `GET /crdt/g9/state` still returns 200).

## 6.3 Trace 3 — HTTP input through a cross-domain hyperedge (server business op + browser GL shader)

Sequence diagram: appendix A10.2.

Graph `viz` active at `rev12`: `http.in` (server, entry) → hyperedge `out` with connectors c1 → `price.compute` (server, `net:https` to `api.example.com`) and c2 → `shader.render` (browser, `browser:dom`), `price.compute.result` → c3 → `shader.render.data` (browser).

```
Client ──POST /viz.in──► API GW REST ──► Lambda httpDefault (authorizer: JWT or public endpoint policy [NEW])
  │ graphService.init: endpoints/viz.in → {graphId, active rev12} [NEW; today reads endpoints/<url>.json, GS-27]
  │ executionId E1 minted; budget reserved (tenant t1); ExecutionHandle E1 {owner: server}
  │ Worker thread → isolated-vm isolate → Scheduler 2.1 (patched) → url("in", event) ; principal = endpoint owner (server-derived)
  ├─ obs exec.begin {E1, rev12, node:http.in}                                           [NEW envelope over FACT `begin`]
  ├─ set code runs with host{} only; edges.out = payload  → obs edge.output {E1, span s1, edge:out}
  ├─ hyperedge: connector order [c1, c2] [FACT RT-06]
  │   c1 → price.compute (server): obs route{c1}; edge.input; host.fetch('https://api.example.com/…') → capability check net:https ∋ api.example.com → obs effect{allowed}; edges.result = {price} → obs edge.output ; c3 targets browser →
  │   c2 → shader.render (browser placement) → server does NOT execute; emits edge.deliver {E1, s1, seq 3, c2, value, target:'all-viewers', budgetSlice} on graph-notify-viz (durable copy in executions/E1/deliveries/) → obs route{c2, deferred:'browser'}
  │   c3 → edge.deliver {E1, seq 5, c3, {price}} likewise
  ├─ completion tracking: server spans done → exec.end {E1, domain:server, reason:'completed', pendingBrowser:[c2,c3]}
  └─ HTTP response: 200 with {executionId:E1, outputs: edge values captured for the endpoint's declared response port, observationsUrl} [NEW; today always "ok", GS-30]
Browsers (two editors + one presentation viewer subscribed to graph-notify-viz with graph:observe):
  each receives edge.deliver (dedup key E1/c2/3), runs shader.render in its worker with host.ui (WebGL via the Vue template), obs edge.input {E1, domain:browser, seq 3'} posted back over WS as observation.report (rate-capped) so the server index joins browser and server spans on E1.
Failure paths: api.example.com times out → host.fetch AbortSignal at the connector's budget slice → obs exec.error {node:price.compute, reason:'timeout'}; c2 delivery still happened (partial failure) → execution 'failed' with failedConnectors:[c3 not sent]; HTTP response 200 with status 'failed' and the error list (the endpoint contract decides whether to map to 5xx).
Reconnect: a viewer that dropped before seq 3 reconnects, sends executions.resume {since: lastSeq}, gets the parked deliveries (TTL 10 min), dedups, renders.
Identity across hops: server principal = endpoint owner; browser executes with the viewer's own session (no server grants travel); values crossing are wireValue JSON only; a {secretRef} in payload would be refused by the placement validator at commit time.
```

## 6.4 Trace 4 — a recursive component tries a forbidden effect / exhausts its budget

Component `RateLimiter@2` nested in `api-graph`, granted `storage:kv ratelimit/*` only. Its inner node `window` executes `host.fetch('https://evil.example')`.

1. Server isolate: `host.fetch` → capability resolver: effective = requirement(`storage:kv`) ∩ instance grant(`storage:kv ratelimit/*`) ∩ principal grants → `net:https` absent → throws `CapabilityDenied`; obs `effect.denied {kind:'net:https', scope:['evil.example'], instancePath:[api-graph/N, rl/window]}`; audit entry (privileged-effect denial). The node's `set` sees an exception; sibling nodes continue (sibling isolation is already the scheduler's behaviour, RT-08).
2. Same component, a runaway loop `while(true) edges.tick = 1` (fan-out into itself): hop counter hits `budget.hops` (slice inherited from the parent execution) → cooperative `BudgetExceeded` at the next `beginedge` → obs `budget.exhausted {dimension:'hops'}`; if the loop is `while(true){}` without hops, the owner watchdog fires at `wallMs` → `isolate.dispose()` → obs `exec.end {reason:'terminated'}`; the Worker exits; the Lambda handler returns; the parent execution's other children keep their own slices (they run in the same isolate today? **No** — one isolate per root execution; a runaway child kills its root execution but not sibling *executions*; sibling *nodes* of the same execution are lost with it — stated limitation, mitigated by budgets at the component level and, later, per-component isolates, D-4 follow-up).
3. Cleanup: reservations released to tenant bucket; pending deliveries deleted; `executions/E.json` = `cancelled`; editor shows the red edge on `window.tick` via `errorConnectors` (reusing the unused state, GE-43).
4. System availability: Lambda memory/time caps bound the blast radius to one invocation; tenant bucket depletion makes the *next* invocation fail fast with `BUDGET_EXCEEDED` rather than run.

## 6.5 Trace 5 — recursive component from publication to rollback (`RateLimiter`)

The graph JSON for the definition, its manifest (with computed digest), the consuming instance and the upgrade diff are in appendix A7 (validated fixtures in `schemas/fixtures/`).

1. Publish: graph `rl` (nodes `window` server, `decide` portable) at `rev3` → `component.publish {target:{graph:true}, version:"next", contract:{inputs:[{key:string, cost?:number}], outputs:[{allowed:boolean, retryAfterMs?:number}]}, capabilities:[{kind:'storage:kv', scope:['ratelimit/*']}], placement:'server'}` → `components/rl/1/{artifact,manifest}.json` (digest d1), TOC entry, audit.
2. Instance: editor drops it into `api-graph` → `addGraphItem` [FACT] + pin `{publishedId:rl, version:1, digest:d1}`; admission verifies `sha256(linkedGraph.graph)=d1`; connectors `http.in→N.key`, `N.allowed→handler.in`; commit `rev5`; `revision.activate rev5`.
3. Invoke: `POST /api.in` → server executes; nested `window` writes kv (effect observed with `instancePath:[N, window]`); `N.allowed=true` → `handler`.
4. Upgrade: `rl` `rev4` makes `retryAfterMs` required → `component.publish` v2 (d2); consumers index lists `api-graph`; proposal in `api-graph`: `set-component-pin N → v2` → validation: `handler.in` schema ignores extra field → compatible (warn none) → commit `rev6` → activate → journey `rate-limit-basic` green.
5. Rollback: `revision.rollback {toRevision:"rev5", scope:["definition","activation"]}` → new commit `rev7` (content = rev5) + `active → rev7`; kv keys written under rev6 are listed as residual drift (`observed/drift`), no compensator declared → `manualReview:true` in the editor status bar.

## 6.6 Trace 6 — IaC desired-state change (success and failure)

Success:
1. Human edits `IacStack` instance `S` in graph `infra`: `desired.template.artifactRef` → new template revision; proposal → validation (`Custom::*` absent, IAM within boundary, prefix `pio-dev-`) → plan requested by the validator (`iac.plan`) → change set summary attached; `plan.destructive=false`, env `dev` → no review → commit `rev21` → activate → activation emits `reconcile` trigger.
2. Server `iacService.requestOperation(desired, {revision:rev21, actor:u1})` → lock `iac/stacks/…/lock.json` (If-None-Match) → `states:StartExecution name=<idempotencyKey>` → obs `deploy.status {requested}` → status doc.
3. Orchestrator (role 2): CreateChangeSet(ClientRequestToken=key, RoleARN=exec role, TemplateURL=iac/templates/<sha>.yaml) → EventBridge callback → ExecuteChangeSet → EventBridge `UPDATE_IN_PROGRESS`… `UPDATE_COMPLETE` → feedback Lambda → status doc `succeeded`, `outputs {stackOutputs}` → observation + `graph-notify-infra` + doc mirror `observed/iac/S`.
4. Editor Deployment panel shows requested vs effective revision, timeline, outputs; MCP `iac.status` returns the same document.

Failure with rollback:
1. Same, but a resource fails → CFN `UPDATE_ROLLBACK_IN_PROGRESS` → `UPDATE_ROLLBACK_COMPLETE` → feedback → `terminal {outcome:'rolled-back', effectiveRevision: rev20, requestedRevision: rev21, reason:'…sanitized…'}`; the status document marks desired≠observed; the editor shows "rev21 requested, rev20 effective" on the instance; the graph definition is **not** rolled back automatically (the human decides: fix forward or `revision.rollback scope:["infra"]` which re-plans the old template — a no-op since CFN already restored it — and records the decision).
2. `UPDATE_ROLLBACK_FAILED` → `rollback-failed, manualRecoveryRequired:true`, failing resources listed; runbook action `ContinueUpdateRollback` requires `iac:approve`; until then the stack lock stays held and further desired-state changes queue as `superseded-pending`.
Permissions exercised: `iac:propose` (u1), `iac:approve` (only if destructive/prod), server role `states:StartExecution`, orchestrator `cloudformation:*ChangeSet*` + `iam:PassRole(exec role)`, exec role bounded. Redaction: `status-reason` strings are passed through a deny-list (ARNs kept, secrets/parameter values stripped); CodeBuild logs are references (`logRef`), never bodies.

## 6.7 Bounded agent traversal (failed intent journey) — exact calls and cost
The exact JSON-RPC requests and responses for every call below are in appendix A7.5, generated and validated against the A6 schemas. Measured on those documents (compact JSON, 4 bytes/token): **20,881 response bytes ≈ 5.2 k tokens** for the whole investigation-to-activation sequence; the per-call estimates below are superseded by the measured table in A7.5.
1. `resources/read plastic://graph/G/journeys` → `account-settings-change` failing since `rev12`, last failure observation `o91` (~1.2 KB).
2. `observations.query {graphId:G, filter:{correlationId:"J-…", kind:"exec.error"}, limit:20}` → 3 observations: `validate` emitted `contract.violation {field:'email', reason:'pattern'}` (~2 KB).
3. `graph.summary {graphId:G, nodeId:"validate", revisionId:"rev12", include:["contract","health","deps"]}` → contract `email: pattern ^[^@]+@[^@]+$`, health errorRate 100 % since rev12 (~1.5 KB).
4. `graph.expand {graphId:G, revisionId:"rev12", root:{nodeId:"validate"}, direction:"in", depth:1, maxNodes:20, maxBytes:65536}` → `form`, `normalize`; `normalize` summary shows `intent: "lowercase and trim"` (~3 KB, `truncated:false`).
5. `resources/read plastic://graph/G/diff/rev11/rev12` → `set-node-code normalize` (+6/−1 lines: strips a trailing dot) (~1.5 KB).
6. `proposal.create {baseRevision:"rev12", ops:[{op:"set-node-code", nodeId:"normalize", template:"set", text:"…"}], rationale:"rev12 strips a trailing dot before validation…"}` → `impact.downstream:[validate]`, `testsToRun:[contract:validate, journey:account-settings-change]`, `requiredDecisions:[]` (~1 KB).
7. `tests.run {target:{proposalId:"p1"}, selection:["journey:account-settings-change"]}` → task → `tasks/get` → `completed`, pass (~0.6 KB).
8. `proposal.commit` → `rev13`; `revision.activate rev13` → task; `observations.query` post-activation shows the journey green (~1 KB).
Measured total ≈ 21 KB ≈ 5.2 k tokens (A7.5); deliberately not fetched: full graph (~80 KB), code of 13 other nodes, raw payloads (redacted anyway). Metrics recorded per agent session: calls, bytes, nodes touched vs nodes changed (precision), validated-by-existing-test (correctness), time-to-proposal, stale-base retries.
