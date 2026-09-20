# 8. Testing and editor design

## 8.1 Testing layers

### 8.1.1 Retained substrate tests (conventional CI) [FACT baseline → PROPOSED gates]
Baseline: editor vitest `test:crdt` 61 + `test:integration` 16 (pass), `type-check` fails (GE-59), CI runs no tests (GE-05); server jest 83 (pass); scheduler jest 27 (pass, coverage 96.6 %); Rust 8+8+2 (pass, but assertion-free on order/fan-out, RT-38). Changes: CI must run all suites and `type-check` on every PR (fix the four bare `<script>` SFCs or add `allowJs`, PB-117; add the `vitest.e2e` stress suite nightly); scheduler tests gain event-order assertions and async/fan-out/cross-graph cases (the gaps listed in A3 §C.1); Rust tests assert event sequences (would have caught RT-26).

### 8.1.2 Component contract tests (co-located with the version)
`ComponentManifest.tests: TestRef[]` where a `TestRef = { kind:'contract'|'invariant'|'property'|'fixture'; id; artifactRef }` points to a test artifact stored next to the component (`components/<id>/<version>/tests/<testId>.json`). Definition:
```ts
interface ComponentTest { schemaVersion:1; id; kind; description; inputs: { field; value|generator: JsonSchema }[]; expect: { outputs?: { field; schema|equals }[]; errors?: JsonSchema; effects?: { kind; scope; count?: number }[]; observations?: { kind; count?: {min,max} }[]; invariants?: string[] /* expression over inputs/outputs, evaluated in sim host */ }; budget?: BudgetSpec; runtime?: ('ts'|'rust')[]; }
```
Runner: `tests.run` executes the component in `sim` host mode (§4.7.5), validates outputs against the contract and the expectations, and stores results keyed `(componentDigest, testDigest, runtimeVersion)` — results are revision-bound by construction. Property tests: `generator` schemas are sampled (fast-check on the server) with a fixed seed recorded in the result. Composition rule: a parent's tests may assume child contracts (children are replaced by contract stubs in `mode:'contract-stub'`), and must also run once with real children for emergent behaviour (`mode:'integrated'`). Oracle protection: a proposal that changes `contract`, `invariants` or `tests` alongside code is flagged `oracleChanged:true` in the impact report and the rules require review for it; an agent cannot make a failing change pass by weakening the oracle silently.

Complete JSON definitions (contract test, property test, journey) and spec files are in appendix A9. Example (contract test for `RateLimiter@2`): inputs `key:"u1", cost:1` ×10 within budget `hops:50` → expect outputs `allowed:true` ×5 then `allowed:false` with `retryAfterMs>0`; effects `storage:kv ratelimit/u1` count ≤ 10; invariant `allowed === false ⇒ retryAfterMs > 0`.

### 8.1.3 Admission and synchronization tests (adversarial)
Using the dev server [FACT] extended with an in-memory policy store: malformed/oversize/struct-bomb updates (the verified poisoning frame); concurrent edits from two clients (converge, both audited); revocation mid-session (queued proposals invalidated, in-flight effect denied); reconnect replay (three unacked envelopes, one rejected); duplicate envelope (single object); serialization round trips (`MutationEnvelope` v1→v2 compatibility); crash between append and audit (sweeper repairs); HEAD CAS races.

### 8.1.4 Containment tests (adversarial workloads)
Server `src/runtime/__tests__/adversarial.spec.ts`: `while(true){}`, microtask storm, `Array(1e9)`, unresolved promise, recursion bomb, fan-out storm 10 000 connectors, observation flood, `require`/`process`/`fetch` probes, cancellation race (cancel during host call). Assertions per §4.6.6 acceptance criteria; run in CI against a Lambda-like container (`public.ecr.aws/lambda/nodejs:18`) so the isolated-vm build is exercised where it will run.

### 8.1.5 Hybrid execution tests
Playwright (replacing the scaffold Cypress spec) with two browser contexts + dev server: multi-viewer dedup (one shader render per viewer, one effect on server); no-browser delivery parking and TTL; offline→reconnect resume; mixed schema versions (server refuses activation); partial fan-out failure; revision switch during in-flight (old revision completes).

### 8.1.6 IaC tests
Local: validator fixtures (allowed template, unbounded IAM, custom resource, macro, cross-account policy, oversize); state-machine tests with a fake CloudFormation/CodeBuild/EventBridge (`src/iac/__tests__/fakeAws.ts`) covering status loss, duplicate events, out-of-order events, rollback failure, cancel during create; lock and supersession. Isolated AWS: a `pio-test-` prefixed environment with scoped credentials used by a nightly job (never CI on PRs) exercising a real change set on a trivial stack.

