# A6. MCP tool schemas (JSON Schema 2020-12) — core tools, with valid and rejected examples

Conventions: every object has `additionalProperties:false`; `$defs` are shared across tools and generated from `@plastic-io/graph-schema`; `envelope` is server-produced. Strings are bounded; ids are ULIDs (`^[0-9A-HJKMNP-TV-Z]{26}$`) except graph/node ids, which are the existing UUIDs/random names (`^[A-Za-z0-9_.-]{1,64}$`).

## Shared `$defs`
```json
{
  "$defs": {
    "ulid": { "type": "string", "pattern": "^[0-9A-HJKMNP-TV-Z]{26}$" },
    "id": { "type": "string", "pattern": "^[A-Za-z0-9_.-]{1,64}$" },
    "revisionId": { "type": "string", "pattern": "^rev_[0-9A-HJKMNP-TV-Z]{26}$" },
    "principal": { "type": "object", "additionalProperties": false, "required": ["sub", "kind", "tenant"],
      "properties": { "sub": { "type": "string", "maxLength": 256 }, "kind": { "enum": ["human", "agent", "system", "synthetic"] }, "tenant": { "type": "string", "maxLength": 128 }, "delegatedBy": { "type": "string", "maxLength": 256 } } },
    "envelope": { "type": "object", "additionalProperties": false, "required": ["schemaVersion", "requestId", "principal", "correlationId", "policyVersion", "serverTime", "truncated"],
      "properties": { "schemaVersion": { "const": "1" }, "requestId": { "$ref": "#/$defs/ulid" }, "principal": { "$ref": "#/$defs/principal" }, "graphId": { "$ref": "#/$defs/id" }, "baseRevision": { "$ref": "#/$defs/revisionId" }, "resultRevision": { "$ref": "#/$defs/revisionId" }, "correlationId": { "$ref": "#/$defs/ulid" }, "policyVersion": { "type": "string", "maxLength": 32 }, "serverTime": { "type": "string", "format": "date-time" }, "truncated": { "type": "boolean" } } },
    "error": { "type": "object", "additionalProperties": false, "required": ["code", "message", "retry"],
      "properties": { "code": { "enum": ["ADMISSION_DENIED", "STALE_BASE", "SCHEMA_INVALID", "CAPABILITY_MISSING", "NOT_FOUND", "CONFLICT", "BUDGET_EXCEEDED", "APPROVAL_REQUIRED", "UNSUPPORTED_FIELD", "RATE_LIMITED", "INTEGRITY_FAILURE", "UNRESOLVED_COMPONENT"] }, "message": { "type": "string", "maxLength": 2000 },
        "retry": { "type": "object", "additionalProperties": false, "required": ["retryable"], "properties": { "retryable": { "type": "boolean" }, "afterMs": { "type": "integer", "minimum": 0, "maximum": 3600000 }, "rebaseTo": { "$ref": "#/$defs/revisionId" } } },
        "details": { "type": "object" } } },
    "budget": { "type": "object", "additionalProperties": false,
      "properties": { "wallMs": { "type": "integer", "minimum": 1, "maximum": 900000 }, "cpuMs": { "type": "integer", "minimum": 1, "maximum": 900000 }, "heapMb": { "type": "integer", "minimum": 8, "maximum": 1024 }, "hops": { "type": "integer", "minimum": 1, "maximum": 1000000 }, "fanOut": { "type": "integer", "minimum": 1, "maximum": 100000 }, "depth": { "type": "integer", "minimum": 1, "maximum": 256 }, "observations": { "type": "integer", "minimum": 1, "maximum": 1000000 }, "observationBytes": { "type": "integer", "minimum": 1024, "maximum": 268435456 }, "payloadBytes": { "type": "integer", "minimum": 1, "maximum": 6291456 }, "concurrentChildren": { "type": "integer", "minimum": 1, "maximum": 1024 } } },
    "portContract": { "type": "object", "additionalProperties": false, "required": ["name", "schema", "required"],
      "properties": { "name": { "$ref": "#/$defs/id" }, "schema": { "type": "object" }, "required": { "type": "boolean" }, "default": {}, "redaction": { "enum": ["none", "hash", "secret"] }, "capture": { "enum": ["none", "meta", "full"] } } },
    "capabilityRequirement": { "type": "object", "additionalProperties": false, "required": ["kind", "scope"],
      "properties": { "kind": { "enum": ["net:https", "storage:kv", "storage:s3", "secret", "timer", "browser:dom", "browser:storage", "aws:cfn", "aws:codebuild", "llm", "graph:invoke"] }, "scope": { "type": "array", "maxItems": 64, "items": { "type": "string", "maxLength": 256 } }, "optional": { "type": "boolean" } } },
    "capabilityGrant": { "type": "object", "additionalProperties": false, "required": ["kind", "scope", "operations"],
      "properties": { "kind": { "$ref": "#/$defs/capabilityRequirement/properties/kind" }, "scope": { "$ref": "#/$defs/capabilityRequirement/properties/scope" }, "operations": { "type": "array", "maxItems": 32, "items": { "type": "string", "maxLength": 64 } }, "lifetime": { "type": "object", "additionalProperties": false, "properties": { "until": { "type": "string", "format": "date-time" }, "revisionBound": { "$ref": "#/$defs/revisionId" } } }, "delegable": { "type": "boolean" } } },
    "componentPin": { "type": "object", "additionalProperties": false, "required": ["publishedId", "version", "digest"],
      "properties": { "publishedId": { "$ref": "#/$defs/id" }, "version": { "type": "integer", "minimum": 0 }, "digest": { "type": "string", "pattern": "^sha256:[0-9a-f]{64}$" } } },
    "mutationOp": { "oneOf": [
      { "type": "object", "additionalProperties": false, "required": ["op", "node"], "properties": { "op": { "const": "add-node" }, "node": { "type": "object", "additionalProperties": false, "required": ["id", "url"], "properties": { "id": { "$ref": "#/$defs/id" }, "url": { "$ref": "#/$defs/id" }, "name": { "type": "string", "maxLength": 128 }, "inputs": { "type": "array", "maxItems": 64, "items": { "$ref": "#/$defs/portContract" } }, "outputs": { "type": "array", "maxItems": 64, "items": { "$ref": "#/$defs/portContract" } }, "placement": { "enum": ["browser", "server", "portable"] }, "template": { "type": "object", "additionalProperties": false, "properties": { "set": { "type": "string", "maxLength": 262144 }, "vue": { "type": "string", "maxLength": 262144 } } }, "layout": { "type": "object", "additionalProperties": false, "properties": { "x": { "type": "number" }, "y": { "type": "number" }, "z": { "type": "number" } } } } } } },
      { "type": "object", "additionalProperties": false, "required": ["op", "nodeId"], "properties": { "op": { "const": "remove-node" }, "nodeId": { "$ref": "#/$defs/id" } } },
      { "type": "object", "additionalProperties": false, "required": ["op", "nodeId", "template", "text"], "properties": { "op": { "const": "set-node-code" }, "nodeId": { "$ref": "#/$defs/id" }, "template": { "enum": ["set", "vue"] }, "text": { "type": "string", "maxLength": 262144 } } },
      { "type": "object", "additionalProperties": false, "required": ["op", "nodeId", "patch"], "properties": { "op": { "const": "set-node-props" }, "nodeId": { "$ref": "#/$defs/id" }, "patch": { "type": "object", "maxProperties": 64 } } },
      { "type": "object", "additionalProperties": false, "required": ["op", "patch"], "properties": { "op": { "const": "set-graph-props" }, "patch": { "type": "object", "maxProperties": 64 } } },
      { "type": "object", "additionalProperties": false, "required": ["op", "from", "to"], "properties": { "op": { "const": "connect" }, "from": { "type": "object", "additionalProperties": false, "required": ["nodeId", "field"], "properties": { "nodeId": { "$ref": "#/$defs/id" }, "field": { "$ref": "#/$defs/id" } } }, "to": { "type": "object", "additionalProperties": false, "required": ["nodeId", "field"], "properties": { "nodeId": { "$ref": "#/$defs/id" }, "field": { "$ref": "#/$defs/id" }, "graphId": { "$ref": "#/$defs/id" } } } } },
      { "type": "object", "additionalProperties": false, "required": ["op", "connectorId"], "properties": { "op": { "const": "disconnect" }, "connectorId": { "$ref": "#/$defs/id" } } },
      { "type": "object", "additionalProperties": false, "required": ["op", "nodeId", "pin"], "properties": { "op": { "const": "set-component-pin" }, "nodeId": { "$ref": "#/$defs/id" }, "pin": { "$ref": "#/$defs/componentPin" } } },
      { "type": "object", "additionalProperties": false, "required": ["op", "nodeId", "granted"], "properties": { "op": { "const": "set-capabilities" }, "nodeId": { "$ref": "#/$defs/id" }, "granted": { "type": "array", "maxItems": 32, "items": { "$ref": "#/$defs/capabilityGrant" } } } },
      { "type": "object", "additionalProperties": false, "required": ["op", "nodeId", "placement"], "properties": { "op": { "const": "set-placement" }, "nodeId": { "$ref": "#/$defs/id" }, "placement": { "enum": ["browser", "server", "portable"] } } },
      { "type": "object", "additionalProperties": false, "required": ["op", "budget"], "properties": { "op": { "const": "set-budget" }, "nodeId": { "$ref": "#/$defs/id" }, "budget": { "$ref": "#/$defs/budget" } } },
      { "type": "object", "additionalProperties": false, "required": ["op", "nodeId", "desired"], "properties": { "op": { "const": "set-iac-desired" }, "nodeId": { "$ref": "#/$defs/id" }, "desired": { "$ref": "iac-desired-state.json" } } }
    ] }
  }
}
```

