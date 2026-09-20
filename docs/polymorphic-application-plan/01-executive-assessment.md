# 1. Executive engineering assessment

Status labels used throughout this plan: **[FACT]** verified current behaviour (cited to path:lines in the appendices' evidence ledgers, IDs `GE-nn` editor, `GS-nn` server, `RT-nn` runtimes); **[REQ]** target requirement from the brief; **[PROPOSED]** change proposed by this plan; **[OPEN]** decision that needs information or policy not available here.

Inspected revisions: graph-editor `93d69d7d43c924d400f2aaec4b8831d411fd3497` (main), graph-server `687022195e9b34ac586ac2421557253812530a04` (master), plastic-io `c9e19bec88f97e291cb1b3e9f308c564a60dba59` (master, = npm 2.0.3), plastic-io-rust `4fee99f897a87e287ad8ada8b3060ac1e32ad70e` (main). Inspection covered public code plus the two local checkouts and the committed Serverless deployment output; no AWS API was called.

## 1.1 Feasibility verdict

The vision is implementable as an **extension** of what exists, not a rewrite, with one exception (server-side runtime containment, which has to be added rather than extended). The reasons:

1. The graph *is* already the authoritative application representation. Both runtimes and the editor consume one document model (`Graph → Node → Edge → Connector`, RT-01), the editor has no second model (GE-07, it imports the scheduler's interfaces), and the collaborative document layout mirrors it one-to-one (GE-07, `packages/GraphCrdt/codec.ts`). A published component is already a versioned artifact (`artifacts/{id}.{version}`, GE-49/GS-26) and a node already embeds a nested graph (`linkedGraph`, GE-46). Recursion, hyperedges (an `Edge` with several `Connector`s, RT-06), typed ports (`{name,type,external}`) and a per-edge observability stream (`beginconnector/endconnector/set/afterSet/error`, RT-09) exist. These stay.
2. The server already has exactly one write path that everything funnels through (`CrdtService.handleMessage`/`postUpdate` → `CrdtStore.appendUpdate` → fan-out → checkpoint, GS-13..GS-20). Turning that into an *admission* service is an insertion, not a redesign.
3. The editor's mutation pipeline already converges every user gesture into one commit gateway (`updateGraphFromSnapshot`, GE-16) that produces a labelled Yjs transaction. Agent proposals can be materialised by the same `reconcile()` function on the server, so humans and agents produce identical mutation records (see §4.4).

The parts that do not exist at all and must be built: identity and authorization (none anywhere, GE-33/34, GS-01/05), effect capabilities (node code has full host authority in both domains, GE-40/42, GS-29, RT-15), runtime containment and budgets (none in any runtime, RT-14/34), immutable revisions and activation (execution today follows the live checkpoint, GS-27), persisted observations (events are fire-and-forget over WebSocket, GS-30), the MCP surface, IaC orchestration, and intent-based synthetic testing.

## 1.2 Central architecture (target)

```
                       ┌──────────────────────── authoritative graph state ────────────────────────┐
 Human (Graph Editor)  │  per-graph Y.Doc (V2 update log in S3)  +  Revision manifests (immutable)  │
 ──Yjs update+intent──►│                                                                            │
                       │   ADMISSION SERVICE (graph-server, one logical choke point, stateless      │
 Agent (MCP / chat)    │   Lambdas over S3 with conditional writes):                                │
 ──semantic ops──────► │   authenticate → resolve principal/tenant/delegation → materialise the     │
                       │   candidate update on a STAGING doc → semantic diff → policy/capability    │
 Automation / IaC      │   check → CAS-commit → fan-out → audit → (optional) revision cut           │
 ──typed desired state►│                                                                            │
                       └──────────────┬───────────────────────────────┬───────────────────────────┘
                                      │ activation pointer            │ observations / audit (S3 + WS + MCP)
                      ┌───────────────▼───────────────┐   ┌───────────▼───────────────────────────┐
                      │ Server runtime (TS scheduler in │   │ Browser runtime (TS scheduler in Web   │
                      │ isolated-vm sandbox, budgets,   │◄─►│ Worker; capability host; UI nodes;     │
                      │ capability host; owns effects)  │   │ observes server work; presentation)    │
                      └───────────────┬───────────────┘   └───────────────────────────────────────┘
                                      │ privileged builtin component
                      ┌───────────────▼───────────────┐
                      │ IaC orchestrator (Step Functions │──► CloudFormation / CodeBuild (scoped roles)
                      │ + EventBridge feedback)          │
                      └───────────────────────────────┘
```

## 1.3 What can remain unchanged (and why)

| Area | Keep as is | Why adequate |
|---|---|---|
| Graph model | `Graph/Node/Edge/Connector/LinkedGraph/LinkedNode` interfaces (`plastic-io/src/Shared.ts`, `Node.ts`, `Edge.ts`) | Shared by every consumer; new metadata fits in `node.properties` (untyped today, GE-07) and in new sibling keys without breaking either runtime's parser (TS is lenient; Rust is strict and needs schema work anyway, RT-21). |
| Yjs layout and codec | `packages/GraphCrdt/{schema,codec,reconcile,updates,text,protocol}.ts` | Field-granular, tested (61 tests, GE-58), V2-stamped, and `reconcile()` is exactly the primitive the admission service needs to turn semantic operations into updates. |
| Editor mutation pipeline | `mutation.ts` actions → `updateGraphFromSnapshot` → `GraphCrdtSession.commit` | One gateway, labelled transactions, bounded undo (GE-16..19). Only the transport needs acks. |
| Server storage layout | `graphs/<id>/crdt/v2/{updates,snapshots}`, ULID keys, 60 s safety window, TOC document | Append-only and order-independent (GS-17/18/21); revisions and audit are added as new prefixes. |
| Scheduler event vocabulary | `begin, beginedge, endedge, set, afterSet, beginconnector, endconnector, error, warning, load, end` | Already an edge-level trace; the observation envelope wraps it (§4.5). |
| WebSocket fan-out and chunking | `broadcastService.ts` channel model | Works; needs authorization on `subscribe` and removal of `sendToChannel/sendToConnection` client routes. |
| Dev server and test doubles | `devServer.ts`, `FakeS3Service`, vitest suites | Reusable for admission and revision tests. |

## 1.4 Essential extensions (release blockers)

1. **Identity + tenancy + ACL** on both APIs (Auth0 JWT; WS `$connect` authorizer; per-graph ACL documents outside the Y.Doc). [PROPOSED §4.4]
2. **Staged admission** of Yjs updates and of agent semantic operations with a semantic diff, size/schema/capability checks, CAS commit, ack/reject to the sender, and client-side reject recovery. [PROPOSED §4.4]
3. **Revisions and activation** separate from live editing; executors load the *active revision*, never the live checkpoint. [PROPOSED §4.7]
4. **Capability host** replacing ambient authority in node code and Vue templates (server `require`/`AWS`/`openai`; browser stores/`transact`/`OpenAI`/scripts). [PROPOSED §4.5]
5. **Server containment**: `isolated-vm` (V8 isolate per execution with memory limit, CPU/wall timeout, out-of-band termination) wrapping the TS scheduler; hop/fan-out/observation budgets inside the scheduler. [PROPOSED §4.6, spike S-1]
6. **Persisted observations + audit** with correlation ids, redaction and retention. [PROPOSED §4.5]
7. **MCP server** (2026-07-28 revision, Tasks extension) as a client of the same admission and read services. [PROPOSED §5]
8. **Editor visibility** of proposals, sync state, agent activity, activation and deployment state. [PROPOSED §8.3]

## 1.5 Critical contradictions found

| # | Contradiction | Evidence | Impact on the vision |
|---|---|---|---|
| C1 | "Edges are the bindings" vs reality: node code has the host's `require`, the full `aws-sdk` with the Lambda role, the OpenAI key, `fetch`; browser node components get every Pinia store and a graph mutator. | GS-29, GE-40, GE-42, RT-15 | Capabilities cannot be *observed* today because effects never touch an edge; must be re-plumbed before any agent is allowed to author code. |
| C2 | Anonymous, CORS-open write and execute surface: anyone can poison any graph's document (verified locally: one garbage frame makes `GET /crdt/{id}/state` 500 permanently), publish, delete, execute node code with the Lambda role. | GS-13, GS-05/06, F.6 of A2 | Nothing about the current system can be exposed to agents or the public until admission exists. |
| C3 | Execution follows the live document: server runs whatever the ≤10 s checkpoint projected; editor pushes the debounced snapshot to its worker. No immutable revision exists. | GS-20/27, GE-36 | "Revision-bound execution", approvals, replay and rollback have nothing to bind to. |
| C4 | Two schedulers, two semantics: server runs 2.0.1 (awaits set functions, serialises fan-out), editor runs 2.0.3 (fire-and-forget); completion (`end`) precedes async work in 2.0.3. | RT-19/20, A3 §C.3 | "Done" is undefined for async graphs; the same component behaves differently in browser and server. |
| C5 | The Rust runtime is a disconnected prototype: not referenced by any consumer, cannot parse editor documents, fan-out routes every assignment to the last connector, no termination/heap limits, `process::exit` on bad url, V8 9.6 from 2021. | RT-21/26/33/34/40 | It is not the server engine today; making it one is a separate, optional workstream, not a dependency of the first releases. |
| C6 | Publication is not immutable and node publication is unreachable in the UI; `graph.version` is a LWW counter reused as the artifact key. | GS-26, GE-50/51 | Component identity must gain a content digest before agents depend on it. |
| C7 | Linked graphs cannot load on the server (relative `fetch`), so recursive components only work in the browser (which pre-flattens them). | GS-31, GE-47 | Recursive components on the server need the loader fixed or the same pre-flattening. |
| C8 | Panic/cancel cannot stop running code anywhere (server panic never reaches the executor; editor panic only trips the next edge). | GS-12, RT-42 | Budgets and termination must be built, not tuned. |

## 1.6 Smallest useful first release (M2, see §9)

An authenticated, tenant-scoped graph server whose only write path is the admission service; a Graph Editor that shows pending/accepted/rejected state and recovers from rejection; an MCP server exposing `graph.summary`, `graph.expand`, `observations.query`, `proposal.create`, `proposal.validate` and the read resources; an editor **Proposal panel** that shows an agent's proposal as a semantic diff with affected edges highlighted and lets a human commit it through the same admission path. No agent commit, no activation, no IaC, no containment beyond a wall-clock/hop budget. Minimum guarantees it needs: (a) no unauthenticated write or read of graph content; (b) a rejected or unauthorized update is never stored, fanned out or executed; (c) every admitted mutation has an actor, a mutation id and a base state vector in the audit log; (d) MCP tools cannot reach S3 or the scheduler except through the same services the editor uses.

## 1.7 Effort and risk headline

Effort ranges assume one senior full-stack engineer (TS/Vue/AWS) plus part-time review; ranges are wide because of unresolved spikes. M1 (identity/admission/revisions/minimum containment) 6–10 weeks; M2 (MCP read/propose + editor visibility) 4–6 weeks; M3 (vertical slice with activation, hybrid execution, observations, contracts, one journey) 6–10 weeks; M4 (IaC) 5–8 weeks; M5 (budgets, publication, replay/rollback, hardening) 8–14 weeks; M6 (Rust runtime parity) 10–16 weeks, optional. Principal risks: `isolated-vm` in Lambda (native build; spike S-1), client-side rejection recovery UX with Yjs (spike S-2), Streamable HTTP long-lived streams on API Gateway (decision D-3), and the amount of editor dead code that any UI work will trip over (A1 §J).