### 8.1.7 Continuous intent journeys (runtime layer)
```ts
interface IntentJourney { schemaVersion:1; id; intent: string; capability: string /* e.g. 'account.settings.update' — resolved to the current entry via a capability→endpoint registry maintained at activation */; steps: { act: { invoke: { capability; input } } | { deliver: {…} }; expect: { observation?: { kind; where }; state?: { via: { capability; input }; schema } } }[]; identity: { syntheticPrincipal: string; tenant: 'synthetic' }; schedule: string /* cron */; budget: BudgetSpec; effects: 'sim'|'isolated'|'real-compensated'; flakiness: { retries: 1; quarantineAfter: 3 }; }
```
Resolution: `capability` → the active revision's node(s) tagged with that capability (`properties.capabilities.provides`), not node ids or topology; resolution failure → `journey.unresolvable` observation (a real signal that the app lost a capability). Synthetic identities live in tenant `synthetic`; their data is prefixed and cleaned by TTL; real effects are allowed only for journeys marked `real-compensated` with a declared compensator. Probe infrastructure failures (Lambda 5xx, network) are classified separately from journey failures (`probe.error` vs `journey.failed`). Detection latency target = schedule interval + budget (proposed 5 min). Journeys are visible in observations with `actor.kind:'synthetic'`.

### 8.1.8 Gates (proportional to risk)
| Gate | Applies to | Blocks | On failure |
|---|---|---|---|
| publication gate | `component.publish` | manifest schema, cycle check, contract tests pass, capability requirements declared for every `host.*` call detected statically | `CONFLICT`/`SCHEMA_INVALID`, publish refused |
| proposal validation | every proposal | schema, contracts, capabilities, unresolved components | proposal `validated:false` |
| pre-activation simulation | diffs touching code/capabilities/placement/iac | shadow run against recorded inputs; IaC plan review | activation refused until reviewed/overridden with `graph:activate`+rationale |
| post-activation window | every activation | error-rate delta vs previous revision over 15 min; journey results | alert; automatic rollback of *activation* only if `autoRollback` policy and the previous revision is healthy; a rollback loop guard (max 1 auto-rollback per revision pair per hour) |
| continuous journeys | active revision | — | alert; revoke execution of a capability only by human action |

## 8.2 Editor design

### 8.2.1 Reuse map [FACT → NEW]
Panels register through `Plugin` types `system-bar-top/bottom`, `settings-panel`, `manager-top-bar-*` (GE-56); server events dispatch to orchestrator actions by name (GE-57); highlight state `selectedNodes/selectedConnectors/hoveredConnector`, `activityConnectors` (animation), unused `errorConnectors/watchConnectors` (GE-43), per-node `raiseError/info/warning`, `showInfo` snackbar, awareness `selection` published but unrendered (GE-65), empty stubs `EventLoggerPanel`, `EndpointListPanel`, `WorkspaceControlPanel` (GE-45) to be replaced.

