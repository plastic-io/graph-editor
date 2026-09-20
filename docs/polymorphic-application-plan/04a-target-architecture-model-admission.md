# 4. Target architecture (part A: model, components, admission, capabilities, observations)

Everything in §4 is **[PROPOSED]** unless marked **[FACT]**. Names of new types are those used in §5.3.

## 4.1 Authoritative graph model

### 4.1.1 What is authoritative, what is derived

| Data | Authority | Store | Derived / cached views |
|---|---|---|---|
| Graph definition: nodes, edges, connectors, ports, code text, component refs, contracts, capability requirements, placement, budgets, test refs, IaC *desired* state | the graph's Y.Doc (V2 update log) | `graphs/<id>/crdt/v2/{updates,snapshots}` [FACT layout, GS-17] | JSON projection at each **revision** (§4.7), summaries (§4.2), search index |
| Editor layout: `x,y,z`, `presentation`, `groups`, `appearsIn*`, `icon` | same Y.Doc, classified as namespace `layout` by the diff engine (key allow-list in `graph-crdt/namespaces.ts`) | same | none; excluded from revision digests' *semantic* part but included in the *layout* part (both stored) |
| Access policy (ACL), agent delegations, tenant | **server-only documents**, never in the Y.Doc | `policy/graphs/<id>/acl.json`, `policy/agents/<agentId>/<graphId>.json` (CAS-written) | editor/MCP read a redacted view |
| Published component definitions | immutable objects + manifest with digest | `components/<publishedId>/<version>/{artifact.json,manifest.json}` (+ legacy `graphs/projections/published/artifacts/…` kept read-only) | registry indexes, consumers index |
| Revisions and activation | immutable manifests + one CAS pointer per graph | `revisions/<graphId>/<revisionId>.json`, `revisions/<graphId>/HEAD`, `active/<graphId>` | executor cache keyed by revisionId |
| Runtime state (`state`, `cache`, `Shared`) | per runtime instance | memory | never persisted, never in the doc |
| Deployment observed state, execution status | server-written status documents; mirrored **read-only** into the doc under `observed/*` keys by principal `system:*` | `iac/stacks/…/status.json`, `executions/<id>.json` | doc mirror is a view; a client update touching `observed/*` is rejected |
| Secrets | Secrets Manager; the doc holds `{secretRef}` only | AWS | never in traces (redaction class `secret`) |

Rationale [FACT-based]: the Yjs layout already separates `properties` scalars from text and opaque blobs (GE-07), so classifying keys into namespaces is a table, not a schema change; ACL cannot live in the doc because any replica can write any key (GS-13), and CRDT convergence says nothing about authority (R-6.3).

### 4.1.2 Executable code and artifact references
- Node code stays `template.set` / `template.vue` as `Y.Text` [FACT GE-22]. A revision's projection freezes the text; the executor compiles from the projection, never from the live doc.
- `artifact` on an instance node stays a string for compatibility but gains a sibling `properties.component = {publishedId, version, digest}`; the server verifies `sha256(canonical(linkedGraph.graph|linkedNode.node)) === digest` at admission (so the embedded copy cannot drift from the definition) and at load.

### 4.1.3 Definition resolution
`ComponentResolver` (server `src/components/resolver.ts`, browser `packages/Orchestrator/resolver.ts` sharing `graph-schema`): `resolve({publishedId, version, digest}) → artifact` from `components/…` (cache key = the tuple; content verified). Unresolvable → node state `unresolved` (observation `component.unresolved`, editor badge); a revision with unresolved instances can be **committed** but not **activated**.

## 4.2 Summaries and bounded traversal (agent context)

`ComponentSummary` (schema in §5.3) is computed per `(graphId, revisionId, nodeId)` from structured metadata [FACT fields: `properties.{name,description,tags,inputs,outputs}`, `edges`, `url`, `version`, `graphId`] plus proposed fields (`contract`, `capabilities`, `placement`, `invariants`, `summary.intent`). Fields that need a *maintained* text are `intent` and `invariants`; `intentProvenance ∈ {authored, generated, derived}`; generated text is stored as an observation of kind `summary.generated` bound to the revision and never overwrites authored text. `health` comes from the observation index (last run, error rate, p95).

