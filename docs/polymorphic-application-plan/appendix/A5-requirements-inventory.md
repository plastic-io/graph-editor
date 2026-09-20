# Requirement inventory extracted from the brief (to be mapped in the gap matrix)

| ID | Section | Requirement (condensed) |
|---|---|---|
| R-2.1 | §2 | Graph is the authoritative representation; agent operates by proposing authorized graph transactions |
| R-2.2 | §2 | "Deploy once" = bootstrap substrate, then evolve via graph; define substrate upgrade/repair boundaries |
| R-2.3 | §2 | Published component = unit of abstraction, reuse, versioning, agent context, permission scope, testing, deployment; recursive; typed edge contract |
| R-2.4 | §2 | Edges are both capability bindings and intrinsic observability; verify every host binding obeys this |
| R-2.5 | §2 | One logical graph across browser+server; shared identity ≠ identical state/authority/synchrony/effects |
| R-2.6 | §2 | Glossary tied to discovered types (graph/node/component/port/edge/hyperedge; published vs instance; mutation/event/CRDT update; revision/activation; capability/observation) |
| R-3.1 | §3 | Evidence ledger with IDs, repo, commit, path, symbol, verification method; failed checks recorded |
| R-3.2 | §3 | Classify each requirement: present-adequate / present-incomplete / absent / contradictory / unverified |
| R-3.3 | §3 | Open questions have owner role, default, blocked work |
| R-4.1 | §4 | Server map: entry points, WS handling, principal resolution, lookup, access checks, event admission, Yjs, persistence/recovery, runtime invocation, Lambda/S3 verified, retry/dup/reconnect/concurrent writers, bypass paths |
| R-4.2 | §4 | Editor map: model adapters, commands, visualization, nesting, publication/import, local execution, collab state, WS, undo/redo, serialization, trace displays, rejection behaviour, extension points |
| R-4.3 | §4 | Rust map: structures, deserialization, recursion, hyperedges, scheduling, Tokio, V8 init, isolates, bindings, conversion, compile, results, teardown, threads, unsafe/FFI, cancellation, limits, metrics, integration status |
| R-4.4 | §4 | TS scheduler map: interfaces, queues, states, traversal, recursion, hyperedge dispatch, adapters, bindings, async, cancellation, errors, TS-vs-Rust semantics, consumed versions |
| R-4.5 | §4 | Cross-repo: diagram, responsibility table, canonical ownership, schema propagation, duplicates/skew/implicit contracts/dead paths/debt |
| R-5.1 | §5 | Authoritative vs derived graph data; code/artifact references; definition resolution; separation of app state, layout, runtime state, deployment state, secrets |
| R-5.2 | §5 | Publication, version identity, immutability, dependency resolution, instance creation, upgrades, deprecation, compatibility; nested deps, cycles, depth, missing versions |
| R-5.3 | §5 | Agent proposals at graph / instance / published-definition level; consumers visible; deployment as independent activation or atomic — justified |
| R-5.4 | §5 | Type extensions: metadata, contract/schema refs, dependency pins, capability requirements, summaries, intent tests, revision/provenance; serialization rules |
| R-5.5 | §5 | Boundary schema validation, assignability, defaults, optionals, error payloads, runtime disagreement |
| R-5.6 | §5 | Cache keys/invalidation for definitions, summaries, contracts, test results; immutable identity → same content or clear failure |
| R-5.7 | §5 | Reference integrity across edits/deletion/expansion/publication/rollback; detached resources/executions |
| R-5.8 | §5 | Worked example: recursive component definition → instance → invoke → observe → upgrade → rollback |
| R-6.1 | §6 | Single logical admission choke point shared by humans, chat, MCP, imports, automation, privileged components; consistency/availability stated |
| R-6.2 | §6 | Verify described check-before-admit sequence; enumerate bypasses; raw-Yjs-update problem and mediation strategy |
| R-6.3 | §6 | Client submission mechanism (commands / constrained events / staged raw updates) with validation before trust/replication/persistence/execution |
| R-6.4 | §6 | Admission contract fields (actor, tenant, agent+delegator, scope, op/target, base revision, txn/idempotency ids, capability changes, provenance, policy version, approvals, payload/schema versions); server-derived fields; decision bound to exact mutation |
| R-6.5 | §6 | Batch atomicity, concurrency, stale proposals, conflicts, policy change mid-review, recheck at commit, malformed, duplicates, offline, reconnect, undo/redo; rejected-edit handling (not replication-of-rejection) |
| R-6.6 | §6 | Separate authorities: read, inspect internals, inspect payloads, propose, approve, commit, publish, execute, connect privileged edges, deploy; propagation through recursion/hyperedges; revocation vs in-flight; no self-broadening edits; client-independent authority |
| R-6.7 | §6 | Authorization matrix + decision procedure with module, inputs, policy source, audit event, rejection, tests; delegation narrowing; runtime effect checks after structural admission |
| R-7.1 | §7 | Map typed edges to runtime bindings; inventory all effects (network, storage, timers, native, secrets, dynamic code, browser APIs, cloud creds); explicit capability vs ambient |
| R-7.2 | §7 | Capability grants on connection/invocation/routing/publication: subject, scope, target, op, lifetime, delegation, revocation; ownership (definition/instance/principal/connection); anti-escalation via nesting/rewiring/credential-as-data |
| R-7.3 | §7 | Edge activity = primary trace: observations for inputs, outputs, routing, start/finish, errors, denied effects, exhaustion, deployment progress, test results; cross-graph/cross-domain correlation ids mapped to real types |
| R-7.4 | §7 | Ordering/gaps, timestamps, delivery, buffering, sampling, retention, size limits, redaction, authorized subscriptions; audit vs diagnostics; volume safety |
| R-7.5 | §7 | Summary → specific edge hop traceability; redaction visibility; structure sensitivity; no leakage; infra diagnostics linkage |
| R-7.6 | §7 | Deliver observation envelope, capability representation, edge-contract extensions, storage/subscription design, enforcement locations; ordinary + privileged examples |
| R-8.1 | §8 | Hybrid execution: HTTP → server → WS → client-only nodes → back; hyperedge spanning domains; editor controls for server capability |
| R-8.2 | §8 | Placement in contract (browser-only / server-only / portable), selection, serialization across boundary, travelling principals/scopes, non-crossable values |
| R-8.3 | §8 | Execution ownership: execute vs observe vs forward; no browser, multiple browsers, disconnect/reconnect, server restart, Lambda timeout, migration; no duplicate effects from replication |
| R-8.4 | §8 | Hyperedge semantics: fan-out/in, ordering, join, completion, delivery, dedup, correlation, timeout, partial failure, retries, backpressure, cancellation, budgets; atomicity/compensation; no false exactly-once |
| R-8.5 | §8 | Structure changes vs running executions: pinning, switching, drain/cancel/migrate; version skew browser/server |
| R-8.6 | §8 | Sequence diagram: server input → hyperedge → server business op + browser GL shader; identity, revision, owner, observations, failures, reconnection |
| R-9.1 | §9 | Assess isolate / OS thread / Tokio task / pool / process / deployment boundaries; threats each addresses |
| R-9.2 | §9 | Per-isolate thread behaviour per mode; ownership; termination path; blocking JS on async workers; fairness, queues, recursion, fan-out, priority inversion, starvation |
| R-9.3 | §9 | Real termination plan via actual V8 APIs; cooperative + out-of-band; stuck native work; teardown; isolate reuse; process-level containment cost |
| R-9.4 | §9 | Budget hierarchy tenant → root execution → component → node/isolate; allocation, reservation, inheritance, accounting, replenishment, release; no minting/escape; attribution across fan-out |
| R-9.5 | §9 | Budget dimensions (CPU, wall, heap, external mem, process mem, isolates/threads, queued tasks, recursion depth, event/payload volume, network/storage ops, cloud cost); hard/cooperative/estimate/monitor; measurement + enforcement |
| R-9.6 | §9 | OOM separate from cancellation; recovery; tenant protection; adversarial cases (loops, microtask storms, recursion, unresolved promises, expensive host calls, cancellation races, allocator pressure, observation floods) |
| R-9.7 | §9 | Lifecycle/state diagrams; budget/cancellation/execution-handle types mapped to modules; measurable acceptance criteria; thresholds measured or labelled as spike |
| R-10.1 | §10 | MCP as machine interface to same primitives/admission; chat as another client; placement of transport/session/principal/ops/subscriptions; orchestration separate from authority |
| R-10.2 | §10 | Actual SDK/protocol versions cited; transport, auth, session lifecycle, authz mapping, cancellation, errors, pagination, subscriptions; no bypass tools |
| R-10.3 | §10 | Tool coverage: discover, inspect/expand, read revisions/diffs/provenance/state/tests/observations, propose/validate/impact/simulate/review, approve/commit/activate/rollback, invoke/test/IaC operate + cancel/status |
| R-10.4 | §10 | Per tool: purpose, JSON Schema in/out, bounds, permissions, pre/postconditions, idempotency, concurrency, failure codes, audit events, side effects, cancellation, mapping, valid + rejected examples, schema versioning, unknown-field rejection |
| R-10.5 | §10 | Per resource: URI pattern, identity/revision semantics, MIME, schema, visibility, redaction, size, pagination, caching, subscription; resources vs tools rationale; annotations ≠ authorization |
| R-10.6 | §10 | Common envelopes (ids, base/result revisions, principal/delegation, proposal/execution ids, correlation, errors, retry guidance); server-derived identity; lossless IR mapping |
| R-11.1 | §11 | Summary-first workflow; expand only as needed; no whole-codebase ingestion |
| R-11.2 | §11 | Summary content (purpose, identity/revision, I/O, invariants, deps, effects, placement, health, pointers); derived vs maintained; provenance/freshness |
| R-11.3 | §11 | Traversal by hierarchy/edges/contracts/capabilities/deployment/failures/traces; bounds on depth/count/size/cost/tokens; pagination, continuation, cycles, ordering, truncation flags |
| R-11.4 | §11 | Progressive disclosure with authorization at every step; summaries/indexes never reveal denied data |
| R-11.5 | §11 | Revision-bound context; stale invalidation; changes during planning; revalidate before commit |
| R-11.6 | §11 | Worked interaction with exact calls, bounded responses, deferred info, context cost estimate; effectiveness metrics |
| R-12.1 | §12 | Reconcile Yjs state with immutable revisions: creation, addressing, storage, verification, digest contents, pins; compaction/GC without losing audit/reconstruction |
| R-12.2 | §12 | Mutation lifecycle states & transitions, owners, durability, retries, expiry, cancellation, crash recovery; approval bound to content/scope/base/policy |
| R-12.3 | §12 | Semantic diffs (nodes, wiring, contracts, code, placement, capabilities, budgets, tests, infra); consumers & privilege changes; provenance fields; tamper evidence / signatures honest |
| R-12.4 | §12 | Commit vs activation; consistency across state, history, replicas, scheduler caches, active revisions; linearization/conflict policy; in-flight executions; recovery when notification/deploy fails |
| R-12.5 | §12 | Replay: structural vs deterministic vs effect reapplication; recording nondeterminism; limits; never repeat payments/infra |
| R-12.6 | §12 | Simulation classes by effect type; shadow execution without duplicate effects; comparison criteria; when skip/required/unsafe |
| R-12.7 | §12 | Rollback of definition / activation / app state / infra separately; compensation, irreversible effects, migrations, forward recovery, operator intervention; residual drift visible |
| R-13.1 | §13 | IaC as first-class recursive publishable component; edited in browser, executed on server; same paths for MCP/chat |
| R-13.2 | §13 | Verify existing Lambda deploy, CFN templates/calls, CodeBuild, credentials, IAM, artifacts, status plumbing; exists vs intended vs to-add |
| R-13.3 | §13 | Desired-state inputs (template/artifact ref, params, account/region/env, stack id, op, policy, revision, idempotency, approval/change-set refs); secret refs not values |
| R-13.4 | §13 | Observed outputs (requested/effective versions, validation, change-set, op/build ids, status transitions, timestamps, sanitized logs, stack outputs, drift, failure, rollback status, terminal); data edge vs event vs status |
| R-13.5 | §13 | Initiation by explicit action or triggers; no self-triggering loops; debounce, idempotency, desired-vs-observed, stack serialization, supersession, stale status, out-of-order correlation |
| R-13.6 | §13 | Lifecycle validation → plan → review → build → deploy → observe → complete/fail; when CodeBuild needed; build integrity/role/logs/cancel/handoff; CB≠CFN states |
| R-13.7 | §13 | Durable orchestration beyond request/WS/MCP/Lambda; polling vs events; checkpoint, retries, dedup, backoff, timeout, restart, partial failure, stale desired, lost events; recover status without live connection |
| R-13.8 | §13 | IAM policy fragments with placeholders; separated authorities (client/agent, server orchestration, CFN execution, CodeBuild); PassRole/trust constraints; template/custom resource/macro/build/resource-policy escalation analysis |
| R-13.9 | §13 | Required actions with justification/scoping/conditions/lifetime; enforcement of environments, resources, cost, destructive/policy changes; no self-modifying guardrails |
| R-13.10 | §13 | Typed failure feedback (validation, build, deploy, rollback-in-progress, rollback failure, drift, manual recovery); cancel request ≠ stop AWS op; compensation/retained resources/forward repair; runbook usable if stack damaged |
| R-13.11 | §13 | Complete success and failure examples with ports/edges, identities, events, AWS calls, status mapping, permissions, redacted diagnostics, modules |
| R-14.1 | §14 | Component-centred testing: tests, contracts, invariants, fixtures, capabilities, expected effects co-located with version; composition rules |
| R-14.2 | §14 | Schema/contract validation; property/invariant tests; no silent oracle weakening; explicit diffs + review for intent/invariant/test changes |
| R-14.3 | §14 | Continuous synthetic journeys by intent/outcome, topology-independent; resolution of intent to implementation; resolution failure reporting |
| R-14.4 | §14 | Synthetic identities/tenants, fixtures, cleanup, permitted effects, isolation/test modes, scheduling, budgets, retries, flakiness, observability, latency; real effect constraints; user vs probe failure; identifiable in observations |
| R-14.5 | §14 | Testing layers: substrate unit/CI; component contracts/composition/hyperedge/compat/invariants; admission+Yjs adversarial; V8 termination/budgets/pressure/cleanup/fairness/denied/volume; hybrid multi/no client, offline, skew, partial fan-out, revision switch, dup prevention; IaC validation/policy/state machines/status loss/rollback failure/recovery |
| R-14.6 | §14 | Gates: publication, proposal validation, pre-activation simulation, post-activation window, continuous journeys; proportional to risk; failure → block/pause/revoke/alert/auto-rollback; rollback-loop safeguards |
| R-14.7 | §14 | Representative test definitions/examples; revision-bound results; coverage evolution; shape-invariant tests |
| R-15.1 | §15 | Editor shows agent inspecting/evolving same app; reuse selection/tracing/navigation/status; chat and MCP consistent |
| R-15.2 | §15 | Show agent identity/scope, current target, summary retrieval/expansion, paths/edges, tool status, observations; factual actions + rationale; tentative vs mutation |
| R-15.3 | §15 | Proposal review UI: diffs, consumers, edge/capability changes, contracts/budgets/tests, effects, validation, simulation limits, decision; approve exact revision; conflict; rejection reasons |
| R-15.4 | §15 | Represent committed definition, activation, runtime revision, desired infra, observed deploy, journey health distinctly; flows, burn, throttling, failures, rollback, nested links; consistent redaction |
| R-15.5 | §15 | Concurrency, multi-client, long ops, reconnect, missed observations, history, large graphs, accessibility; honest cancel/pause semantics |
| R-15.6 | §15 | Wireframes/state descriptions, mapping to editor files/stores, new UI state types, integration tests; walkthrough of external agent flow |
| R-16.1 | §16 | Threat model across trust boundaries and adversaries; listed attack classes; per threat: asset, preconditions, path, current protections w/ evidence, enforcement point, residual risk, negative test; preventive vs detective; assumptions |
| R-16.2 | §16 | Six required sequence traces with per-hop fields; happy + failure paths; new elements marked |
| R-17.1 | §17 | Repo-by-repo work items with file/module/symbol, behaviour, change, interfaces, tests, compat, deps, evidence |
| R-17.2 | §17 | Concrete TS/Rust types for admission results, proposal/revision identity, contracts/summaries, grants, observations, placement, budget/cancel handles, deployment state, intent tests; serialization/version negotiation |
| R-17.3 | §17 | Workstream dependency graph; parallel vs serialized; bounded spikes (V8 termination, CRDT admission, runtime integration, deployment feedback) with question/method/artifact/exit/decision |
| R-17.4 | §17 | Milestones with scope, exclusions, deps, deliverables, owner role, effort range+assumptions, risks, acceptance, rollback; smallest useful demo + minimum guarantees |
| R-17.5 | §17 | Backward compatibility: stored formats, Yjs docs, revisions, components, clients, protocols, TS/Rust semantics, MCP schemas, deployments; mixed versions, migrations, flags, rollout, validation, interrupted migration |
| R-17.6 | §17 | Bootstrap/substrate upgrades: patches, schema evolution, admission-service deploy, recovery creds, backups, DR, independent graph evolution; controlled repair route |
| R-18.1 | §18 | Ten required plan sections; backlog items with stable ID, priority+reason, outcome, repo/modules, deps, interface changes, acceptance tests, evidence, effort/uncertainty, owner; blockers vs follow-ons |
| R-18.2 | §18 | Final self-review checklist confirmations |
