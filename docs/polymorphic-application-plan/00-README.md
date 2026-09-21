# Plastic-IO polymorphic application — engineering implementation plan

Produced 2026-09-20 from the inspected revisions listed in `02-discovery-record.md`. This is a plan and a discovery record; nothing here is implemented, deployed or proven secure.

## Navigation
| File | Contents (brief §18 mapping) |
|---|---|
| `01-executive-assessment.md` | 1. feasibility, central architecture, what stays, essential extensions, contradictions, smallest first release |
| `02-discovery-record.md` | 2. repository/commit inventory, reproducible commands and results, current-state diagrams, ownership table, capability inventory, glossary |
| `03-requirement-gap-matrix.md` | 3. every requirement → evidence, class, target design, work items, tests, open items |
| `04a-target-architecture-model-admission.md` | 4A. authoritative model, summaries/traversal, recursive components, admission, capabilities and observations |
| `04b-target-architecture-runtime-revisions-hybrid.md` | 4B. containment and budgets, revisions/proposals/activation/replay/rollback, hybrid execution |
| `04c-target-architecture-iac-substrate.md` | 4C. CloudFormation as a privileged component, substrate evolution |
| `05-interface-specification.md` | 5. MCP protocol/SDK decisions, envelopes and errors, resources, tools, shared types and compatibility |
| `06-worked-workflows.md` | 6. the six required traces, recursive component lifecycle, IaC success/failure, bounded agent traversal |
| `07-security-operational.md` | 7. threat model, authorization matrix and decision procedure, enforcement/credentials/persistence/observability |
| `08-testing-and-editor.md` | 8. testing layers, journeys, gates; editor screens, file mapping, walkthrough |
| `09-implementation-plan.md` | 9. repo-by-repo changes, shared types, workstream graph, spikes, milestones, migration, rollout |
| `10-backlog-and-decisions.md` | 10. prioritized backlog (PB-nnn), decision log (D-n), open questions (Q-n), final self-review |
| `11-preparation-tasks.md` | preparation tasks with status and evidence logs (tasks 1–4 done, 5 prepared) |
| `12-task5-setup.md` | the three credentialed setup steps, prepared to one command each |
| `spikes/` | S-1 and S-4 reports, the isolated-vm Lambda harness, the staged-admission bench |
| `patches/` | change for the scheduler repository (not checked out locally) |
| `appendix/A1-discovery-graph-editor.md` | evidence ledger GE-01..65 with path:lines |
| `appendix/A2-discovery-graph-server.md` | evidence ledger GS-01..43, deployment evidence, local reproduction of the CRDT poisoning |
| `appendix/A3-discovery-runtimes.md` | evidence ledger RT-01..43, experiment transcripts, TS 2.0.1↔2.0.3 diff, Rust findings |
| `appendix/A4-external-references.md` | MCP 2026-07-28, SDK versions, V8 crate APIs, AWS quotas and behaviours (with fetch dates) |
| `appendix/A5-requirements-inventory.md` | requirement IDs used in §3 |
| `appendix/A6-mcp-tool-schemas.md` | full JSON Schemas + valid/rejected examples for the core MCP tools; CloudFormation status mapping |
| `appendix/A7-component-fixtures-and-traversal.md` | RateLimiter source graph, manifest with digest, api-graph instance, semantic diff examples, the exact traversal as JSON-RPC with measured sizes |
| `appendix/A8-iam-policies.md` | IAM policy documents for the request role, orchestrator, CloudFormation execution role, permissions boundary, CodeBuild, EventBridge rule |
| `appendix/A9-test-definitions.md` | ComponentTest and IntentJourney JSON, admission adversarial spec, scheduler ordering spec, hybrid Playwright outline |
| `appendix/A10-diagrams.md` | Mermaid diagrams: admission flow, hybrid sequence, execution/proposal/IaC state machines, workstream graph |
| `schemas/` | machine-readable JSON Schemas for every MCP tool (`mcp/`), the graph document (`fixtures/graph.schema.json`), fixtures, examples and ajv validation reports |
| `appendix/logs/` | raw test and type-check output |

## Reading order for an implementer
1. `01` then `02` §2.3–2.6 (what exists, in code terms).
2. `04a` §4.4 (admission) and `05` §5.1 (envelope) — the contract everything else depends on.
3. `09` §9.3 (dependency graph) and `10` §10.1 (your work items), then the design section each item cites.

## Status vocabulary
`[FACT]` verified at the cited path/lines · `[REQ]` requirement · `[PROPOSED]` change · `[OPEN]` decision needing information or policy · ledger IDs `GE-nn` / `GS-nn` / `RT-nn`.