## `graph.expand`
Input:
```json
{ "$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": false,
  "required": ["schemaVersion", "graphId", "revisionId", "root", "direction", "depth", "maxNodes", "maxBytes"],
  "properties": {
    "schemaVersion": { "const": 1 },
    "graphId": { "$ref": "#/$defs/id" }, "revisionId": { "$ref": "#/$defs/revisionId" },
    "root": { "type": "object", "additionalProperties": false, "required": ["nodeId"], "properties": { "nodeId": { "$ref": "#/$defs/id" } } },
    "direction": { "enum": ["in", "out", "both"] },
    "depth": { "type": "integer", "minimum": 1, "maximum": 4 },
    "maxNodes": { "type": "integer", "minimum": 1, "maximum": 200 },
    "maxBytes": { "type": "integer", "minimum": 1024, "maximum": 262144 },
    "includeCode": { "type": "boolean", "default": false },
    "cursor": { "type": "string", "maxLength": 4096 }
  } }
```
Output (`structuredContent`):
```json
{ "type": "object", "additionalProperties": false, "required": ["envelope", "result"],
  "properties": { "envelope": { "$ref": "#/$defs/envelope" },
    "result": { "type": "object", "additionalProperties": false, "required": ["nodes", "edges", "truncated"],
      "properties": {
        "nodes": { "type": "array", "maxItems": 200, "items": { "$ref": "component-summary.json" } },
        "edges": { "type": "array", "maxItems": 4000, "items": { "type": "object", "additionalProperties": false, "required": ["connectorId", "from", "to"],
          "properties": { "connectorId": { "$ref": "#/$defs/id" }, "from": { "type": "object", "required": ["nodeId", "field"], "properties": { "nodeId": { "$ref": "#/$defs/id" }, "field": { "$ref": "#/$defs/id" } } }, "to": { "type": "object", "required": ["nodeId", "field"], "properties": { "nodeId": { "$ref": "#/$defs/id" }, "field": { "$ref": "#/$defs/id" }, "graphId": { "$ref": "#/$defs/id" }, "denied": { "type": "boolean" } } } } } },
        "truncated": { "type": "object", "additionalProperties": false, "required": ["byDepth", "byCount", "byBytes"], "properties": { "byDepth": { "type": "boolean" }, "byCount": { "type": "boolean" }, "byBytes": { "type": "boolean" } } },
        "nextCursor": { "type": "string", "maxLength": 4096 },
        "cost": { "type": "object", "additionalProperties": false, "properties": { "nodes": { "type": "integer" }, "bytes": { "type": "integer" }, "ms": { "type": "integer" } } } } } } }
```
Valid: `{"schemaVersion":1,"graphId":"7ba47581-fb4e-4ee3-a200-80fcb6d83fe6","revisionId":"rev_01J8ZK3Q4W5X6Y7Z8A9B0C1D2E","root":{"nodeId":"validate"},"direction":"in","depth":1,"maxNodes":20,"maxBytes":65536}` → nodes `[form, normalize]`, `truncated:{false,false,false}`.
Rejected: same with `"depth": 9` → JSON-RPC `-32602` (protocol error: fails the input schema before any service call); and same with a `cursor` minted at `rev_…OLD` → `isError` `STALE_BASE {rebaseTo: "rev_…"}` because a continuation must not mix revisions.

## `proposal.create`
Input:
```json
{ "type": "object", "additionalProperties": false, "required": ["schemaVersion", "graphId", "baseRevision", "ops", "description", "idempotencyKey"],
  "properties": {
    "schemaVersion": { "const": 1 }, "graphId": { "$ref": "#/$defs/id" }, "baseRevision": { "$ref": "#/$defs/revisionId" },
    "ops": { "type": "array", "minItems": 1, "maxItems": 500, "items": { "$ref": "#/$defs/mutationOp" } },
    "description": { "type": "string", "minLength": 1, "maxLength": 200 },
    "rationale": { "type": "string", "maxLength": 4000 },
    "expected": { "type": "object", "additionalProperties": false, "properties": { "affects": { "type": "array", "maxItems": 500, "items": { "$ref": "#/$defs/id" } } } },
    "idempotencyKey": { "$ref": "#/$defs/ulid" } } }
```
Output:
```json
{ "type": "object", "additionalProperties": false, "required": ["envelope", "result"],
  "properties": { "envelope": { "$ref": "#/$defs/envelope" },
    "result": { "type": "object", "additionalProperties": false, "required": ["proposalId", "proposalDigest", "state", "validation", "impact", "requiredDecisions"],
      "properties": {
        "proposalId": { "$ref": "#/$defs/ulid" }, "proposalDigest": { "type": "string", "pattern": "^sha256:[0-9a-f]{64}$" },
        "state": { "enum": ["validated", "awaiting-review"] },
        "validation": { "type": "object", "additionalProperties": false, "required": ["ok"], "properties": { "ok": { "type": "boolean" }, "errors": { "type": "array", "maxItems": 100, "items": { "type": "object", "required": ["code", "message"], "properties": { "code": { "type": "string" }, "message": { "type": "string", "maxLength": 1000 }, "nodeId": { "$ref": "#/$defs/id" }, "field": { "$ref": "#/$defs/id" } } } } } },
        "impact": { "type": "object", "additionalProperties": false, "required": ["consumers", "downstream", "privilegeDelta", "testsToRun", "oracleChanged"],
          "properties": { "consumers": { "type": "array", "maxItems": 1000, "items": { "type": "object", "required": ["graphId", "nodeId"], "properties": { "graphId": { "$ref": "#/$defs/id" }, "nodeId": { "$ref": "#/$defs/id" } } } }, "downstream": { "type": "array", "maxItems": 1000, "items": { "$ref": "#/$defs/id" } }, "privilegeDelta": { "type": "array", "maxItems": 100, "items": { "$ref": "#/$defs/capabilityRequirement" } }, "testsToRun": { "type": "array", "maxItems": 500, "items": { "type": "string", "maxLength": 200 } }, "oracleChanged": { "type": "boolean" } } },
        "requiredDecisions": { "type": "array", "maxItems": 8, "items": { "enum": ["approve", "iac-approve", "privileged-connect"] } },
        "diffSummary": { "$ref": "diff-summary.json" } } } } }
```
Valid: `{"schemaVersion":1,"graphId":"G","baseRevision":"rev_01J8…7","ops":[{"op":"set-node-code","nodeId":"normalize","template":"set","text":"edges.out = String(value).trim().toLowerCase();"}],"description":"Trim whitespace only","rationale":"rev12 also strips a trailing dot, which breaks email validation","idempotencyKey":"01J8ZK4M0N1P2Q3R4S5T6V7W8X"}` → `{proposalId, state:"validated", validation:{ok:true}, impact:{consumers:[], downstream:["validate"], privilegeDelta:[], testsToRun:["contract:validate","journey:account-settings-change"], oracleChanged:false}, requiredDecisions:[]}`.
Rejected: `{"…","ops":[{"op":"set-capabilities","nodeId":"normalize","granted":[{"kind":"aws:cfn","scope":["*"],"operations":["apply"]}]}],…}` → `isError` `{code:"CAPABILITY_MISSING", message:"granting aws:cfn requires graph:connect-privileged and iac:approve", retry:{retryable:false}}` — rejected because the op broadens privileges beyond the proposer's authority; the proposal is not stored (only the audit entry).

## `proposal.commit`
Input: `{ "type":"object","additionalProperties":false,"required":["schemaVersion","proposalId","proposalDigest","baseRevision"],"properties":{"schemaVersion":{"const":1},"proposalId":{"$ref":"#/$defs/ulid"},"proposalDigest":{"type":"string","pattern":"^sha256:[0-9a-f]{64}$"},"baseRevision":{"$ref":"#/$defs/revisionId"}} }`
Output: `{ …envelope…, "result":{"type":"object","additionalProperties":false,"required":["resultRevision","mutationId","state"],"properties":{"resultRevision":{"$ref":"#/$defs/revisionId"},"mutationId":{"$ref":"#/$defs/ulid"},"state":{"const":"committed"}}} }`
Valid: after approval → `{resultRevision:"rev_…13", mutationId:"01J…", state:"committed"}`; re-sending the same call → identical result (idempotent).
Rejected: `proposalDigest` differs from the stored proposal (edited after approval) → `APPROVAL_REQUIRED` with `details.expectedDigest`; base moved → `STALE_BASE {rebaseTo}`; caller lacks `graph:commit` → `ADMISSION_DENIED`.