Traversal (`graph.expand`, §5.1): BFS ordered by `(depth, nodeId)`, `depth ≤ 4`, `maxNodes ≤ 200`, `maxBytes ≤ 256 KiB`, visited-set cycle detection, `truncated: {byDepth, byCount, byBytes}`, opaque cursor `{revisionId, frontier[], visitedHash}` so continuation never mixes revisions. Entering a `linkedGraph` counts as depth+1 and requires `graph:read` on the target graph; a denied child appears as `{nodeId, denied:true}` without metadata. Search indexes only fields visible at `registry:read`. Every read returns `resultRevision`; every proposal carries `baseRevision`; commit re-validates against head (`STALE_BASE` with `retry.rebaseTo`). Cache key for summaries = `(graphId, revisionId, nodeId, scopeHash)`; the live alias resolves via `revisions/<id>/HEAD` and subscribers get `notifications/resources/updated` on commit. Per-principal query budget (proposed default 2 MB/min, to be tuned) returns `RATE_LIMITED`.

## 4.3 Recursive components and publication

### 4.3.1 Verified starting point [FACT]
F1 artifacts `{node}`/`{graph}` at `graphs/projections/published/artifacts/<id>.<version>.json`, unconditional overwrite (GS-26); F2 import embeds the whole graph into `linkedGraph.graph` (GE-46) and the browser flattens before execution (GE-47); server cannot load linked graphs (GS-31); F3 `linkedGraph`/`linkedNode`/`data` are opaque blobs in Yjs (`schema.ts:82`); F4 contract = `{name, type, external, visible}` per port; F5 `Connector.version` unchecked in 2.0.3 (RT-19 #4); F6 registries are static JSON with no digest; node publish is unreachable in the UI (GE-50).

### 4.3.2 ComponentManifest (immutable, `components/<publishedId>/<version>/manifest.json`, written with `If-None-Match: *`)
```ts
interface ComponentManifest {
  schemaVersion: 1; publishedId: string; version: number; kind: 'node'|'graph';
  digest: string;                                   // sha256 of canonical JSON of artifact.json (§5.4 canonicalisation)
  contract: { inputs: PortContract[]; outputs: PortContract[]; errors?: JsonSchema };
  capabilities: CapabilityRequirement[];            // §4.5.2
  placement: 'browser'|'server'|'portable';
  dependencies: { publishedId: string; version: number; digest: string }[];   // transitive closure, pinned
  summary: { intent: string; invariants: string[]; provenance: 'authored'|'generated' };
  tests: TestRef[];                                 // §8.1
  budgets?: BudgetSpec;                             // §4.6.4 caps a consumer may not raise
  provenance: { publishedBy: PrincipalRef; fromGraph: { graphId: string; revisionId: string }; at: string; mutationId: string };
  deprecated?: { at: string; replacedBy?: { publishedId: string; version: number }; reason: string };
  compat: { runtime: { ts: string; rust?: string } };
}
interface PortContract { name: string; schema: JsonSchema; required: boolean; default?: unknown; redaction?: 'none'|'hash'|'secret'; capture?: 'none'|'meta'|'full'; }
```
Integer `version` is kept so `artifacts/{id}.{version}` addressing (GE-52) keeps working; `digest` is the identity that matters.

### 4.3.3 Publication, dependencies, upgrades
- `component.publish` is an admitted mutation (§4.4) whose effect is the immutable write above plus a TOC entry; the body is the canonical projection of the source node/graph at `fromGraph.revisionId`, so the digest proves provenance. Republishing the same `version` → `CONFLICT` (S3 412).
- Dependency cycle check at publish: walk `dependencies`; a component may not transitively depend on itself. Runtime recursion depth is a budget (default 32 hops of nesting, §4.6.4).
- Instance creation = today's `addGraphItem/addNodeItem` [FACT] plus the `properties.component` pin. Upgrade = proposal changing the pin; the validator re-checks connectors against the new contract (`CONTRACT_MISMATCH` unless a field mapping is supplied). Editing the reusable definition = editing its source graph and publishing a new version; consumers are listed from `components/<id>/consumers.json` (maintained at commit) and shown before publish and in the proposal impact.
- Missing/incompatible version → `unresolved` (4.1.3). Deprecation is metadata; activation of a revision referencing a deprecated version emits a warning observation, not a block.
- Keep the embedded copy (`linkedGraph.graph`) because both runtimes consume it [FACT]; the digest check removes the drift problem without touching runtime code. Server-side loading of linked graphs is fixed by pre-flattening on the server exactly as the browser does (`loadAndIntegrateLinkedGraphsWithFields`, GE-47) moved into `graph-schema` as `flattenLinkedGraphs()` shared by both (PB-046).

### 4.3.4 Deployment unit = activation of a graph revision (decision D-6)
Publishing changes nothing running. A component version goes live only when a consuming graph's revision that references it is activated. Justification [FACT]: both runtimes execute whatever projection they are handed (GE-36, GS-27); the only atomic unit available without changing runtime code is "the projection the executor loads", so activation is the deployment unit for code, wiring and component upgrades alike. Independent component activation would require per-instance hot-swap inside a running scheduler, which neither runtime supports.

### 4.3.5 Contract validation
JSON Schema 2020-12 via `ajv` (server; same package in the browser worker) applied (a) on `edges.<field> = value` at the source (output contract) and (b) on delivery at the target input, inside the scheduler wrapper (§4.6.2) so both runtimes share it. Failure → observation `contract.violation` and, per port `onViolation: 'reject'|'warn'` (default `warn` during migration, `reject` after M3), an `error` event. Assignability at connect/commit: conservative subset check of source output schema against target input schema (unknown → warn). Runtime disagreements between TS and Rust (dates, `undefined`, BigInt, RT-29 object→null) are normalised by a `wireValue` codec in `graph-schema`; a Rust executor that cannot represent a value must fail the edge, not coerce silently.

### 4.3.6 Caches and invalidation
Definitions: `components/<id>/<version>` immutable, verified by digest on every cold load (S3 ETag is an MD5 for single-part uploads, not a substitute for the sha256). Summaries: `(graphId, revisionId, nodeId, scopeHash)`. Test results: `(componentDigest, testDigest, runtimeVersion)`. Contracts: part of the manifest. Immutable identity that resolves to different content → `INTEGRITY_FAILURE`, never silent.

### 4.3.7 Reference integrity
Deleting a node strips connectors targeting it [FACT `deleteNodeById`, GE-C.1] — kept. Deleting a published version is never allowed (deprecate instead). Rollback to a revision referencing a deprecated version is allowed with a warning. External resources (IaC stacks, KV data) are owned by the *instance id*; a definition change does not detach them; detachment is an explicit operation (`iac.destroy` / `retain`) recorded as an effect.

### 4.3.8 Instances vs definitions in proposals
A `MutationOp` targets one of: graph structure (`add-node`, `remove-node`, `connect`, `disconnect`, `set-node-code`, `set-node-props`, `set-graph-props`), an instance (`set-component-pin`, `set-instance-config`), or a definition (`publish`, `deprecate`). Definition-level ops produce immutable writes and are always shown with their consumer impact.

## 4.4 Shared mutation path and admission

### 4.4.1 Verified current sequence and bypasses [FACT]
Editor → WS `yjs` → `CrdtService.handleMessage`: checks only `graphId` presence and optional `format===2`, appends bytes, fans out, checkpoints (GS-13/15/20). No principal (GS-05). Bypasses: `POST /crdt/{id}/update`, `POST /crdt/{id}/checkpoint`, WS `sendToChannel`/`sendToConnection` (forge fan-out frames, GS-06), `subscribe` to any channel, `addEvent` (legacy, bypasses the doc, GS-24), `POST /toc/rebuild`, `publishGraph/publishNode`, `deleteGraph/undeleteGraph`, `ANY /{proxy+}` execution (A2 §I.1). A raw Yjs update cannot express authorization intent: it is a set of struct insertions/deletions with client ids that the server cannot map to a principal or to a semantic operation without applying it.

### 4.4.2 Mediation strategy (decision D-1): staged application with semantic diff
Flow diagram: appendix A10.1.
Both humans and agents converge on one server function:

```
admit(envelope, principal):
  1. load head: doc_head = Y.Doc from snapshot+updates (CrdtStore.loadMerged [FACT]) ; sv_head
  2. materialise candidate update U:
       editor:  U = envelope.update (raw V2 bytes; size ≤ MAX_UPDATE_BYTES; decode with Y.decodeUpdateV2 under try/catch and a struct-count cap)
       agent:   U = reconcile(doc_staging, applyOps(toJSON(doc_head), envelope.ops), origin) captured via doc.on('updateV2')  — the SAME reconcile() the editor uses [FACT GraphCrdt/reconcile.ts]
  3. staging: doc_staging = clone(doc_head); applyUpdateV2(doc_staging, U); before = toJSON(doc_head); after = toJSON(doc_staging)
       reject if schemaVersionOf(after) unsupported, if `meta`/`observed/*`/policy keys changed by a non-system principal, if isEmpty(after) && !allowClear
  4. diff = semanticDiff(before, after)  → {namespaces touched: definition|layout|code|capabilities|placement|budgets|tests|iac; per-node ops; contract changes; privilege delta}
  5. policy: decide(principal, graph ACL, diff, envelope.claims) → allow | deny(code) | require-approval(kind)
  6. commit: mutationId = envelope.mutationId (idempotent) ; CAS on revisions/<graphId>/HEAD.updatesEtag (S3 If-Match) is NOT needed for the append-only log — appends are order-independent [FACT GS-21]; CAS is needed only for revision cuts and activation. Append U (bytes unchanged, so replicas see exactly what was validated); write MutationRecord (audit); fan out; ack to sender.
  7. reject: nothing stored, nothing fanned out; reject message to sender with code, reason, and the server state vector so the client can resync.
```
Why apply-then-diff and not "parse the update's structs": Yjs struct semantics (item ids, parent sub-keys, deleted-set) are not a stable public API; `toJSON` before/after through the existing codec is stable, tested (GE-08) and gives a semantic diff for free. Cost: one doc load per mutation. Today `maybeCheckpoint` already GETs the full snapshot on every edit (GS-14/A2 I.2 #14), so the incremental cost is the decode + diff (spike S-4 measures at 10k updates; mitigation = snapshot cadence and a warm per-Lambda doc cache keyed by head id).

Convergence caveat (R-6.3): a rejected update never reaches other replicas, so replicas never diverge on *content*; the sender's local doc did diverge and must be reset (4.4.4). Two concurrent admitted updates from different clients commute by Yjs semantics [FACT GS-18/21]; the policy check is on each update's own diff against the head *at admission time*; a privilege-broadening update and a revocation can race — resolved by the policy check running again at revision cut/activation (4.7) and by runtime capability checks (4.5), so structural admission is never the last line.

### 4.4.3 Admission contract (`MutationEnvelope`, §5.1)
Client-supplied: `mutationId` (ULID), `graphId`, `kind: 'update'|'ops'|'publish'|'policy'|'iac'`, `update` (base64 V2) or `ops[]`, `description`, `intent?` (free text, recorded, not trusted), `baseRevision?` (agents: required; editors: optional, informational), `expectedHeadStateVector?` (optional optimistic check), `approvalRefs?`, `schemaVersion`, `clientInfo`.
Server-derived (ignored if present, error if present and different): `principal {sub, tenant, kind: 'human'|'agent'|'system', delegatedBy?}`, `connectionId`, `receivedAt`, `policyVersion`, `headStateVector`, `resultUpdateId`, `diff`, `decision`. The decision is bound to `sha256(U)`; the MutationRecord stores that hash and the appended object key, so an approval or audit entry always refers to the exact bytes committed.

### 4.4.4 Batch, concurrency, stale, conflict, duplicates, offline, reconnect, undo
- Batch: one envelope = one Yjs update = one transaction = atomic (applied or rejected whole). Agents may send several ops in one envelope; they become one update.
- Stale proposals: `baseRevision` older than head → `STALE_BASE` with `retry.rebaseTo`; the agent re-reads and re-proposes (no automatic rebase of code text).
- Conflicts: content-level conflicts are resolved by Yjs (LWW per scalar, sequence CRDT for text); *policy-level* conflicts (two approvals, approval then revocation) are ordered by the audit log ULID; approvals are re-checked at commit.
- Policy change during review: approvals carry `policyVersion`; a newer policy invalidates pending approvals that touch the changed rules (`APPROVAL_REQUIRED` again).
- Malformed updates: decode failure, oversize, struct-count cap → `SCHEMA_INVALID`, logged, sender rate-limited; never stored (fixes the verified poisoning, GS-13).
- Duplicates: `mutationId` idempotency table (`mutations/<graphId>/<mutationId>.json` written with `If-None-Match:*`); a duplicate returns the original ack; Yjs would tolerate duplicate bytes but the log and history must not inflate (A2 D.7).
- Offline edits: the editor's IndexedDB log [FACT GE-28] keeps local updates; on reconnect `WssCrdtProvider` (new `open` hook, PB-024) sends `SyncStep1`, then each unacknowledged local update as its own envelope; each is admitted or rejected individually.
- Rejection handling (never "replicate the rejection"): on `reject`, the client marks the mutation in the new **SyncStatus** store as rejected with the reason, then rebuilds its document from the server state (`GET /crdt/{id}/state?sv=`, seed a fresh `Y.Doc`, swap the session doc — `GraphCrdtSession` gains `replaceDoc()`), and re-applies any *later* unacknowledged local updates by replaying their snapshots through `reconcile()` (they get new mutation ids). The user sees a toast "Change '<description>' was rejected: <reason>" and the undo stack is reset (Yjs cannot un-apply an update; spike S-2 evaluates keeping the rejected change as a local-only "quarantined draft" the user can copy from). Code edits via Monaco (Y.Text binding, GE-22) are batched into envelopes by the existing 150 ms flush; a rejected code edit therefore reverts the batch.
- Undo/redo: local `Y.UndoManager` stays [FACT]; an undo is just another update that goes through admission (it may be rejected, e.g. after a permission change).

### 4.4.5 Authorities (separated)
`graph:read` (structure + metadata), `graph:inspect-internals` (code text, nested graphs), `graph:inspect-payloads` (observation payloads), `graph:observe` (events without payloads), `graph:propose`, `graph:approve`, `graph:commit`, `graph:activate`, `graph:rollback`, `graph:execute`, `graph:connect-privileged` (edges into nodes with `server`/`aws:*`/`secret:*` capabilities), `component:publish`, `registry:read`, `iac:propose`, `iac:approve`, `iac:read-status`, `policy:admin` (ACL edits). Propagation through recursion: a nested component's effective capabilities = declared ∩ parent instance grant ∩ principal grant (intersection only, never union). Revocation: policy change writes a new `policyVersion`; queued proposals are re-validated; in-flight executions keep their *execution-scoped* grant snapshot but effect checks consult a revocation list (`policy/revocations/<graphId>.json`, read at each privileged effect) so a revoked secret stops working within one effect call. Self-broadening: the ACL is not in the doc; a diff that adds capability requirements or `server` placement to a node requires `graph:connect-privileged` and, for `aws:*`/`iam`, `iac:approve`. Agents get authority only from delegation records; the same token over WS or MCP resolves to the same principal and grants (PB-012/PB-086).

## 4.5 Edge capabilities and intrinsic observability

### 4.5.1 Verified binding inventory [FACT] — see §2.5. Summary: `edges` is the only *edge* binding; everything else is ambient.

### 4.5.2 Capability model
```ts
type CapabilityKind = 'net:https' | 'storage:kv' | 'storage:s3' | 'secret' | 'timer' | 'browser:dom' | 'browser:storage' | 'aws:cfn' | 'aws:codebuild' | 'llm' | 'graph:invoke';
interface CapabilityRequirement { kind: CapabilityKind; scope: string[]; /* hosts, prefixes, secret refs, stack prefixes */ optional?: boolean; }
interface CapabilityGrant { subject: PrincipalRef | { instance: { graphId: string; nodeId: string } }; kind: CapabilityKind; scope: string[]; operations: string[]; lifetime: { until?: string; revisionBound?: string }; delegable: boolean; grantedBy: PrincipalRef; policyVersion: string; }
```
Ownership: a **definition** declares requirements (manifest); an **instance** carries the grant actually given by the graph owner (`properties.capabilities.granted`, admitted only with `graph:connect-privileged`); the **runtime principal** (execution owner) must also hold the grant; a **connection** never holds effect capabilities (it holds observation scope only). Effective = requirement ∩ instance grant ∩ principal grant. Escalation defences: nesting cannot widen (intersection); rewiring a hyperedge into a privileged node requires `graph:connect-privileged`; credential-bearing values cannot flow as data because secrets are only ever `secretRef` handles resolved *inside* the host binding (`host.secret(ref)` returns a one-shot client, never the value), and observation redaction class `secret` applies to any port that declares it.

Runtime shape: the scheduler wrapper builds `host` per invocation from the effective grants and passes it as an extra binding (`new AsyncFunction(…, "host", …)` in a patched scheduler, PB-060) — e.g. `host.fetch(url)` (checks `net:https` scope), `host.kv.get/put` (prefix-scoped), `host.secret(ref).openai()`, `host.emit(kind, data)` (custom observation), `host.deploy(desired)` (only on the builtin IaC node). Server: ambient `require`, `AWS`, `openai`, `fetch`, `process` are removed by running node code inside `isolated-vm` (§4.6) where only `host` and `edges` are injected references. Browser worker: same `host` object; ambient `fetch` cannot be removed from a Worker, so the browser is documented as *user-trusted*: it never holds server credentials (nothing crosses, §4.8.1) and its effects are observed but not prevented. Vue templates: `NodeComponent.vue` stops passing stores/`transact` (GE-40) and passes `host.ui` (emit output, read inputs, request a graph proposal via the normal path).

### 4.5.3 Observation model
```ts
interface Observation {
  id: string /* ulid */; seq: number /* per execution */; at: string;
  kind: 'edge.input'|'edge.output'|'route'|'exec.begin'|'exec.end'|'exec.error'|'effect'|'effect.denied'|'budget.exhausted'|'contract.violation'|'component.unresolved'|'deploy.status'|'test.result'|'summary.generated'|'custom';
  graphId: string; revisionId: string; instancePath: string[] /* nested instance node ids from root */; nodeId?: string; edgeField?: string; connectorId?: string;
  executionId: string; spanId: string; parentSpanId?: string; correlationId: string; causationId?: string;
  domain: 'browser'|'server'; owner: PrincipalRef; actor?: PrincipalRef;
  payload?: unknown | { redacted: 'hash'|'secret'|'size'; hash?: string; bytes?: number }; capability?: { kind, scope, decision: 'allowed'|'denied' };
  budget?: { dimension, used, limit };
}
```
Mapping from scheduler events [FACT names]: `beginedge`→`edge.input`, `beginconnector`/`endconnector`→`route` (+ `edge.output` at the setter), `begin`/`end`→`exec.begin`/`exec.end`, `error`→`exec.error`, `set`/`afterSet`→ span boundaries; effects and denials come from `host`. Ids: `executionId` minted by the owner at entry (`graph.invoke`, HTTP request, UI emit); `spanId` per node invocation; cross-domain hops carry `{executionId, spanId, seq}` in the `edge.deliver` message (§4.8) so parent/child and browser/server observations join on `executionId`.

### 4.5.4 Delivery, ordering, retention, redaction, subscriptions
- Ordering: `seq` is per execution per domain; consumers order by `(executionId, domain, seq)`; gaps are detectable (missing seq) and reported as `gap` markers when buffers overflow.
- Delivery: live = existing `graph-notify-{id}` channel [FACT], now authorized per principal at `subscribe` (PB-015) and redacted per grant; durable = batches of NDJSON appended to `observations/<graphId>/<yyyymmddhh>/<ulid>.ndjson` plus a per-execution index object; MCP `observations.query` reads the index. At-least-once; consumers dedupe on `id`.
- Buffering/sampling: per execution cap (proposed 5 000 observations / 2 MB, then `budget.exhausted` and sampling 1/10 of `route` events; errors and effects are never sampled); payload capture per port `capture: none|meta|full` (default `meta` = type, size, hash).
- Retention (D-9): observations 14 days (S3 lifecycle), audit forever (separate prefix, `If-None-Match:*` immutable, hash-chained per graph).
- Redaction: port `redaction: hash|secret` and capability `secret` always redact; `graph:inspect-payloads` required for `full` payloads; structure/metadata of a graph is visible only with `graph:read` — existence of a nested graph the principal cannot read is shown as `denied`.
- Audit (immutable, policy-relevant): every admitted/rejected mutation, approval, publish, activation, rollback, privileged effect (`aws:*`, `secret`, `iac`) with principal, digest, policyVersion. Diagnostics (sampled, payload-bearing) are the observation stream. Infra diagnostics outside graph edges (Lambda cold starts, API Gateway 5xx, Step Functions history) link back by `executionId`/`operationId` in their log lines; the plan does not claim edge-level visibility for them.

### 4.5.5 Traceability example (ordinary vs privileged, same vocabulary)
Ordinary: `edge.input {node: validate, field: value, payload: {meta: {type:'object', bytes: 212}}}` → `effect {capability: {kind:'net:https', scope:['api.example.com'], decision:'allowed'}}` → `edge.output {edgeField: 'ok'}` → `route {connectorId: c7 → handler.in}`.
Privileged (IaC): `edge.input {node: iac-stack, field: desired, payload: {redacted: 'hash', hash: '…'}}` → `effect {capability: {kind:'aws:cfn', scope:['pio-dev-*'], decision:'allowed'}, payload: {operationId, changeSetId}}` → `deploy.status {status: 'UPDATE_IN_PROGRESS'}` … → `edge.output {edgeField: 'terminal'}`. A principal with `graph:observe` only sees kinds, ids and timings; `graph:inspect-payloads` adds payloads except `secret`.
