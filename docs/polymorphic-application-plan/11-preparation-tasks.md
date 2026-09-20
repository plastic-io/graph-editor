# 11. Preparation tasks (agreed 2026-09-20, before M0/M1 start)

| # | Task | Status | Evidence / notes |
|---|---|---|---|
| 1 | **Close the exposed surface on the deployed dev server.** Remove the client-callable `sendToChannel`, `sendToConnection`, `broadcast`, `addEvent` (WS + HTTP), `listSubscribers`, `listSubscriptions` routes; require an API key on the HTTP execution route (`ANY /{proxy+}`) and on the anonymous destructive/expensive HTTP routes (`POST /toc/rebuild`, `DELETE /graph/{id}`, `POST /graph/{id}/restore`); disable WebSocket `$default` execution unless `WS_EXECUTION_ENABLED=true`; enable S3 versioning with 30-day noncurrent expiry so a poisoned document is recoverable; fetch the OpenAI secret only for graphs that opt in (`graph.properties.openai === true`). Pulls forward PB-015 and PB-124. | **done 2026-09-20** (deployed to dev) | graph-server branch `harden-dev-surface`, commit `96e89d8`; evidence in the log below |
| 2 | **Decide the open questions that gate M1/M2:** Q-1 agent self-commit, Q-2 tenant model, Q-8 public editor default, D-8 retention; confirm or reject D-11 (templates lose Pinia stores/`transact`). | **done 2026-09-20**: Q-1, Q-2, Q-8 decided (§10.3); D-8 defaults accepted; D-11 revised (in-realm store restriction rejected as theatre; sandboxed iframe deferred as PB-119) | §10.2, §10.3 |
| 3 | **Run spikes S-1 (isolated-vm in Lambda) and S-4 (staged validation cost)** before trusting the M1/M3 estimates. | not started | §9.3 spike table |
| 4 | **Get the baseline green (M0):** pin Node, add editor test + type-check steps to CI, fix the four bare-`<script>` SFCs, chain scheduler build→test, run server tests on Node 18. | **done 2026-09-20** (local branches, not pushed) | editor `m0-baseline` b63db9f, server `m0-baseline` 877051e, scheduler patch in `patches/`; evidence below |
| 5 | **Unblock parallel work:** publish `@plastic-io/graph-crdt` to npm (PB-120), configure the Auth0 API with the §4.4.5 scope names and one test agent client, create a CI deploy role with OIDC (PB-125); a `staging` stage and a `pio-test-` AWS environment before M3. | not started | — |

Explicitly deferred: any Rust runtime work (W17 — decided 2026-09-20 to be the last workstream, on both server and browser, as the security upgrade after the app is fully functional) and any IaC work (W14).

## Task 1 log

Branch `harden-dev-surface` in graph-server, commit `96e89d8` (tests 83/83, `npx serverless package` clean), deployed with `npx serverless deploy --aws-profile tony` at 2026-09-20T22:19Z.

| Check | Result |
|---|---|
| WebSocket routes after deploy (`aws apigatewayv2 get-routes`) | `$connect $default $disconnect deleteGraph getGraph panic publishGraph publishNode subscribe undeleteGraph unsubscribe yjs` — `sendToChannel`, `sendToConnection`, `broadcast`, `addEvent`, `listSubscribers`, `listSubscriptions` gone; Lambda functions for all six return `ResourceNotFoundException` |
| REST execution route without key | `GET/POST /probe-graph` → 403 `ForbiddenException`; with the stage key → 200 `ok` |
| `POST /toc/rebuild`, `DELETE /graph/{id}`, `POST /graph/{id}/restore` without key | 403 `ForbiddenException`; rebuild with key → 200 `{"entries":121}` |
| `POST /addEvent` | 500 for ~3 minutes after deploy (the new API Gateway deployment snapshot was taken before CloudFormation deleted the old resource, so the stage briefly served a method whose Lambda was gone); after `aws apigateway create-deployment --stage-name dev` and propagation → 403 like any other keyed path |
| Read routes the editor uses (`GET /toc.json`, `/crdt/{id}/state`, `/deleted.json`) | 200, unchanged (an earlier 403 was CloudFront rejecting a GET with a request body from the probe itself, not the API) |
| `WS_EXECUTION_ENABLED` on `default` and `httpDefault` | `false` |
| Forged fan-out over WebSocket (socket B sends `sendToChannel` / `sendToConnection` / `listSubscriptions` / `executeGraph` / `addEvent` while socket A is subscribed) | A receives only its `subscribed` ack; B receives nothing; no forged payload delivered (script in the session log, exit 0) |
| S3 bucket | `VersioningConfiguration.Status = Enabled`; lifecycle rule `expire-noncurrent-versions` (30 days noncurrent, 7-day incomplete-multipart abort) |
| Still anonymous by design until M1 | `yjs` (CRDT sync), `subscribe`, `getGraph`, `publishGraph/Node`, `deleteGraph` (WS), `POST /crdt/{id}/update`, `POST /crdt/{id}/checkpoint` and all GET routes — the editor needs them; the M1 authorizer (PB-011/012) covers them. A forged `yjs` frame can still poison a graph (GS-13) but is now recoverable from the versioned bucket. |

Follow-ups noted while doing this: `GET /events/{id}` still returns 400 `Missing required request parameters: [version]` live (GS-25, phantom path parameter); the `serverless deploy` step should be followed by an explicit API Gateway re-deployment (or `serverless deploy` twice) whenever routes are removed.

## Task 4 log

| Item | What was done | Evidence |
|---|---|---|
| Editor type-check | Enabling `allowJs` (tsconfig.app.json) gets vue-tsc past the four bare-`<script>` SFCs (TS6504) and reveals the real state: **505 TypeScript errors** across the SFCs (top files: `Node.vue` 60+, `GraphProperties.vue` 20, `NodePropertiesPanel.vue` 19, `MiniMapInfo.vue`, `ConnectorPropertiesPanel.vue`, `ImportPanel*.vue`, `GitHubRegistryPanel.vue`; mostly `possibly undefined/null`, implicit `any`, and interfaces imported as values). Fixing them is a workstream (new backlog item PB-118, P1, owner FE, effort L). M0 therefore adds a **ratchet**: `npm run type-check:ratchet` (`scripts/type-check-ratchet.mjs`) fails only if the count exceeds `.type-check-baseline` (505) and lowers the baseline with `--update`. | editor commit b63db9f; ratchet run: `vue-tsc reported 505 error(s); baseline is 505.` exit 0 |
| Editor CI | `.github/workflows/main.yml` now runs on `pull_request` too, and runs `test:crdt`, `test:integration` and the ratchet before `build`; the Pages deploy steps are gated on `push`. `.nvmrc` = 18. `vite build` still succeeds with `allowJs` (25 s). | same commit |
| Server CI / Node | `.nvmrc` = 18; `.github/workflows/test.yml` runs `npm ci && npx jest --ci` on Node 18, checking out the editor next to the server because of the `file:` link (goes away with PB-120). `@types/node` 9.6 → 18.19; `npx serverless package` and jest 83/83 unchanged. | server commit 877051e |
| Scheduler | `pretest` hook runs `tsc` so `npm test` never runs against a stale `dist/` (CI already built first; local did not). The repo is not checked out locally, so the change is a patch: `patches/plastic-io-0001-build-before-test.patch` (apply with `git am`). | patch file |
| Not done | The four bare-`<script>` SFCs were **not** converted to `lang="ts"`: doing so adds them to the 505 rather than fixing anything; they are covered by PB-118. Nothing pushed; the workflows will first run when the branches are pushed. | — |