## `revision.activate`
Input: `{ "type":"object","additionalProperties":false,"required":["schemaVersion","graphId","revisionId","strategy"],"properties":{"schemaVersion":{"const":1},"graphId":{"$ref":"#/$defs/id"},"revisionId":{"$ref":"#/$defs/revisionId"},"strategy":{"enum":["switch-new-work","drain","cancel-inflight"]},"drainMs":{"type":"integer","minimum":0,"maximum":60000}} }`
Result: `resultType:"task"`; `tasks/get` terminal result `{ "activeRevision": revisionId, "previousRevision": revisionId|null, "inflightAtSwitch": integer, "domains": { "server": {"schemaVersion": int, "ok": bool}, "browser": {"schemaVersion": int, "ok": bool} } }`.
Rejected: revision references an unresolved component → `UNRESOLVED_COMPONENT {details:{nodeId, pin}}`; a domain reports an unsupported `schemaVersion` → `UNSUPPORTED_FIELD {details:{domain, supported}}`.

## `iac.apply`
Input: `{ "type":"object","additionalProperties":false,"required":["schemaVersion","graphId","instanceId","planRef"],"properties":{"schemaVersion":{"const":1},"graphId":{"$ref":"#/$defs/id"},"instanceId":{"$ref":"#/$defs/id"},"planRef":{"type":"string","maxLength":256},"approvalRef":{"$ref":"#/$defs/ulid"},"idempotencyKey":{"$ref":"#/$defs/ulid"}} }`
Result: task; terminal `{ "operationId": string, "outcome": "succeeded"|"failed"|"rolled-back"|"rollback-failed"|"cancelled"|"superseded", "effectiveRevision": revisionId, "requestedRevision": revisionId, "manualRecoveryRequired": boolean, "statusUri": "plastic://graph/{graphId}/deployment/{instanceId}" }`.
Rejected: `plan.destructive` and no `approvalRef` → `APPROVAL_REQUIRED {details:{required:"iac:approve"}}`; a plan minted for an older desired state → `STALE_BASE`; stack lock held → `CONFLICT {retry:{retryable:true, afterMs:30000}}`.

