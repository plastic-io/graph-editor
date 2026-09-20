# A10. Diagrams (Mermaid; render on GitHub or any Mermaid-capable viewer)

## A10.1 Admission flow (§4.4.2)
```mermaid
flowchart LR
  E["Graph Editor<br/>MutationEnvelope{update}"] --> A
  M["MCP client<br/>MutationEnvelope{ops}"] --> A
  I["Import / automation<br/>MutationEnvelope{ops}"] --> A
  A[authenticate + resolve principal, tenant, delegation] --> H[load head doc<br/>CrdtStore.loadMerged]
  H --> MAT{kind}
  MAT -- update --> DEC[decode guard: size, structs]
  MAT -- ops --> OPS[applyOps + reconcile on staging → U]
  DEC --> STG[apply U on staging clone]
  OPS --> STG
  STG --> DIFF["semanticDiff(before, after)"]
  DIFF --> POL{policy.decide}
  POL -- deny --> REJ[reject frame to sender<br/>audit mutation.rejected<br/>nothing stored / fanned out]
  POL -- approval-required --> PROP[proposal document<br/>awaiting-review]
  POL -- allow --> COMMIT["append U (bytes unchanged)<br/>MutationRecord (audit chain)<br/>fan-out to graph-crdt-{id}<br/>ack to sender"]
  COMMIT --> CUT{revision cut?}
  CUT -- yes --> REV[Revision manifest + HEAD CAS]
```

## A10.2 Hybrid execution sequence (trace §6.3)
```mermaid
sequenceDiagram
  autonumber
  participant C as HTTP client
  participant GW as API Gateway (JWT authorizer)
  participant L as Lambda httpDefault
  participant X as isolated-vm executor (rev12)
  participant O as Observation sink / S3
  participant WS as graph-notify-viz channel
  participant B1 as Browser viewer 1
  participant B2 as Browser viewer 2
  C->>GW: POST /viz.in {payload}
  GW->>L: event + principal
  L->>L: endpoints/viz.in → active/viz = rev12; executionId E1; reserve budget
  L->>X: url("in", payload, budget slice)
  X->>O: exec.begin {E1, rev12, http.in}
  X->>X: edges.out = payload (hyperedge c1,c2)
  X->>O: route c1 → price.compute ; effect net:https api.example.com allowed
  X->>O: route c2 → shader.render deferred:browser
  X->>WS: edge.deliver {E1, seq 3, c2, value, target all-viewers}
  WS-->>B1: edge.deliver (dedup key E1/c2/3)
  WS-->>B2: edge.deliver (dedup key E1/c2/3)
  B1->>B1: worker runs shader.render with host.ui
  B2->>B2: worker runs shader.render with host.ui
  B1-->>O: observation.report {E1, domain browser, seq 3'}
  X->>X: price.compute → edges.result = {price}
  X->>WS: edge.deliver {E1, seq 5, c3, {price}}
  WS-->>B1: edge.deliver
  WS-->>B2: edge.deliver
  X->>O: exec.end {E1, server, completed, pendingBrowser:[c2,c3]}
  L-->>C: 200 {executionId E1, outputs, observationsUrl}
  Note over B2,WS: B2 dropped before seq 3 → on reconnect sends executions.resume{since} → parked deliveries replayed, deduped
  Note over X,O: api.example.com timeout → exec.error{price.compute, timeout}; c2 already delivered (partial failure); execution 'failed'
```

## A10.3 ExecutionHandle state machine (§4.6.6)
```mermaid
stateDiagram-v2
  [*] --> queued
  queued --> running: budget reserved
  queued --> failed: BUDGET_EXCEEDED (tenant bucket empty)
  running --> completed: all spans settled
  running --> failed: error / OOM / pending-promises at wall budget
  running --> cancelling: cancel() or watchdog
  cancelling --> cancelled: cooperative exit or isolate disposed
  cancelling --> abandoned: hard-kill timeout (Worker did not exit)
  completed --> [*]
  failed --> [*]
  cancelled --> [*]
  abandoned --> [*]
  note right of cancelling: cooperative token first, then isolate.dispose()/worker.terminate()/IsolateHandle.terminate_execution()
```

