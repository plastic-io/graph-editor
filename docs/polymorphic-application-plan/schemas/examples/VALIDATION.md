# Example validation (ajv 6.12.6 from graph-editor/node_modules, run 2026-09-20; `$defs` renamed to `definitions` for the draft-07 validator)

| tool | valid example | rejected example |
|---|---|---|
| component.publish | pass | passes schema (rejected by policy/validation) |
| component.search | pass | fails schema (-32602) |
| execution.cancel | pass | fails schema (-32602) |
| graph.expand | pass | fails schema (-32602) |
| graph.invoke | pass | fails schema (-32602) |
| graph.summary | pass | fails schema (-32602) |
| iac.apply | pass | fails schema (-32602) |
| iac.cancel | pass | fails schema (-32602) |
| iac.plan | pass | passes schema (rejected by policy/validation) |
| iac.status | pass | fails schema (-32602) |
| observations.query | pass | fails schema (-32602) |
| proposal.commit | pass | fails schema (-32602) |
| proposal.create | pass | passes schema (rejected by policy/validation) |
| proposal.decide | pass | passes schema (rejected by policy/validation) |
| proposal.simulate | pass | fails schema (-32602) |
| proposal.validate | pass | fails schema (-32602) |
| revision.activate | pass | fails schema (-32602) |
| revision.rollback | pass | fails schema (-32602) |
| tests.run | pass | fails schema (-32602) |

Compiled 19 input+output schema pairs; failures: 0.
