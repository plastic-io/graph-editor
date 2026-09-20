# Schema tooling

- `gen_schemas.py` — defines the shared `$defs` and the 13 non-core MCP tool schemas; with `GEN_WRITE=1` it writes `schemas/mcp/*.json`, `schemas/examples/*.json` and appends the "Remaining tools" section to `appendix/A6-mcp-tool-schemas.md` (append once; delete that section before regenerating).
- `gen_fixtures.py` — builds the RateLimiter/api-graph fixtures, manifest (digest), diff examples and the exact traversal calls into `schemas/fixtures/` and rewrites `appendix/A7-component-fixtures-and-traversal.md`.
- `validate.js` / `validate_fixtures.js` — validate every example and fixture with ajv (uses the editor's `node_modules`; ajv 6 is draft-07, so `$defs` is renamed to `definitions` for validation only).

Run from the repository root:
```
NODE_PATH=$PWD/node_modules node docs/polymorphic-application-plan/schemas/tools/validate.js
NODE_PATH=$PWD/node_modules node docs/polymorphic-application-plan/schemas/tools/validate_fixtures.js
```