## `graph.invoke`
Input: `{ "type":"object","additionalProperties":false,"required":["schemaVersion","graphId","entry","field","value"],"properties":{"schemaVersion":{"const":1},"graphId":{"$ref":"#/$defs/id"},"revisionId":{"$ref":"#/$defs/revisionId"},"entry":{"oneOf":[{"type":"object","additionalProperties":false,"required":["nodeUrl"],"properties":{"nodeUrl":{"$ref":"#/$defs/id"}}},{"type":"object","additionalProperties":false,"required":["nodeId"],"properties":{"nodeId":{"$ref":"#/$defs/id"}}}]},"field":{"$ref":"#/$defs/id"},"value":{},"budget":{"$ref":"#/$defs/budget"},"correlationId":{"$ref":"#/$defs/ulid"},"sync":{"type":"boolean","default":false}} }`
Note `entry.nodeUrl` is matched **exactly**, not by regex (the scheduler's `new RegExp(url)` match, RT-02, is wrapped with escaping in the executor).
Output (sync) / task result: `{ "executionId": ulid, "revisionId": revisionId, "state": "completed"|"failed"|"cancelled"|"abandoned", "outputs": { "<port>": {} }, "errors": [ { "nodeId", "message" } ], "budgetUsed": { "wallMs": int, "hops": int, "observations": int }, "observationsUri": string }`.
Rejected: `value` larger than `budget.payloadBytes` → `BUDGET_EXCEEDED`; entry not found → `NOT_FOUND`; caller lacks `graph:execute` → `ADMISSION_DENIED`.

## CloudFormation / CodeBuild status → component outcome mapping (used by `iac.*` and the feedback Lambda)
| Source status | `observed.deploy.status` | lifecycle state | terminal outcome |
|---|---|---|---|
| change set `CREATE_PENDING/CREATE_IN_PROGRESS` | same | planning | — |
| change set `CREATE_COMPLETE` | same | planning → awaiting-review or executing | — |
| change set `FAILED` (incl. "No updates are to be performed") | same | validating→failed / no-op | `failed` or `succeeded` (no-op, flagged `noChanges:true`) |
| CodeBuild `IN_PROGRESS` | build.status | building | — |
| CodeBuild `SUCCEEDED` | build.status | executing | — |
| CodeBuild `FAILED/FAULT/TIMED_OUT/STOPPED` | build.status | failed | `failed` (`cancelled` for STOPPED after cancel request) |
| stack `CREATE_IN_PROGRESS/UPDATE_IN_PROGRESS/UPDATE_COMPLETE_CLEANUP_IN_PROGRESS/DELETE_IN_PROGRESS` | same | observing | — |
| stack `CREATE_COMPLETE/UPDATE_COMPLETE/DELETE_COMPLETE/IMPORT_COMPLETE` | same | succeeded | `succeeded` |
| stack `CREATE_FAILED/DELETE_FAILED/UPDATE_FAILED` | same | failed | `failed` (`manualRecoveryRequired` for DELETE_FAILED) |
| stack `ROLLBACK_IN_PROGRESS/UPDATE_ROLLBACK_IN_PROGRESS/UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS` | same | observing (rolling back) | — |
| stack `ROLLBACK_COMPLETE/UPDATE_ROLLBACK_COMPLETE` | same | rolled-back | `rolled-back` (effectiveRevision = previous) |
| stack `ROLLBACK_FAILED/UPDATE_ROLLBACK_FAILED` | same | rollback-failed | `rollback-failed`, `manualRecoveryRequired:true` |
| stack `REVIEW_IN_PROGRESS` | same | awaiting-review | — |
| no event for > `staleAfterMs` (600 000) while non-terminal | `stale:true` | observing (poll fallback) | — |
| Step Functions `TIMED_OUT/ABORTED` | `orchestrator:timeout|aborted` | failed | `failed`, `manualRecoveryRequired` if stack non-terminal |

## Remaining tools: full schemas (machine-readable copies in `schemas/mcp/*.json`, examples in `schemas/examples/`)
Each schema file embeds the shared `$defs` so it validates standalone. The six core tools above are unchanged. Task-returning tools (`proposal.simulate`, `revision.rollback`, `tests.run`, `iac.plan`) return `resultType:"task"` and the output schema below describes the terminal `tasks/get` result. Every valid example below was validated against its input schema with ajv; every rejected example either fails the schema (JSON-RPC -32602) or passes the schema and is refused by policy/validation (tool error with `isError:true`), as stated in each "why rejected" line.

### `graph.summary`
- **Permissions:** graph:read
- **Idempotency:** idempotent read
- **Side effects:** none
- **Cancellation:** n/a (fast)
- **Mapping:** src/mcp/tools/read/summary.ts -> summaryService.summarize(graphId, revisionId|HEAD, nodeId?)

Input schema (`$defs` omitted, see `schemas/mcp/defs.json`):
```json
{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "https://plastic-io.github.io/schemas/mcp/graph.summary.input.json",
 "title": "graph.summary.input",
 "type": "object",
 "additionalProperties": false,
 "properties": {
  "schemaVersion": {
   "const": 1
  },
  "graphId": {
   "$ref": "#/$defs/id"
  },
  "revisionId": {
   "$ref": "#/$defs/revisionId"
  },
  "nodeId": {
   "$ref": "#/$defs/id"
  },
  "include": {
   "type": "array",
   "maxItems": 4,
   "items": {
    "enum": [
     "contract",
     "capabilities",
     "health",
     "deps"
    ]
   }
  }
 },
 "required": [
  "schemaVersion",
  "graphId"
 ]
}
```
Output schema (`structuredContent`):
```json
{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "https://plastic-io.github.io/schemas/mcp/graph.summary.output.json",
 "title": "graph.summary.output",
 "type": "object",
 "additionalProperties": false,
 "properties": {
  "envelope": {
   "$ref": "#/$defs/envelope"
  },
  "result": {
   "$ref": "#/$defs/componentSummary"
  }
 },
 "required": [
  "envelope",
  "result"
 ]
}
```
Valid example:
```json
{
 "schemaVersion": 1,
 "graphId": "7ba47581-fb4e-4ee3-a200-80fcb6d83fe6",
 "nodeId": "validate",
 "include": [
  "contract",
  "health"
 ]
}
```
Rejected example:
```json
{
 "schemaVersion": 1,
 "graphId": "7ba47581-fb4e-4ee3-a200-80fcb6d83fe6",
 "nodeId": "validate",
 "code": true
}
```
Why rejected: `code` is not a field -> -32602 (schema); use `plastic://.../node/{id}?expand=code` with graph:inspect-internals

### `component.search`
- **Permissions:** registry:read
- **Idempotency:** idempotent read
- **Side effects:** none
- **Cancellation:** n/a
- **Mapping:** src/mcp/tools/read/search.ts -> componentIndex.search()

Input schema (`$defs` omitted, see `schemas/mcp/defs.json`):
```json
{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "https://plastic-io.github.io/schemas/mcp/component.search.input.json",
 "title": "component.search.input",
 "type": "object",
 "additionalProperties": false,
 "properties": {
  "schemaVersion": {
   "const": 1
  },
  "query": {
   "type": "string",
   "minLength": 1,
   "maxLength": 200
  },
  "tags": {
   "type": "array",
   "maxItems": 16,
   "items": {
    "type": "string",
    "maxLength": 64
   }
  },
  "capability": {
   "enum": [
    "net:https",
    "storage:kv",
    "storage:s3",
    "secret",
    "timer",
    "browser:dom",
    "browser:storage",
    "aws:cfn",
    "aws:codebuild",
    "llm",
    "graph:invoke"
   ]
  },
  "placement": {
   "$ref": "#/$defs/placement"
  },
  "limit": {
   "type": "integer",
   "minimum": 1,
   "maximum": 50
  },
  "cursor": {
   "type": "string",
   "maxLength": 4096
  }
 },
 "required": [
  "schemaVersion",
  "query"
 ]
}
```
Output schema (`structuredContent`):
```json
{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "https://plastic-io.github.io/schemas/mcp/component.search.output.json",
 "title": "component.search.output",
 "type": "object",
 "additionalProperties": false,
 "properties": {
  "envelope": {
   "$ref": "#/$defs/envelope"
  },
  "result": {
   "type": "object",
   "additionalProperties": false,
   "properties": {
    "components": {
     "type": "array",
     "maxItems": 50,
     "items": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
       "publishedId": {
        "$ref": "#/$defs/id"
       },
       "version": {
        "type": "integer"
       },
       "digest": {
        "$ref": "#/$defs/digest"
       },
       "name": {
        "type": "string"
       },
       "purpose": {
        "type": "string",
        "maxLength": 2000
       },
       "placement": {
        "$ref": "#/$defs/placement"
       },
       "capabilities": {
        "type": "array",
        "maxItems": 32,
        "items": {
         "$ref": "#/$defs/capabilityRequirement"
        }
       },
       "deprecated": {
        "type": "boolean"
       },
       "consumers": {
        "type": "integer"
       }
      },
      "required": [
       "publishedId",
       "version",
       "digest",
       "name",
       "placement",
       "capabilities"
      ]
     }
    },
    "nextCursor": {
     "type": "string"
    }
   },
   "required": [
    "components"
   ]
  }
 },
 "required": [
  "envelope",
  "result"
 ]
}
```
Valid example:
```json
{
 "schemaVersion": 1,
 "query": "rate limit",
 "placement": "server",
 "limit": 10
}
```
Rejected example:
```json
{
 "schemaVersion": 1,
 "query": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```
Why rejected: `query` exceeds maxLength 200 -> -32602

### `observations.query`
- **Permissions:** graph:observe (+graph:inspect-payloads for full payloads)
- **Idempotency:** idempotent read
- **Side effects:** none
- **Cancellation:** n/a
- **Mapping:** src/mcp/tools/read/observations.ts -> observationStore.query() + redact()

Input schema (`$defs` omitted, see `schemas/mcp/defs.json`):
```json
{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "https://plastic-io.github.io/schemas/mcp/observations.query.input.json",
 "title": "observations.query.input",
 "type": "object",
 "additionalProperties": false,
 "properties": {
  "schemaVersion": {
   "const": 1
  },
  "graphId": {
   "$ref": "#/$defs/id"
  },
  "filter": {
   "type": "object",
   "additionalProperties": false,
   "properties": {
    "nodeId": {
     "$ref": "#/$defs/id"
    },
    "edgeField": {
     "$ref": "#/$defs/id"
    },
    "kind": {
     "$ref": "#/$defs/observationKind"
    },
    "executionId": {
     "$ref": "#/$defs/ulid"
    },
    "correlationId": {
     "$ref": "#/$defs/ulid"
    },
    "since": {
     "type": "string",
     "format": "date-time"
    },
    "until": {
     "type": "string",
     "format": "date-time"
    },
    "sinceId": {
     "$ref": "#/$defs/ulid"
    }
   }
  },
  "limit": {
   "type": "integer",
   "minimum": 1,
   "maximum": 500
  },
  "cursor": {
   "type": "string",
   "maxLength": 4096
  }
 },
 "required": [
  "schemaVersion",
  "graphId"
 ]
}
```
Output schema (`structuredContent`):
```json
{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "https://plastic-io.github.io/schemas/mcp/observations.query.output.json",
 "title": "observations.query.output",
 "type": "object",
 "additionalProperties": false,
 "properties": {
  "envelope": {
   "$ref": "#/$defs/envelope"
  },
  "result": {
   "type": "object",
   "additionalProperties": false,
   "properties": {
    "observations": {
     "type": "array",
     "maxItems": 500,
     "items": {
      "$ref": "#/$defs/observation"
     }
    },
    "nextCursor": {
     "type": "string"
    },
    "redactedCount": {
     "type": "integer"
    }
   },
   "required": [
    "observations",
    "redactedCount"
   ]
  }
 },
 "required": [
  "envelope",
  "result"
 ]
}
```
Valid example:
```json
{
 "schemaVersion": 1,
 "graphId": "7ba47581-fb4e-4ee3-a200-80fcb6d83fe6",
 "filter": {
  "correlationId": "01J8ZK5A0B1C2D3E4F5G6H7J8K",
  "kind": "exec.error"
 },
 "limit": 20
}
```
Rejected example:
```json
{
 "schemaVersion": 1,
 "graphId": "7ba47581-fb4e-4ee3-a200-80fcb6d83fe6",
 "limit": 5000
}
```
Why rejected: `limit` above 500 -> -32602; large ranges must page with `cursor`

### `proposal.validate`
- **Permissions:** graph:propose (proposer) or graph:approve
- **Idempotency:** idempotent; `rebase:true` rewrites the proposal (new digest)
- **Side effects:** proposal document updated; audit `proposal.validated`
- **Cancellation:** n/a
- **Mapping:** src/mcp/tools/proposal.ts -> proposals.validate()

Input schema (`$defs` omitted, see `schemas/mcp/defs.json`):
```json
{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "https://plastic-io.github.io/schemas/mcp/proposal.validate.input.json",
 "title": "proposal.validate.input",
 "type": "object",
 "additionalProperties": false,
 "properties": {
  "schemaVersion": {
   "const": 1
  },
  "proposalId": {
   "$ref": "#/$defs/ulid"
  },
  "rebase": {
   "type": "boolean",
   "default": false
  }
 },
 "required": [
  "schemaVersion",
  "proposalId"
 ]
}
```
Output schema (`structuredContent`):
```json
{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "https://plastic-io.github.io/schemas/mcp/proposal.validate.output.json",
 "title": "proposal.validate.output",
 "type": "object",
 "additionalProperties": false,
 "properties": {
  "envelope": {
   "$ref": "#/$defs/envelope"
  },
  "result": {
   "type": "object",
   "additionalProperties": false,
   "properties": {
    "proposalId": {
     "$ref": "#/$defs/ulid"
    },
    "proposalDigest": {
     "$ref": "#/$defs/digest"
    },
    "baseRevision": {
     "$ref": "#/$defs/revisionId"
    },
    "state": {
     "enum": [
      "validated",
      "awaiting-review",
      "stale",
      "rejected"
     ]
    },
    "validation": {
     "type": "object",
     "additionalProperties": false,
     "properties": {
      "ok": {
       "type": "boolean"
      },
      "errors": {
       "type": "array",
       "maxItems": 100,
       "items": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
         "code": {
          "type": "string"
         },
         "message": {
          "type": "string",
          "maxLength": 1000
         },
         "nodeId": {
          "$ref": "#/$defs/id"
         },
         "field": {
          "$ref": "#/$defs/id"
         }
        },
        "required": [
         "code",
         "message"
        ]
       }
      }
     },
     "required": [
      "ok"
     ]
    },
    "conflicts": {
     "type": "array",
     "maxItems": 100,
     "items": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
       "nodeId": {
        "$ref": "#/$defs/id"
       },
       "template": {
        "enum": [
         "set",
         "vue"
        ]
       },
       "ours": {
        "type": "string",
        "maxLength": 65536
       },
       "theirs": {
        "type": "string",
        "maxLength": 65536
       }
      },
      "required": [
       "nodeId",
       "template"
      ]
     }
    },
    "impact": {
     "$ref": "#/$defs/diffSummary"
    }
   },
   "required": [
    "proposalId",
    "proposalDigest",
    "baseRevision",
    "state",
    "validation"
   ]
  }
 },
 "required": [
  "envelope",
  "result"
 ]
}
```
Valid example:
```json
{
 "schemaVersion": 1,
 "proposalId": "01J8ZK6M0N1P2Q3R4S5T6V7W8X",
 "rebase": true
}
```
Rejected example:
```json
{
 "schemaVersion": 1,
 "proposalId": "p1"
}
```
Why rejected: `proposalId` is not a ULID -> -32602; handles are opaque server-minted ids

### `proposal.simulate` (task)
- **Permissions:** graph:simulate
- **Idempotency:** idempotent per (proposalDigest, mode, sample): cached result returned
- **Side effects:** sim-mode effects only (isolated prefixes, recorded responses); never aws:* apply
- **Cancellation:** tasks/cancel -> cooperative token
- **Mapping:** src/mcp/tools/proposal.ts -> simulation.run() (task)

Input schema (`$defs` omitted, see `schemas/mcp/defs.json`):
```json
{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "https://plastic-io.github.io/schemas/mcp/proposal.simulate.input.json",
 "title": "proposal.simulate.input",
 "type": "object",
 "additionalProperties": false,
 "properties": {
  "schemaVersion": {
   "const": 1
  },
  "proposalId": {
   "$ref": "#/$defs/ulid"
  },
  "mode": {
   "enum": [
    "structural",
    "shadow",
    "replay"
   ]
  },
  "executionSample": {
   "type": "object",
   "additionalProperties": false,
   "properties": {
    "sinceMinutes": {
     "type": "integer",
     "minimum": 1,
     "maximum": 1440
    },
    "max": {
     "type": "integer",
     "minimum": 1,
     "maximum": 50
    }
   }
  },
  "budget": {
   "$ref": "#/$defs/budget"
  }
 },
 "required": [
  "schemaVersion",
  "proposalId",
  "mode"
 ]
}
```
Output schema (`structuredContent`):
```json
{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "https://plastic-io.github.io/schemas/mcp/proposal.simulate.output.json",
 "title": "proposal.simulate.output",
 "type": "object",
 "additionalProperties": false,
 "properties": {
  "envelope": {
   "$ref": "#/$defs/envelope"
  },
  "result": {
   "type": "object",
   "additionalProperties": false,
   "properties": {
    "proposalId": {
     "$ref": "#/$defs/ulid"
    },
    "mode": {
     "enum": [
      "structural",
      "shadow",
      "replay"
     ]
    },
    "comparisons": {
     "type": "array",
     "maxItems": 500,
     "items": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
       "executionId": {
        "$ref": "#/$defs/ulid"
       },
       "port": {
        "$ref": "#/$defs/id"
       },
       "verdict": {
        "enum": [
         "equal",
         "schema-equal",
         "diff",
         "unavailable"
        ]
       },
       "detail": {
        "type": "string",
        "maxLength": 2000
       }
      },
      "required": [
       "executionId",
       "port",
       "verdict"
      ]
     }
    },
    "unsimulatedEffects": {
     "type": "array",
     "maxItems": 100,
     "items": {
      "$ref": "#/$defs/capabilityRequirement"
     }
    },
    "coverage": {
     "type": "object",
     "additionalProperties": false,
     "properties": {
      "executionsSampled": {
       "type": "integer"
      },
      "nodesExercised": {
       "type": "integer"
      },
      "nodesTotal": {
       "type": "integer"
      }
     },
     "required": [
      "executionsSampled",
      "nodesExercised",
      "nodesTotal"
     ]
    },
    "safe": {
     "type": "boolean"
    }
   },
   "required": [
    "proposalId",
    "mode",
    "comparisons",
    "unsimulatedEffects",
    "coverage",
    "safe"
   ]
  }
 },
 "required": [
  "envelope",
  "result"
 ]
}
```
Valid example:
```json
{
 "schemaVersion": 1,
 "proposalId": "01J8ZK6M0N1P2Q3R4S5T6V7W8X",
 "mode": "shadow",
 "executionSample": {
  "sinceMinutes": 60,
  "max": 10
 }
}
```
Rejected example:
```json
{
 "schemaVersion": 1,
 "proposalId": "01J8ZK6M0N1P2Q3R4S5T6V7W8X",
 "mode": "live"
}
```
Why rejected: `mode:'live'` is not allowed -> -32602; there is no way to request real effects from simulation

### `proposal.decide`
- **Permissions:** graph:approve (self-approval only if policy `selfApprove`)
- **Idempotency:** idempotent per (proposalId, digest, decision, principal)
- **Side effects:** proposal document; audit `proposal.decided`
- **Cancellation:** n/a
- **Mapping:** src/mcp/tools/proposal.ts -> proposals.decide()

Input schema (`$defs` omitted, see `schemas/mcp/defs.json`):
```json
{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "https://plastic-io.github.io/schemas/mcp/proposal.decide.input.json",
 "title": "proposal.decide.input",
 "type": "object",
 "additionalProperties": false,
 "properties": {
  "schemaVersion": {
   "const": 1
  },
  "proposalId": {
   "$ref": "#/$defs/ulid"
  },
  "decision": {
   "enum": [
    "approve",
    "reject"
   ]
  },
  "proposalDigest": {
   "$ref": "#/$defs/digest"
  },
  "rationale": {
   "type": "string",
   "maxLength": 2000
  }
 },
 "required": [
  "schemaVersion",
  "proposalId",
  "decision",
  "proposalDigest"
 ]
}
```
Output schema (`structuredContent`):
```json
{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "https://plastic-io.github.io/schemas/mcp/proposal.decide.output.json",
 "title": "proposal.decide.output",
 "type": "object",
 "additionalProperties": false,
 "properties": {
  "envelope": {
   "$ref": "#/$defs/envelope"
  },
  "result": {
   "type": "object",
   "additionalProperties": false,
   "properties": {
    "proposalId": {
     "$ref": "#/$defs/ulid"
    },
    "state": {
     "enum": [
      "approved",
      "rejected",
      "awaiting-review"
     ]
    },
    "decisions": {
     "type": "array",
     "maxItems": 16,
     "items": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
       "by": {
        "$ref": "#/$defs/principal"
       },
       "decision": {
        "enum": [
         "approve",
         "reject"
        ]
       },
       "digest": {
        "$ref": "#/$defs/digest"
       },
       "policyVersion": {
        "type": "string"
       },
       "at": {
        "type": "string",
        "format": "date-time"
       }
      },
      "required": [
       "by",
       "decision",
       "digest",
       "policyVersion",
       "at"
      ]
     }
    },
    "remainingDecisions": {
     "type": "array",
     "maxItems": 8,
     "items": {
      "enum": [
       "approve",
       "iac-approve",
       "privileged-connect"
      ]
     }
    }
   },
   "required": [
    "proposalId",
    "state",
    "decisions",
    "remainingDecisions"
   ]
  }
 },
 "required": [
  "envelope",
  "result"
 ]
}
```
Valid example:
```json
{
 "schemaVersion": 1,
 "proposalId": "01J8ZK6M0N1P2Q3R4S5T6V7W8X",
 "decision": "approve",
 "proposalDigest": "sha256:abababababababababababababababababababababababababababababababab",
 "rationale": "Diff limited to normalize; journey passes in shadow."
}
```
Rejected example:
```json
{
 "schemaVersion": 1,
 "proposalId": "01J8ZK6M0N1P2Q3R4S5T6V7W8X",
 "decision": "approve",
 "proposalDigest": "sha256:cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd"
}
```
Why rejected: digest does not match the stored proposal -> isError APPROVAL_REQUIRED with details.expectedDigest (approval binds to exact content); also ADMISSION_DENIED when the caller is the proposer without selfApprove

### `revision.rollback` (task)
- **Permissions:** graph:rollback (+iac:approve when scope includes infra)
- **Idempotency:** idempotent per (graphId,toRevision,scope)
- **Side effects:** new revision (definition), active pointer (activation), IaC plan/apply (infra); audit `revision.rolledBack`
- **Cancellation:** tasks/cancel stops compensators between steps; an IaC apply already started follows iac.cancel semantics
- **Mapping:** src/mcp/tools/revision.ts -> revisions.rollback() (task)

Input schema (`$defs` omitted, see `schemas/mcp/defs.json`):
```json
{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "https://plastic-io.github.io/schemas/mcp/revision.rollback.input.json",
 "title": "revision.rollback.input",
 "type": "object",
 "additionalProperties": false,
 "properties": {
  "schemaVersion": {
   "const": 1
  },
  "graphId": {
   "$ref": "#/$defs/id"
  },
  "toRevision": {
   "$ref": "#/$defs/revisionId"
  },
  "scope": {
   "type": "array",
   "minItems": 1,
   "maxItems": 3,
   "uniqueItems": true,
   "items": {
    "enum": [
     "definition",
     "activation",
     "infra"
    ]
   }
  },
  "compensation": {
   "enum": [
    "none",
    "run-compensators"
   ],
   "default": "none"
  },
  "rationale": {
   "type": "string",
   "maxLength": 2000
  }
 },
 "required": [
  "schemaVersion",
  "graphId",
  "toRevision",
  "scope"
 ]
}
```
Output schema (`structuredContent`):
```json
{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "https://plastic-io.github.io/schemas/mcp/revision.rollback.output.json",
 "title": "revision.rollback.output",
 "type": "object",
 "additionalProperties": false,
 "properties": {
  "envelope": {
   "$ref": "#/$defs/envelope"
  },
  "result": {
   "type": "object",
   "additionalProperties": false,
   "properties": {
    "graphId": {
     "$ref": "#/$defs/id"
    },
    "toRevision": {
     "$ref": "#/$defs/revisionId"
    },
    "newRevision": {
     "$ref": "#/$defs/revisionId"
    },
    "activeRevision": {
     "$ref": "#/$defs/revisionId"
    },
    "residualDrift": {
     "type": "array",
     "maxItems": 500,
     "items": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
       "kind": {
        "enum": [
         "storage:kv",
         "storage:s3",
         "aws:cfn",
         "external"
        ]
       },
       "scope": {
        "type": "string",
        "maxLength": 512
       },
       "detail": {
        "type": "string",
        "maxLength": 2000
       }
      },
      "required": [
       "kind",
       "scope"
      ]
     }
    },
    "irreversibleEffects": {
     "type": "array",
     "maxItems": 500,
     "items": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
       "executionId": {
        "$ref": "#/$defs/ulid"
       },
       "nodeId": {
        "$ref": "#/$defs/id"
       },
       "capability": {
        "enum": [
         "net:https",
         "storage:kv",
         "storage:s3",
         "secret",
         "timer",
         "browser:dom",
         "browser:storage",
         "aws:cfn",
         "aws:codebuild",
         "llm",
         "graph:invoke"
        ]
       },
       "at": {
        "type": "string",
        "format": "date-time"
       }
      },
      "required": [
       "executionId",
       "nodeId",
       "capability",
       "at"
      ]
     }
    },
    "compensatorsRun": {
     "type": "array",
     "maxItems": 100,
     "items": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
       "componentId": {
        "$ref": "#/$defs/id"
       },
       "result": {
        "enum": [
         "ok",
         "failed",
         "skipped"
        ]
       }
      },
      "required": [
       "componentId",
       "result"
      ]
     }
    },
    "manualReview": {
     "type": "boolean"
    }
   },
   "required": [
    "graphId",
    "toRevision",
    "residualDrift",
    "irreversibleEffects",
    "manualReview"
   ]
  }
 },
 "required": [
  "envelope",
  "result"
 ]
}
```
Valid example:
```json
{
 "schemaVersion": 1,
 "graphId": "7ba47581-fb4e-4ee3-a200-80fcb6d83fe6",
 "toRevision": "rev_01J8ZK3Q4W5X6Y7Z8A9B0C1D2E",
 "scope": [
  "definition",
  "activation"
 ],
 "compensation": "none",
 "rationale": "rev6 regressed journey rate-limit-basic"
}
```
Rejected example:
```json
{
 "schemaVersion": 1,
 "graphId": "7ba47581-fb4e-4ee3-a200-80fcb6d83fe6",
 "toRevision": "rev_01J8ZK3Q4W5X6Y7Z8A9B0C1D2E",
 "scope": []
}
```
Why rejected: empty `scope` -> -32602; a rollback must name the layers it touches so partial rollback is explicit

### `component.publish`
- **Permissions:** component:publish
- **Idempotency:** idempotent when the same content is republished at the same version (same digest -> same result); different content -> CONFLICT
- **Side effects:** immutable objects components/<id>/<version>/{artifact,manifest}.json, TOC entry; audit `component.published`
- **Cancellation:** n/a
- **Mapping:** src/mcp/tools/component.ts -> components.publish() (replaces eventSourceService.ts:376-538 paths)

Input schema (`$defs` omitted, see `schemas/mcp/defs.json`):
```json
{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "https://plastic-io.github.io/schemas/mcp/component.publish.input.json",
 "title": "component.publish.input",
 "type": "object",
 "additionalProperties": false,
 "properties": {
  "schemaVersion": {
   "const": 1
  },
  "graphId": {
   "$ref": "#/$defs/id"
  },
  "revisionId": {
   "$ref": "#/$defs/revisionId"
  },
  "target": {
   "oneOf": [
    {
     "type": "object",
     "additionalProperties": false,
     "properties": {
      "nodeId": {
       "$ref": "#/$defs/id"
      }
     },
     "required": [
      "nodeId"
     ]
    },
    {
     "type": "object",
     "additionalProperties": false,
     "properties": {
      "graph": {
       "const": true
      }
     },
     "required": [
      "graph"
     ]
    }
   ]
  },
  "version": {
   "oneOf": [
    {
     "const": "next"
    },
    {
     "type": "integer",
     "minimum": 0
    }
   ]
  },
  "contract": {
   "type": "object",
   "additionalProperties": false,
   "properties": {
    "inputs": {
     "type": "array",
     "maxItems": 64,
     "items": {
      "$ref": "#/$defs/portContract"
     }
    },
    "outputs": {
     "type": "array",
     "maxItems": 64,
     "items": {
      "$ref": "#/$defs/portContract"
     }
    },
    "errors": {
     "type": "object"
    }
   },
   "required": [
    "inputs",
    "outputs"
   ]
  },
  "summary": {
   "type": "object",
   "additionalProperties": false,
   "properties": {
    "intent": {
     "type": "string",
     "minLength": 1,
     "maxLength": 2000
    },
    "invariants": {
     "type": "array",
     "maxItems": 32,
     "items": {
      "type": "string",
      "maxLength": 500
     }
    }
   },
   "required": [
    "intent"
   ]
  },
  "tests": {
   "type": "array",
   "maxItems": 64,
   "items": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
     "kind": {
      "enum": [
       "contract",
       "invariant",
       "property",
       "fixture"
      ]
     },
     "id": {
      "$ref": "#/$defs/id"
     },
     "artifactRef": {
      "$ref": "#/$defs/artifactRef"
     }
    },
    "required": [
     "kind",
     "id",
     "artifactRef"
    ]
   }
  },
  "capabilities": {
   "type": "array",
   "maxItems": 32,
   "items": {
    "$ref": "#/$defs/capabilityRequirement"
   }
  },
  "placement": {
   "$ref": "#/$defs/placement"
  },
  "budgets": {
   "$ref": "#/$defs/budget"
  }
 },
 "required": [
  "schemaVersion",
  "graphId",
  "revisionId",
  "target",
  "version",
  "contract",
  "summary",
  "capabilities",
  "placement"
 ]
}
```
Output schema (`structuredContent`):
```json
{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "https://plastic-io.github.io/schemas/mcp/component.publish.output.json",
 "title": "component.publish.output",
 "type": "object",
 "additionalProperties": false,
 "properties": {
  "envelope": {
   "$ref": "#/$defs/envelope"
  },
  "result": {
   "type": "object",
   "additionalProperties": false,
   "properties": {
    "publishedId": {
     "$ref": "#/$defs/id"
    },
    "version": {
     "type": "integer"
    },
    "digest": {
     "$ref": "#/$defs/digest"
    },
    "manifestUri": {
     "type": "string"
    },
    "consumersAffected": {
     "type": "integer"
    },
    "warnings": {
     "type": "array",
     "maxItems": 50,
     "items": {
      "type": "string",
      "maxLength": 500
     }
    }
   },
   "required": [
    "publishedId",
    "version",
    "digest",
    "manifestUri",
    "consumersAffected"
   ]
  }
 },
 "required": [
  "envelope",
  "result"
 ]
}
```
Valid example:
```json
{
 "schemaVersion": 1,
 "graphId": "rl-graph",
 "revisionId": "rev_01J8ZK3Q4W5X6Y7Z8A9B0C1D2E",
 "target": {
  "graph": true
 },
 "version": "next",
 "contract": {
  "inputs": [
   {
    "name": "key",
    "schema": {
     "type": "string",
     "maxLength": 256
    },
    "required": true
   },
   {
    "name": "cost",
    "schema": {
     "type": "integer",
     "minimum": 1
    },
    "required": false,
    "default": 1
   }
  ],
  "outputs": [
   {
    "name": "allowed",
    "schema": {
     "type": "boolean"
    },
    "required": true
   },
   {
    "name": "retryAfterMs",
    "schema": {
     "type": "integer",
     "minimum": 0
    },
    "required": false
   }
  ]
 },
 "summary": {
  "intent": "Sliding-window rate limiter keyed by caller",
  "invariants": [
   "allowed === false implies retryAfterMs > 0"
  ]
 },
 "capabilities": [
  {
   "kind": "storage:kv",
   "scope": [
    "ratelimit/*"
   ]
  }
 ],
 "placement": "server"
}
```
Rejected example:
```json
{
 "schemaVersion": 1,
 "graphId": "rl-graph",
 "revisionId": "rev_01J8ZK3Q4W5X6Y7Z8A9B0C1D2E",
 "target": {
  "graph": true
 },
 "version": 1,
 "contract": {
  "inputs": [],
  "outputs": []
 },
 "summary": {
  "intent": "x"
 },
 "capabilities": [
  {
   "kind": "storage:kv",
   "scope": [
    "ratelimit/*"
   ]
  }
 ],
 "placement": "server"
}
```
Why rejected: schema-valid but rejected at the publication gate: version 1 already exists with a different digest -> isError CONFLICT; and the contract declares no ports while the source graph has external IO -> SCHEMA_INVALID details.contractMismatch

### `tests.run` (task)
- **Permissions:** graph:test
- **Idempotency:** results cached per (componentDigest|revisionId|proposalDigest, testDigest, runtimeVersion)
- **Side effects:** sim-mode effects only; test results stored; audit `tests.run`
- **Cancellation:** tasks/cancel -> token
- **Mapping:** src/mcp/tools/tests.ts -> testRunner.run() (task)

Input schema (`$defs` omitted, see `schemas/mcp/defs.json`):
```json
{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "https://plastic-io.github.io/schemas/mcp/tests.run.input.json",
 "title": "tests.run.input",
 "type": "object",
 "additionalProperties": false,
 "properties": {
  "schemaVersion": {
   "const": 1
  },
  "target": {
   "oneOf": [
    {
     "type": "object",
     "additionalProperties": false,
     "properties": {
      "componentId": {
       "$ref": "#/$defs/id"
      },
      "version": {
       "type": "integer",
       "minimum": 0
      }
     },
     "required": [
      "componentId",
      "version"
     ]
    },
    {
     "type": "object",
     "additionalProperties": false,
     "properties": {
      "graphId": {
       "$ref": "#/$defs/id"
      },
      "revisionId": {
       "$ref": "#/$defs/revisionId"
      }
     },
     "required": [
      "graphId",
      "revisionId"
     ]
    },
    {
     "type": "object",
     "additionalProperties": false,
     "properties": {
      "proposalId": {
       "$ref": "#/$defs/ulid"
      }
     },
     "required": [
      "proposalId"
     ]
    }
   ]
  },
  "selection": {
   "type": "array",
   "maxItems": 64,
   "items": {
    "type": "string",
    "pattern": "^(contract|invariant|property|fixture|journey:[A-Za-z0-9_.-]{1,64})$",
    "maxLength": 80
   }
  },
  "mode": {
   "enum": [
    "contract-stub",
    "integrated"
   ],
   "default": "integrated"
  },
  "budget": {
   "$ref": "#/$defs/budget"
  }
 },
 "required": [
  "schemaVersion",
  "target"
 ]
}
```
Output schema (`structuredContent`):
```json
{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "https://plastic-io.github.io/schemas/mcp/tests.run.output.json",
 "title": "tests.run.output",
 "type": "object",
 "additionalProperties": false,
 "properties": {
  "envelope": {
   "$ref": "#/$defs/envelope"
  },
  "result": {
   "type": "object",
   "additionalProperties": false,
   "properties": {
    "results": {
     "type": "array",
     "maxItems": 500,
     "items": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
       "testId": {
        "type": "string",
        "maxLength": 128
       },
       "kind": {
        "type": "string"
       },
       "status": {
        "enum": [
         "pass",
         "fail",
         "error",
         "skipped",
         "unresolvable"
        ]
       },
       "durationMs": {
        "type": "integer"
       },
       "message": {
        "type": "string",
        "maxLength": 4000
       },
       "observationsUri": {
        "type": "string"
       },
       "seed": {
        "type": "string"
       }
      },
      "required": [
       "testId",
       "kind",
       "status",
       "durationMs"
      ]
     }
    },
    "revisionBound": {
     "type": "object",
     "additionalProperties": false,
     "properties": {
      "componentDigest": {
       "$ref": "#/$defs/digest"
      },
      "revisionId": {
       "$ref": "#/$defs/revisionId"
      },
      "runtime": {
       "type": "string"
      }
     }
    },
    "coverage": {
     "type": "object",
     "additionalProperties": false,
     "properties": {
      "nodesExercised": {
       "type": "integer"
      },
      "nodesTotal": {
       "type": "integer"
      },
      "portsValidated": {
       "type": "integer"
      }
     },
     "required": [
      "nodesExercised",
      "nodesTotal"
     ]
    },
    "summary": {
     "type": "object",
     "additionalProperties": false,
     "properties": {
      "pass": {
       "type": "integer"
      },
      "fail": {
       "type": "integer"
      },
      "error": {
       "type": "integer"
      },
      "skipped": {
       "type": "integer"
      }
     },
     "required": [
      "pass",
      "fail",
      "error",
      "skipped"
     ]
    }
   },
   "required": [
    "results",
    "coverage",
    "summary"
   ]
  }
 },
 "required": [
  "envelope",
  "result"
 ]
}
```
Valid example:
```json
{
 "schemaVersion": 1,
 "target": {
  "proposalId": "01J8ZK6M0N1P2Q3R4S5T6V7W8X"
 },
 "selection": [
  "journey:account-settings-change"
 ]
}
```
Rejected example:
```json
{
 "schemaVersion": 1,
 "target": {
  "proposalId": "01J8ZK6M0N1P2Q3R4S5T6V7W8X"
 },
 "selection": [
  "journey:*"
 ]
}
```
Why rejected: selection pattern rejects wildcards -> -32602; journeys are named so that a run is revision-bound and reproducible

### `iac.plan` (task)
- **Permissions:** iac:propose
- **Idempotency:** idempotent per idempotencyKey (same change set reused while it exists)
- **Side effects:** CreateChangeSet in AWS (no execution); status document `planning`; audit `iac.plan`
- **Cancellation:** tasks/cancel deletes the change set
- **Mapping:** src/mcp/tools/iac.ts -> iacService.plan() (task -> Step Functions)

Input schema (`$defs` omitted, see `schemas/mcp/defs.json`):
```json
{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "https://plastic-io.github.io/schemas/mcp/iac.plan.input.json",
 "title": "iac.plan.input",
 "type": "object",
 "additionalProperties": false,
 "properties": {
  "schemaVersion": {
   "const": 1
  },
  "graphId": {
   "$ref": "#/$defs/id"
  },
  "instanceId": {
   "$ref": "#/$defs/id"
  },
  "desired": {
   "$ref": "#/$defs/iacDesiredState"
  },
  "idempotencyKey": {
   "$ref": "#/$defs/ulid"
  }
 },
 "required": [
  "schemaVersion",
  "graphId",
  "instanceId"
 ]
}
```
Output schema (`structuredContent`):
```json
{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "https://plastic-io.github.io/schemas/mcp/iac.plan.output.json",
 "title": "iac.plan.output",
 "type": "object",
 "additionalProperties": false,
 "properties": {
  "envelope": {
   "$ref": "#/$defs/envelope"
  },
  "result": {
   "type": "object",
   "additionalProperties": false,
   "properties": {
    "planRef": {
     "type": "string",
     "maxLength": 256
    },
    "changeSetId": {
     "type": "string",
     "maxLength": 512
    },
    "desiredRevision": {
     "$ref": "#/$defs/revisionId"
    },
    "validation": {
     "type": "object",
     "additionalProperties": false,
     "properties": {
      "ok": {
       "type": "boolean"
      },
      "errors": {
       "type": "array",
       "maxItems": 100,
       "items": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
         "code": {
          "type": "string"
         },
         "message": {
          "type": "string",
          "maxLength": 2000
         },
         "path": {
          "type": "string",
          "maxLength": 512
         }
        },
        "required": [
         "code",
         "message"
        ]
       }
      }
     },
     "required": [
      "ok"
     ]
    },
    "changes": {
     "type": "array",
     "maxItems": 1000,
     "items": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
       "logicalId": {
        "type": "string"
       },
       "type": {
        "type": "string"
       },
       "action": {
        "enum": [
         "Add",
         "Modify",
         "Remove",
         "Import",
         "Dynamic"
        ]
       },
       "replacement": {
        "enum": [
         "True",
         "False",
         "Conditional"
        ]
       },
       "scope": {
        "type": "array",
        "maxItems": 8,
        "items": {
         "type": "string"
        }
       }
      },
      "required": [
       "logicalId",
       "type",
       "action"
      ]
     }
    },
    "destructive": {
     "type": "boolean"
    },
    "requiresApproval": {
     "type": "boolean"
    },
    "estimatedCostDelta": {
     "type": "number"
    }
   },
   "required": [
    "planRef",
    "desiredRevision",
    "validation",
    "changes",
    "destructive",
    "requiresApproval"
   ]
  }
 },
 "required": [
  "envelope",
  "result"
 ]
}
```
Valid example:
```json
{
 "schemaVersion": 1,
 "graphId": "infra",
 "instanceId": "stack-api",
 "idempotencyKey": "01J8ZK7Q0R1S2T3V4W5X6Y7Z8A"
}
```
Rejected example:
```json
{
 "schemaVersion": 1,
 "graphId": "infra",
 "instanceId": "stack-api",
 "desired": {
  "schemaVersion": 1,
  "stack": {
   "name": "prod-core",
   "account": "695527765921",
   "region": "us-west-1",
   "environment": "dev"
  },
  "template": {
   "artifactRef": {
    "graphId": "infra",
    "nodeId": "tpl",
    "revisionId": "rev_01J8ZK3Q4W5X6Y7Z8A9B0C1D2E",
    "sha256": "0000000000000000000000000000000000000000000000000000000000000000"
   },
   "format": "yaml"
  },
  "parameters": {},
  "capabilities": [
   "CAPABILITY_NAMED_IAM"
  ],
  "operation": "apply",
  "trigger": {
   "kind": "explicit"
  },
  "correlation": {
   "idempotencyKey": "01J8ZK7Q0R1S2T3V4W5X6Y7Z8A"
  }
 }
}
```
Why rejected: schema-valid but rejected by the validator: stack name `prod-core` does not start with the dev environment's allowed prefix `pio-dev-` -> isError SCHEMA_INVALID details.path=stack.name; `operation:'apply'` on a plan call is ignored (plan never executes)

### `iac.cancel`
- **Permissions:** iac:propose (own operation) or iac:approve
- **Idempotency:** idempotent
- **Side effects:** may call DeleteChangeSet/StopBuild/CancelUpdateStack; audit `iac.cancelRequested`
- **Cancellation:** n/a
- **Mapping:** src/mcp/tools/iac.ts -> iacService.cancel()

Input schema (`$defs` omitted, see `schemas/mcp/defs.json`):
```json
{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "https://plastic-io.github.io/schemas/mcp/iac.cancel.input.json",
 "title": "iac.cancel.input",
 "type": "object",
 "additionalProperties": false,
 "properties": {
  "schemaVersion": {
   "const": 1
  },
  "graphId": {
   "$ref": "#/$defs/id"
  },
  "instanceId": {
   "$ref": "#/$defs/id"
  },
  "operationId": {
   "$ref": "#/$defs/ulid"
  },
  "reason": {
   "type": "string",
   "maxLength": 1000
  }
 },
 "required": [
  "schemaVersion",
  "graphId",
  "instanceId",
  "operationId"
 ]
}
```
Output schema (`structuredContent`):
```json
{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "https://plastic-io.github.io/schemas/mcp/iac.cancel.output.json",
 "title": "iac.cancel.output",
 "type": "object",
 "additionalProperties": false,
 "properties": {
  "envelope": {
   "$ref": "#/$defs/envelope"
  },
  "result": {
   "type": "object",
   "additionalProperties": false,
   "properties": {
    "operationId": {
     "$ref": "#/$defs/ulid"
    },
    "accepted": {
     "type": "boolean"
    },
    "phase": {
     "enum": [
      "planning",
      "awaiting-review",
      "building",
      "executing",
      "observing",
      "terminal"
     ]
    },
    "awsAction": {
     "enum": [
      "DeleteChangeSet",
      "StopBuild",
      "CancelUpdateStack",
      "none"
     ]
    },
    "note": {
     "type": "string",
     "maxLength": 500
    }
   },
   "required": [
    "operationId",
    "accepted",
    "phase",
    "awsAction",
    "note"
   ]
  }
 },
 "required": [
  "envelope",
  "result"
 ]
}
```
Valid example:
```json
{
 "schemaVersion": 1,
 "graphId": "infra",
 "instanceId": "stack-api",
 "operationId": "01J8ZK8A0B1C2D3E4F5G6H7J8K",
 "reason": "wrong parameter value"
}
```
Rejected example:
```json
{
 "schemaVersion": 1,
 "graphId": "infra",
 "instanceId": "stack-api",
 "operationId": "01J8ZK8A0B1C2D3E4F5G6H7J8K",
 "force": true
}
```
Why rejected: `force` is not a field -> -32602; there is no forced stop: the response `note` always states that AWS may still complete the operation

### `iac.status`
- **Permissions:** iac:read-status
- **Idempotency:** idempotent read
- **Side effects:** none
- **Cancellation:** n/a
- **Mapping:** src/mcp/tools/iac.ts -> statusStore.read()

Input schema (`$defs` omitted, see `schemas/mcp/defs.json`):
```json
{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "https://plastic-io.github.io/schemas/mcp/iac.status.input.json",
 "title": "iac.status.input",
 "type": "object",
 "additionalProperties": false,
 "properties": {
  "schemaVersion": {
   "const": 1
  },
  "graphId": {
   "$ref": "#/$defs/id"
  },
  "instanceId": {
   "$ref": "#/$defs/id"
  }
 },
 "required": [
  "schemaVersion",
  "graphId",
  "instanceId"
 ]
}
```
Output schema (`structuredContent`):
```json
{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "https://plastic-io.github.io/schemas/mcp/iac.status.output.json",
 "title": "iac.status.output",
 "type": "object",
 "additionalProperties": false,
 "properties": {
  "envelope": {
   "$ref": "#/$defs/envelope"
  },
  "result": {
   "type": "object",
   "additionalProperties": false,
   "properties": {
    "instanceId": {
     "$ref": "#/$defs/id"
    },
    "stack": {
     "type": "object",
     "additionalProperties": false,
     "properties": {
      "name": {
       "type": "string"
      },
      "account": {
       "type": "string"
      },
      "region": {
       "type": "string"
      },
      "environment": {
       "enum": [
        "dev",
        "staging",
        "prod"
       ]
      }
     },
     "required": [
      "name",
      "account",
      "region",
      "environment"
     ]
    },
    "requestedRevision": {
     "$ref": "#/$defs/revisionId"
    },
    "effectiveRevision": {
     "$ref": "#/$defs/revisionId"
    },
    "lifecycle": {
     "enum": [
      "idle",
      "requested",
      "validating",
      "planning",
      "awaiting-review",
      "building",
      "executing",
      "observing",
      "succeeded",
      "failed",
      "rolled-back",
      "rollback-failed",
      "cancelled",
      "superseded"
     ]
    },
    "operation": {
     "type": "object",
     "additionalProperties": false,
     "properties": {
      "operationId": {
       "$ref": "#/$defs/ulid"
      },
      "startedAt": {
       "type": "string",
       "format": "date-time"
      },
      "stackStatus": {
       "type": "string"
      },
      "buildStatus": {
       "type": "string"
      },
      "stale": {
       "type": "boolean"
      }
     }
    },
    "outputs": {
     "type": "object",
     "additionalProperties": {
      "type": "string"
     }
    },
    "drift": {
     "type": "object",
     "additionalProperties": false,
     "properties": {
      "status": {
       "enum": [
        "IN_SYNC",
        "DRIFTED",
        "UNKNOWN"
       ]
      },
      "resources": {
       "type": "array",
       "maxItems": 500,
       "items": {
        "type": "string"
       }
      }
     }
    },
    "manualRecoveryRequired": {
     "type": "boolean"
    },
    "lock": {
     "type": "object",
     "additionalProperties": false,
     "properties": {
      "held": {
       "type": "boolean"
      },
      "until": {
       "type": "string",
       "format": "date-time"
      }
     }
    },
    "queued": {
     "type": "array",
     "maxItems": 20,
     "items": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
       "desiredRevision": {
        "$ref": "#/$defs/revisionId"
       },
       "state": {
        "enum": [
         "superseded-pending",
         "superseded"
        ]
       }
      },
      "required": [
       "desiredRevision",
       "state"
      ]
     }
    }
   },
   "required": [
    "instanceId",
    "stack",
    "lifecycle",
    "manualRecoveryRequired"
   ]
  }
 },
 "required": [
  "envelope",
  "result"
 ]
}
```
Valid example:
```json
{
 "schemaVersion": 1,
 "graphId": "infra",
 "instanceId": "stack-api"
}
```
Rejected example:
```json
{
 "schemaVersion": 1,
 "graphId": "infra",
 "instanceId": "stack-api",
 "includeLogs": true
}
```
Why rejected: `includeLogs` is not a field -> -32602; logs are exposed only as `logRef` references, never bodies

### `execution.cancel`
- **Permissions:** graph:execute on the execution's graph
- **Idempotency:** idempotent
- **Side effects:** cancellation token set; watchdog escalation; audit `execution.cancelled`
- **Cancellation:** n/a
- **Mapping:** src/mcp/tools/execution.ts -> executions.cancel() (ExecutionHandle.cancel)

Input schema (`$defs` omitted, see `schemas/mcp/defs.json`):
```json
{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "https://plastic-io.github.io/schemas/mcp/execution.cancel.input.json",
 "title": "execution.cancel.input",
 "type": "object",
 "additionalProperties": false,
 "properties": {
  "schemaVersion": {
   "const": 1
  },
  "executionId": {
   "$ref": "#/$defs/ulid"
  },
  "reason": {
   "type": "string",
   "maxLength": 1000
  }
 },
 "required": [
  "schemaVersion",
  "executionId"
 ]
}
```
Output schema (`structuredContent`):
```json
{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "$id": "https://plastic-io.github.io/schemas/mcp/execution.cancel.output.json",
 "title": "execution.cancel.output",
 "type": "object",
 "additionalProperties": false,
 "properties": {
  "envelope": {
   "$ref": "#/$defs/envelope"
  },
  "result": {
   "type": "object",
   "additionalProperties": false,
   "properties": {
    "executionId": {
     "$ref": "#/$defs/ulid"
    },
    "state": {
     "enum": [
      "cancelling",
      "cancelled",
      "completed",
      "failed",
      "abandoned"
     ]
    },
    "cooperativeStopMs": {
     "type": "integer"
    },
    "terminated": {
     "type": "boolean"
    }
   },
   "required": [
    "executionId",
    "state",
    "terminated"
   ]
  }
 },
 "required": [
  "envelope",
  "result"
 ]
}
```
Valid example:
```json
{
 "schemaVersion": 1,
 "executionId": "01J8ZK9B0C1D2E3F4G5H6J7K8M",
 "reason": "runaway fan-out"
}
```
Rejected example:
```json
{
 "schemaVersion": 1,
 "executionId": "01J8ZK9B0C1D2E3F4G5H6J7K8M",
 "kill": true
}
```
Why rejected: `kill` is not a field -> -32602; escalation from cooperative to out-of-band termination is automatic and reported in `terminated`