### 8.2.2 Screens / states
1. **Sync status** (top bar, replaces the dead `pendingEvents` read): per-graph pill `synced | n pending | rejected (n)`; click → list of local mutations with `description`, state, reason, "copy rejected change". State store `packages/SyncStatus/store.ts: { mutations: Map<mutationId, {description, state:'pending'|'accepted'|'rejected', reason?, at}> }` fed by `WssCrdtProvider` acks.
2. **Agent activity** (bottom bar panel `agent-activity`, replaces `EventLoggerPanel`): rows per MCP call/chat turn: agent identity + delegator, tool, target node/edge, status, duration, rationale (marked as agent-supplied); tentative exploration (reads) vs mutations (proposals/commits) are visually distinct; selecting a row highlights the nodes/edges it touched (`selectNodes`, `watchConnectors`). Agent presence: the MCP server publishes an awareness peer `{user:{id:'agent:a1', name, kind:'agent'}, selection}` so `SharedUsers`/`SharedMouse` show the agent's focus (rendering `selection` is new).
3. **Proposal review** (right drawer `proposal-review`): list of open proposals; detail = semantic before/after (node/edge/port tables, code hunks via Monaco diff, capability/placement/budget/test deltas with privilege delta badges), affected consumers, validation results, simulation results and *what was not simulated*, required decisions; actions **Approve**, **Reject**, **Commit** (each shows the exact `proposalDigest` and base revision; disabled with reason when the base moved or permission is missing); `errorConnectors` (red) for removed/broken edges, `watchConnectors` (accent) for added edges, ghost nodes for additions. Conflict state shows both hunks.
4. **Revision & activation bar** (top bar): `HEAD rev13 · active rev12 (server) · preview (local)`, with activate/rollback actions, activation progress (task polling), drain counts, schema-skew warnings.
5. **Deployment status** (node badge + panel for `IacStack` instances): requested vs effective revision, state timeline, plan summary, outputs, drift, `manualRecoveryRequired` banner, cancel (with the honest "AWS may still complete" note), links to sanitized logs.
6. **Journey health** (bottom bar): journeys with last result, latency, unresolved capabilities, quarantine flags; clicking a failure opens the observation list filtered by `correlationId` and highlights the path (`activityConnectors` replay from the observation index, which is the same animation the live run uses).
7. **Execution observations** (existing `ConnectorInfo` extended): per-edge observations from the index (not just live), redaction indicators, budget burn per execution, terminated/abandoned markers.
8. **Cancel/pause controls**: three distinct buttons with distinct semantics: *Stop agent* (revokes the agent's session token via `policy/agents/…` `revokedAt`; in-flight MCP calls fail on their next authorization check), *Cancel execution* (`execution.cancel`), *Request deployment cancel* (`iac.cancel`).
Concurrency/reconnect: panels subscribe to `graph-notify-{id}` and rehydrate from resources on reconnect (`since` cursors); long operations are tasks polled through the server; large graphs use virtualised lists; accessibility: all panels keyboard-navigable, colour cues doubled with icons/labels.

### 8.2.3 Mapping to files and new state
| UI element | Existing files touched | New packages/state |
|---|---|---|
| Sync status | `packages/WssCrdtProvider/main.ts` (envelope, acks, `open` resync), `packages/Graph/crdt.ts` (`replaceDoc`), `TopShortcutIcons.vue` | `packages/SyncStatus/{main.ts,SyncStatus.vue,store.ts}` |
| Agent activity | `packages/Orchestrator/main.ts` (`remoteEvent` handlers `agentActivity`, `mutationCommitted`), `SharedUsers.vue`, `SharedMouse.vue` (render `selection`) | `packages/AgentActivity/*`, store `{ sessions, calls[] }` |
| Proposal review | `packages/Graph/state.ts` (`errorConnectors/watchConnectors` writers), `NodeEdgeConnector.vue`, `Node.vue` (ghost style) | `packages/ProposalReview/*`, store `{ proposals, selected, diff, decisions }` |
| Revision bar | `TopShortcutIcons.vue` | `packages/Revisions/*`, store `{ head, active, activation task }` |
| Deployment status | `Node.vue` (badge slot) | `packages/DeploymentStatus/*`, store keyed by instanceId |
| Journey health | `BottomShortcutIcons.vue` | `packages/JourneyHealth/*` |
| Observations | `packages/ConnectorInfo/ConnectorInfo.vue`, `packages/Orchestrator/main.ts:514-583` | observation index client in `packages/Observations/*` |
| Chat | — | `packages/AgentChat/*` (an MCP client in the browser using the user's token; the *server* holds the agent loop for M2+) |
Integration tests: vitest + `@vue/test-utils` per panel with a fake `graph-notify` feed; Playwright end-to-end for the walkthrough below.

### 8.2.4 Walkthrough (external agent, human watching)
1. Journey `account-settings-change` turns red → Journey health badge; the human opens it and sees the failing path highlighted.
2. Agent `a1` (delegated by the human earlier via Settings → Agents) reads the journey, observations, summary, expands `validate` upstream → Agent activity shows four read rows with the nodes it touched highlighted as the agent's selection.
3. Agent submits `proposal.create` → Proposal review lists `p1` with the code hunk on `normalize`, downstream `validate` flagged, tests to run, no privilege delta; simulation result "journey passes in shadow".
4. Human clicks **Commit** (policy requires a human commit for agents on this graph) → `rev13`; Revision bar shows `HEAD rev13 · active rev12`.
5. Agent calls `revision.activate rev13` (it holds `graph:activate` for dev) → activation task progress in the bar → `active rev13`.
6. Agent proposes an IaC change (`desired.parameters.MemorySize`) → Proposal review shows the IaC delta and the plan (non-destructive, dev) → human commits → activation triggers reconcile → Deployment status on the `IacStack` node walks `planning → executing → succeeded`; observations show the effect with `aws:cfn` capability allowed.
7. Journey turns green; Agent activity shows the whole sequence with durations; Sync status stayed "synced" throughout (no local edits).