## A10.4 Proposal lifecycle (§4.7.2)
```mermaid
stateDiagram-v2
  [*] --> draft
  draft --> validated: proposal.create / validate ok
  draft --> rejected: validation fails
  validated --> awaiting_review: rules require review
  validated --> committed: proposal.commit (no review required)
  awaiting_review --> approved: proposal.decide approve (binds digest, base, policyVersion)
  awaiting_review --> rejected: proposal.decide reject
  validated --> simulated: proposal.simulate
  awaiting_review --> simulated: proposal.simulate
  simulated --> validated
  simulated --> awaiting_review
  approved --> committed: proposal.commit (HEAD CAS)
  approved --> validated: base moved (STALE_BASE) or policy changed
  committed --> activating: revision.activate
  activating --> active: active pointer moved, projection written
  activating --> failed: unresolved component / schema gate
  active --> rolled_back: revision.rollback
  active --> compensated: rollback with compensators
  validated --> expired: ttl
  awaiting_review --> expired: ttl
  draft --> cancelled: proposer cancels
```

## A10.5 IaC operation lifecycle (§4.9.4, mapping in A6)
```mermaid
stateDiagram-v2
  [*] --> requested
  requested --> validating: lock acquired (If-None-Match)
  requested --> superseded_pending: lock held by a running operation
  superseded_pending --> requested: previous operation terminal (newest wins)
  superseded_pending --> superseded: a newer desired state queued
  validating --> failed: template denied / prefix / boundary
  validating --> planning: CreateChangeSet
  planning --> failed: change set FAILED
  planning --> succeeded: no changes
  planning --> awaiting_review: destructive or env policy
  planning --> building: build present
  planning --> executing: ExecuteChangeSet
  awaiting_review --> cancelled: rejected
  awaiting_review --> building
  awaiting_review --> executing
  building --> failed: FAILED / FAULT / TIMED_OUT
  building --> cancelled: STOPPED after cancel
  building --> executing: SUCCEEDED
  executing --> observing: EventBridge / poll
  observing --> succeeded: *_COMPLETE
  observing --> failed: *_FAILED
  observing --> rolled_back: UPDATE_ROLLBACK_COMPLETE
  observing --> rollback_failed: UPDATE_ROLLBACK_FAILED (manualRecoveryRequired)
  observing --> cancelled: CancelUpdateStack honoured
  succeeded --> [*]
  failed --> [*]
  rolled_back --> [*]
  rollback_failed --> [*]
  cancelled --> [*]
  superseded --> [*]
```

## A10.6 Workstream dependency graph (§9.3)
```mermaid
flowchart TD
  W0[W0 discovery/baseline] --> W1[W1 schema + crdt packages]
  W1 --> W2[W2 identity + policy]
  W1 --> W4[W4 scheduler 2.1]
  W1 --> W10[W10 capabilities + observations]
  W1 --> W12[W12 MCP read]
  W1 --> W13[W13 editor visibility]
  W2 --> W3[W3 admission]
  W3 --> W5[W5 revisions / proposals]
  W3 --> W13
  W5 --> W6[W6 activation-bound executor]
  W5 --> W8[W8 MCP write tools]
  W12 --> W8
  W4 --> W7[W7 containment isolated-vm]
  W7 --> W9[W9 hybrid execution]
  W6 --> W9
  W10 --> W9
  W10 --> W11[W11 components / publication]
  W5 --> W14[W14 IaC]
  W10 --> W14
  W2 --> W14
  W1 --> W16[W16 migration / substrate]
  W5 --> W16
  W1 --> W17["W17 Rust parity (optional)"]
  W4 --> W17
```
