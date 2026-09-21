# 5. Interface specification

## 5.0 MCP protocol and SDK decisions [FACT from A4 + PROPOSED]
- Protocol revision **2026-07-28**: sessionless Streamable HTTP, one POST per request with `_meta.io.modelcontextprotocol/{protocolVersion,clientInfo,clientCapabilities}`, headers `MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name` (server MUST reject mismatches with -32020), no server-initiated requests (elicitation via `resultType:"input_required"`), long-lived notifications only through `subscriptions/listen`, cancellation = client closes the response stream, Origin validation MUST.
- SDK: `@modelcontextprotocol/server` 2.0.0 (the 1.x `@modelcontextprotocol/sdk` line does not implement this revision).
- Authorization: OAuth 2.1 resource server with RFC 9728 metadata at `/.well-known/oauth-protected-resource` (Auth0 as authorization server, decision D-7); tokens in `Authorization: Bearer` only; audience = the MCP endpoint URL; scopes = the authority names of §4.4.5; 401/403 with `WWW-Authenticate` challenges.
- Placement (decision D-3): `POST /mcp` on the existing REST API (29 s budget per call) served by a new Lambda `mcp`; every operation that can exceed ~20 s returns a **Tasks-extension** task (`resultType:"task"`, `tasks/get|update|cancel`); `subscriptions/listen` is served by a Lambda **Function URL with response streaming** (≤ 15 min per stream, client re-listens; spike S-3) — if S-3 fails, subscriptions are omitted and clients poll `observations.query {since}` / `tasks/get`.
- Sessions: none at protocol level; server state is addressed by explicit handles (`proposalId`, `taskId`, cursors) that are re-authorized on every call.
- Agent identity: token `sub` is either a human (editor chat acting as the user) or a registered agent client; for agents the server requires a delegation record `policy/agents/<sub>/<graphId>.json` written by a human with `policy:admin` (scopes ⊆ the human's grants, expiry). Principal = `{sub, kind:'agent', delegatedBy}`; the same token over WS resolves identically.

## 5.1 Common envelopes and error model
Every tool returns `structuredContent` conforming to its `outputSchema`, plus the serialized JSON as a text block (spec recommendation):
```json
{ "envelope": { "schemaVersion": "1", "requestId": "01J…", "principal": { "sub": "auth0|…", "kind": "agent", "delegatedBy": "auth0|…" }, "graphId": "g…", "baseRevision": "rev…", "resultRevision": "rev…", "correlationId": "01J…", "policyVersion": "p12", "serverTime": "2026-…", "truncated": false }, "result": { } }
```
Errors are tool execution errors (`isError:true`) with `structuredContent.error = { code, message, retry: { retryable, afterMs?, rebaseTo? }, details }`, codes: `ADMISSION_DENIED, STALE_BASE, SCHEMA_INVALID, CAPABILITY_MISSING, NOT_FOUND, CONFLICT, BUDGET_EXCEEDED, APPROVAL_REQUIRED, UNSUPPORTED_FIELD, RATE_LIMITED, INTEGRITY_FAILURE, UNRESOLVED_COMPONENT`. Unknown fields anywhere → `SCHEMA_INVALID` (`additionalProperties:false` at every level; `details.unknownFields[]`). Server-derived fields (`principal`, `requestId`, `serverTime`, `policyVersion`) are ignored if supplied and an error if supplied with a different value. Schema versioning: every input has `schemaVersion` (default 1); a server supporting v1..vN rejects `> N` with `UNSUPPORTED_FIELD` naming supported versions; additive fields ship as minor without bump.

```ts
// Shared with the WS path (graph-crdt/schema.ts, PROPOSED additions)
interface MutationEnvelope { action: 'yjs'; schemaVersion: 2; mutationId: string; graphId: string; kind: 'update'|'ops'|'publish'|'policy'|'iac'; update?: string /* base64 V2 */; ops?: MutationOp[]; description: string; intent?: string; baseRevision?: string; expectedHeadStateVector?: string; approvalRefs?: string[]; format: 2; clientInfo?: { name: string; version: string }; }
interface AdmissionResult { mutationId: string; decision: 'accepted'|'rejected'|'approval-required'; code?: string; reason?: string; updateId?: string; headStateVector: string; diffSummary?: DiffSummary; policyVersion: string; }
type MutationOp =
 | { op:'add-node'; node: NodeInit } | { op:'remove-node'; nodeId: string } | { op:'set-node-code'; nodeId: string; template: 'set'|'vue'; text: string }
 | { op:'set-node-props'; nodeId: string; patch: Record<string, unknown> } | { op:'set-graph-props'; patch: Record<string, unknown> }
 | { op:'connect'; from: { nodeId; field }; to: { nodeId; field; graphId? } } | { op:'disconnect'; connectorId: string }
 | { op:'set-component-pin'; nodeId: string; pin: { publishedId; version; digest } } | { op:'set-capabilities'; nodeId: string; granted: CapabilityGrant[] }
 | { op:'set-placement'; nodeId: string; placement: 'browser'|'server'|'portable' } | { op:'set-budget'; nodeId?: string; budget: BudgetSpec }
 | { op:'set-iac-desired'; nodeId: string; desired: IacDesiredState };
```
The ops are materialised on the server by `applyOps(projection, ops)` (pure function in `graph-crdt/ops.ts`) followed by `reconcile()` [FACT primitive], so an agent proposal has a lossless mapping to the same Y.Doc changes an editor would make (R-10.6).

Implemented 2026-09-21 (PB-020/021): the WS and HTTP paths answer with `AdmissionResult` as above minus `approval-required` (M2), with `code` also allowing `STALE_BASE` (the update depends on structs the server never received) and `RATE_LIMITED` (+ `retryAfterMs`); `diffSummary` is the compact form of `graph-crdt/diff.ts` `DiffSummary` (counts, namespaces, privilege delta, first 50 ops). The diff's op vocabulary is the `MutationOp` list above plus summary-only ops `set-node-fields` / `set-graph-fields` (top-level keys such as `artifact`, `data`, `url`) and `set-meta` / `set-observed` / `set-policy` (server-owned namespaces, refused for clients).

## 5.2 Resources
| URI template | Represents | MIME | Identity / revision | Pagination | Subscribe | Visibility / redaction | Size |
|---|---|---|---|---|---|---|---|
| `plastic://graphs` | authorized graph list (TOC doc [FACT]) | application/json | live, `ttlMs 5000`, `cacheScope private` | cursor, 100/page | `resourcesListChanged` | tenant-filtered | ≤ 64 KiB/page |
| `plastic://graph/{graphId}` | summary at HEAD (or `?rev=`) | application/json | `resultRevision` in body | — | `resources/updated` on commit/activate | `graph:read`; code omitted | ≤ 32 KiB |
| `plastic://graph/{graphId}/rev/{revisionId}` | revision manifest | application/json | immutable, `cacheScope public`, `ttlMs` 1 year | — | no | `graph:read` | ≤ 16 KiB |
| `plastic://graph/{graphId}/rev/{revisionId}/node/{nodeId}?expand=code` | node definition incl. edges, contract, placement, capabilities; code only with `expand=code` | application/json | immutable | — | no | code needs `graph:inspect-internals` | ≤ 256 KiB |
| `plastic://graph/{graphId}/rev/{revisionId}/subgraph?root=&depth=&maxNodes=&cursor=` | bounded expansion | application/json | immutable; `truncated` flags | continuation token | no | denied children as `{nodeId, denied:true}` | ≤ 256 KiB |
| `plastic://component/{publishedId}/{version}` | manifest + artifact summary | application/json | immutable (digest) | — | no | `registry:read` | ≤ 256 KiB |
| `plastic://component/{publishedId}` | versions, latest, deprecations, consumers count | application/json | live | cursor | `resources/updated` on publish | `registry:read` | ≤ 32 KiB |
| `plastic://graph/{graphId}/history?from=&to=` | mutation records (id, actor, description, decision, revision) | application/json | live | cursor | yes | `graph:read`; rationale text marked untrusted | ≤ 64 KiB/page |
| `plastic://graph/{graphId}/diff/{fromRev}/{toRev}` | semantic diff | application/json | immutable | — | no | code hunks need `inspect-internals` | ≤ 512 KiB |
| `plastic://graph/{graphId}/observations?since=&kind=&nodeId=&executionId=&limit=` | observation index | application/json | live, `sinceId` continuation | cursor ≤ 500 | yes | payloads per `inspect-payloads`; `secret` always redacted | ≤ 512 KiB/page |
| `plastic://graph/{graphId}/proposal/{proposalId}` | proposal state, validation, diff, decisions | application/json | live (ETag) | — | yes | proposer, approvers, `graph:read` | ≤ 512 KiB |
| `plastic://graph/{graphId}/deployment/{instanceId}` | IaC status document | application/json | live | — | yes | `iac:read-status`; logs as references only | ≤ 64 KiB |
| `plastic://graph/{graphId}/journeys` | intent journeys + latest results | application/json | live | cursor | yes | `graph:read` | ≤ 64 KiB |
Resources are pure, cacheable, subscribable reads; anything that creates state or needs budgets/cancellation is a tool. Resource not found → JSON-RPC `-32602` (spec). All URIs are validated against the templates; unknown scheme/host → `-32602`.

## 5.3 Tools (name · purpose · permissions · idempotency · side effects · cancellation · mapping)
Full JSON Schemas for all 19 tools, with valid and rejected examples and an ajv validation report, are in appendix A6 and `schemas/mcp/`.
JSON Schemas below are abbreviated to the required/bounded fields; full JSON Schemas for the core tools (with valid and rejected examples) are in appendix A6; generated schemas from `@plastic-io/graph-schema` (`schemas/mcp/*.json`) become the source of truth (PB-121).

1. **`graph.summary`** — read summary for graph or node at a revision. Input `{schemaVersion:1, graphId (uuid), revisionId?, nodeId?, include?: ["contract","capabilities","health","deps"]}`; output `{envelope, result: ComponentSummary}`. Perm `graph:read`. Read-only (annotation `readOnlyHint`, informative only). Mapping: `mcp/tools/summary.ts → summaryService.summarize()` (server `src/summary/`). Rejected example: `{graphId:"g1", nodeId:"n9"}` where n9 is a nested node of a graph the caller may not read → `NOT_FOUND` (existence not disclosed).
2. **`graph.expand`** — bounded traversal. Input `{graphId, revisionId, root:{nodeId}, direction:"in"|"out"|"both", depth: 1..4, maxNodes: 1..200, maxBytes: ≤262144, includeCode?: boolean, cursor?}`; output `{nodes: ComponentSummary[], edges: {from:{nodeId,field}, to:{nodeId,field}, connectorId}[], truncated:{byDepth,byCount,byBytes}, nextCursor?}`. Perm `graph:read` (+`inspect-internals` for code). Cursor is revision-bound; a cursor from another revision → `STALE_BASE`.
3. **`component.search`** — `{query (≤200 chars), tags?, capability?, placement?, limit ≤50, cursor?}` → `{components: ManifestSummary[], nextCursor?}`; perm `registry:read`; indexes only `registry:read`-visible fields.
4. **`observations.query`** — `{graphId, filter:{nodeId?, edgeField?, kind?, executionId?, correlationId?, since?, until?}, limit ≤500, cursor?}` → `{observations: Observation[], nextCursor?}`; perm `graph:observe` (+`inspect-payloads`); mapping `observationStore.query()`.
5. **`proposal.create`** — `{graphId, baseRevision, ops: MutationOp[] (1..500), description (≤200), rationale (≤4000), idempotencyKey (ulid)}` → `{proposalId, proposalDigest, validation:{ok, errors[]}, impact:{consumers[], downstream[], privilegeDelta[], testsToRun[]}, requiredDecisions:["approve"…]}`. Perm `graph:propose`. Idempotent on `idempotencyKey` (same key → same proposal). Side effect: proposal document + audit. Failures `STALE_BASE`, `SCHEMA_INVALID`, `CAPABILITY_MISSING`, `UNRESOLVED_COMPONENT`. Valid example: `{graphId:"g1", baseRevision:"rev7", ops:[{op:"set-node-code", nodeId:"normalize", template:"set", text:"edges.out = value.trim();"}], description:"Trim only whitespace", rationale:"R12 strips trailing dots…", idempotencyKey:"01J…"}` → `{proposalId:"p1", validation:{ok:true}, impact:{downstream:["validate"], testsToRun:["contract:validate","journey:account-settings-change"]}, requiredDecisions:[]}`. Rejected example: same with `baseRevision:"rev6"` while HEAD is rev7 → `isError`, `{code:"STALE_BASE", retry:{retryable:true, rebaseTo:"rev7"}}` — rejected because approvals and validation are meaningless against a base that is not head.
6. **`proposal.validate`** — `{proposalId, rebase?: boolean}` re-validates against HEAD; `rebase:true` re-applies ops on the new head (structural ops only; code ops conflicting with newer code edits → `CONFLICT`).
7. **`proposal.simulate`** — `{proposalId, mode:"structural"|"shadow"|"replay", executionSample?: {sinceMinutes ≤ 1440, max ≤ 50}, budget?: BudgetSpec}` → task; result `{comparisons[], unsimulatedEffects[], coverage}`; perm `graph:simulate`; never performs real effects (host in `sim` mode; `aws:*` → plan only). Cancellable via `tasks/cancel` (cooperative → token).
8. **`proposal.decide`** — `{proposalId, decision:"approve"|"reject", proposalDigest, rationale (≤2000)}`; perm `graph:approve`; an agent may not approve a proposal it created unless policy `selfApprove` for the scope; binds digest+base+policyVersion; audit event `proposal.decided`.
9. **`proposal.commit`** — `{proposalId, proposalDigest, baseRevision}` → `{resultRevision, mutationId}`; perm `graph:commit`; idempotent (re-commit of committed → same revision); `APPROVAL_REQUIRED` / `STALE_BASE` / `CONFLICT` on HEAD CAS loss.
10. **`revision.activate`** — `{graphId, revisionId, strategy:"switch-new-work"|"drain"|"cancel-inflight", drainMs? ≤ 60000}` → task `{status, activeRevision, inflightAtSwitch}`; perm `graph:activate`; preconditions: no unresolved components, schema supported by all domains; postcondition: `active/<graphId>` = revisionId, projection written, `revision.activated` fanned out.
11. **`revision.rollback`** — `{graphId, toRevision, scope: ["definition","activation","infra"], compensation:"none"|"run-compensators"}` → task with `{residualDrift[], irreversibleEffects[], manualReview}`; perm `graph:rollback` (+`iac:approve` if `infra`).
12. **`component.publish`** — `{graphId, revisionId, target:{nodeId}|{graph:true}, version:"next"|number, contract, summary, tests?, capabilities, placement}` → `{publishedId, version, digest, consumersAffected: 0}`; perm `component:publish`; side effect: immutable write (`CONFLICT` on existing version).
13. **`graph.invoke`** — `{graphId, revisionId?, entry:{nodeUrl}|{nodeId}, field, value (≤ payloadBytes), budget?, correlationId?, sync?: boolean}` → sync result within 20 s or task; perm `graph:execute` + runtime capability checks; side effects = whatever the graph's *granted* effects are (listed from the manifest in the tool description); cancellable (`execution.cancel`).
14. **`tests.run`** — `{target:{componentId, version}|{graphId, revisionId}|{proposalId}, selection?: ["contract","invariant","journey:<id>"], budget?}` → task `{results[], revisionBound, coverage}`; perm `graph:test`.
15. **`iac.plan` / `iac.apply` / `iac.cancel` / `iac.status`** — operate the IacStack instance through its contract: `plan {graphId, instanceId, desired?: IacDesiredState}` → task `{plan}`; `apply {graphId, instanceId, planRef, approvalRef?}` → task (`APPROVAL_REQUIRED` for destructive/prod); `cancel {operationId, reason}` → `{accepted, note:"AWS may still complete"}`; `status {instanceId}` → status document. Perms `iac:propose`, `iac:approve`, `iac:read-status`. No tool exposes raw CloudFormation/CodeBuild/IAM calls.
16. **`execution.cancel`** — `{executionId, reason}` → `{state}`; perm `graph:execute` on that graph; cooperative then out-of-band (§4.6.3).
17. **`tasks/get`, `tasks/update`, `tasks/cancel`** per the Tasks extension for every task-returning tool; task records in `tasks/<taskId>.json` with `ttlMs` 86 400 000, `pollIntervalMs` 2 000.

Every tool: audit event `mcp.tool.<name>` with principal, arguments hash, decision, duration; rate limit per principal (proposed 60/min reads, 10/min writes); tool annotations are descriptive only — authorization is the policy module.

## 5.4 Shared types, serialization and compatibility rules
- New package **`@plastic-io/graph-schema`** (`graph-editor/packages/GraphSchema`, published to npm): JSON Schema 2020-12 for `Graph`, `Node`, `Edge`, `Connector`, `ComponentManifest`, `PortContract`, `CapabilityRequirement/Grant`, `Observation`, `MutationEnvelope`, `MutationOp`, `AdmissionResult`, `Revision`, `Proposal`, `BudgetSpec`, `ExecutionHandle` (wire view), `IacDesiredState/Observed`, `IntentJourney`, `TestRef`; TS types generated (`json-schema-to-typescript`), Rust types generated by `typify` into `plastic-io-rust/src/schema.rs` (replacing the hand-written `types.rs`, RT-21), MCP tool schemas derived from the same files.
- Canonical JSON for digests: RFC 8785 (JCS) over the projection with `layout` keys stripped for `digest.definition`; `Date` fields serialised as ISO strings; `undefined` omitted; numbers must be finite.
- `wireValue` codec for edge payloads: JSON with reserved tags for `{$date}`, `{$bytes: base64}`, `{$secretRef}`; anything else rejected at the boundary (fixes RT-29 silently-null objects by making the Rust side fail loudly).
- Version negotiation: doc `meta.schemaVersion` (currently 1 [FACT]); wire `MutationEnvelope.schemaVersion` (2 for the new envelope; the server accepts legacy `YjsEnvelope` v1 without `mutationId` only for principals with the `legacy-client` flag during the migration window, minting a server-side `mutationId`); MCP `_meta` protocol version; Rust/TS `compat.runtime` in manifests; browser/server report their supported `schemaVersion` on `$connect`/`server/discover`.
- Yjs persistence: unchanged (V2 in S3 [FACT]); revision snapshots use `encodeStateAsUpdateV2`.

### 5.4.1 Rust representation (generated; example)
```rust
// plastic-io-rust/src/schema.rs (generated from graph-schema by typify; do not edit)
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Observation {
    pub id: String, pub seq: u64, pub at: String, pub kind: ObservationKind,
    pub graph_id: String, pub revision_id: String, pub instance_path: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub node_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub edge_field: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub connector_id: Option<String>,
    pub execution_id: String, pub span_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub parent_span_id: Option<String>,
    pub correlation_id: String, pub domain: Domain, pub owner: PrincipalRef,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub payload: Option<serde_json::Value>,
}
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)] #[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct MutationEnvelope { pub action: String, pub schema_version: u8, pub mutation_id: String, pub graph_id: String, pub kind: MutationKind, #[serde(default)] pub update: Option<String>, #[serde(default)] pub ops: Vec<MutationOp>, pub description: String, #[serde(default)] pub base_revision: Option<String>, pub format: u8 }
```
Graph documents keep serde's default of ignoring unknown fields (forward compatible); only envelopes and IaC desired state use `deny_unknown_fields`.
