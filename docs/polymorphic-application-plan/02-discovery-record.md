# 2. Discovery record

The full evidence ledgers are in the appendices: **A1** Graph Editor (GE-01..GE-65), **A2** Graph Server (GS-01..GS-43), **A3** TS scheduler + Rust runtime (RT-01..RT-43, with experiment transcripts), **A4** external references (MCP, V8 crate, AWS quotas, SDK versions), **A5** requirement inventory. This section is the map; the appendices are the territory.

## 2.1 Repository and commit inventory

| Repository (github.com/plastic-io/…) | Role | Revision inspected | Language / toolchain | Access |
|---|---|---|---|---|
| `graph-editor` | Graph Editor (Vue 3.3, Vite 4, Pinia 2, Vuetify 3, yjs 13.6.32, y-indexeddb 9, monaco 0.34) and the shared CRDT package `packages/GraphCrdt` (`@plastic-io/graph-crdt` 1.0.0, ships `.ts` sources) | `93d69d7d43c924d400f2aaec4b8831d411fd3497` (main, clean) | Node 18 in CI, Node 25.7 locally; TS 4.7 | local checkout + public |
| `graph-server` | Graph Server: Serverless v3, 33 Lambdas nodejs18.x/1024 MB, API Gateway WebSocket + REST, S3 only, yjs 13.6.32, `@plastic-io/plastic-io` **2.0.1**, `@plastic-io/graph-crdt` via `file:../graph-editor/packages/GraphCrdt` | `687022195e9b34ac586ac2421557253812530a04` (master, clean); deployed bundle built 2026-09-20T18:09:02Z matches HEAD `src/` (GS-38) | Node 18 runtime; TS 4.9; jest 26 | local checkout + `.serverless/` output |
| `plastic-io` | TypeScript scheduler/runtime `@plastic-io/plastic-io` | `c9e19bec88f97e291cb1b3e9f308c564a60dba59` (master) = npm **2.0.3** (byte-identical rebuild, RT-18); npm 2.0.1 = commit `08c7b6a` (RT-17) | TS; jest; meriyah 1.9.15, escodegen 1.14 | public clone |
| `plastic-io-rust` | Rust runtime prototype (`rusty_v8` 0.32.1 = V8 9.6, tokio 1.36 test-only) | `4fee99f897a87e287ad8ada8b3060ac1e32ad70e` (main, 19 commits Feb–Mar 2024) | cargo 1.98, rustc 1.98, arm64 macOS | public clone |
| `registry` | `@plastic-io/registry` 2.0.3 on unpkg; `index.json` → `standard/index.json` → `*_publishedNode.json` | `2ba3f3924b9b8d5f7ad496bba16abea487a3cf14` | JSON | public clone |
| `plastic-io-graph-coder` | VS Code extension talking to graph-server (WS `getGraph`, HTTP `toc.json`); reads an `apiKey` setting and never sends it (`src/extension.ts:11,156`) | `f4c9c3a8029aa725de06526df1723fb5f31fb917` | TS | public clone |
| `graph-client`, `graph-editor-vue-2`, `new-speak`, `automerge`, `vue-client`, `diff`, `media` | README-only, superseded editor, forks, assets — not on the execution or mutation path | listed 2026-09-20 via GitHub API | — | not inspected further |

Package version skew that matters: server `@plastic-io/plastic-io` 2.0.1 vs editor 2.0.3 (semantics differ, RT-19); `@types/node` 9.x in a Node 18 service; both consumers resolve meriyah 1.9.15 (no top-level `await` in node code, RT-05); MCP SDK v2 (`@modelcontextprotocol/server` 2.0.0, 2026-07-27) is the only line implementing the 2026-07-28 protocol (A4).

## 2.2 Reproducible commands and results

| # | Command (cwd) | Result on 2026-09-20 | Ledger |
|---|---|---|---|
| 1 | `npm run test:crdt` (graph-editor) | 6 files, **61/61 pass**, 0.7 s | GE-58, appendix/logs/test-crdt.log |
| 2 | `npm run test:integration` (graph-editor) | 1 file, **16/16 pass**, 3.5 s | GE-58, appendix/logs/test-integration.log |
| 3 | `npm run type-check` (graph-editor) | **fails, exit 2**, 4×TS6504 on virtual `*.vue.js` for SFCs with bare `<script>` (no `allowJs`); reproduced twice | GE-59, appendix/logs/type-check*.log |
| 4 | `npx jest` (graph-server) | 8 suites, **83/83 pass**, 5.4 s | GS-36 |
| 5 | `node scripts/build-dev-server.js && node .devserver/devServer.js` (graph-server, ports 3037–3039) | runs real `CrdtService`; `GET /toc.json` fails (`tocStore` not rewired); garbage WS frame accepted, stored, fanned out and poisons `GET /crdt/{id}/state` (500) | GS-13, GS-35 |
| 6 | `npm ci && npm run build && npm test` (plastic-io clone) | **27/27 pass**, 96.6 % lines | RT-16 |
| 7 | `git worktree add ../v201 08c7b6a && npm ci && npm run build && diff -r` vs server's installed dist | identical → server runs commit `08c7b6a` | RT-17 |
| 8 | `cargo build` / `cargo build --release` / `cargo test -- --test-threads=1` (plastic-io-rust clone) | build 13.4 s (prebuilt V8 static lib fetched from GitHub); **8+8+2 pass**; debug CLI panics on clap `-v` collision (release works) | RT-37/38 |
| 9 | Release CLI experiments (`fanout.json`, `twoedges.json`, `objvalue.json`, `infloop.json`, `return.json`, `await.json`, `console.json`) | fan-out routes to last connector; objects→`null`; unbounded loop → V8 fatal OOM exit 133; `return`/top-level `await` → compile error | RT-26/29/35/28 (transcripts in A3 appendices) |
| 10 | `curl api.github.com/orgs/plastic-io/repos` | 13 public repos, none archived | A4 |
| 11 | Static scan of `.serverless/cloudformation-template-update-stack.json` | 0 authorizers, 18 WS routes + 32 REST methods with `AuthorizationType: NONE`, IAM has no `cloudformation:*`/`codebuild:*`/`iam:*` | GS-01/02 |

Not run: cypress (scaffold spec only, GE-A.4), `test:e2e:crdt` stress suite (5-minute budget), any AWS call, any deploy.

## 2.3 Current-state architecture map

### 2.3.1 Edit path (browser → server → other browsers) [FACT]

```
gesture ─► Input store ─► mutation.ts action (edits graphSnapshot)
        ─► updateGraphFromSnapshot(desc)  [GE-16: no-op check, version++ (LWW), lastUpdate]
        ─► GraphCrdtSession.commit ─► reconcile(doc, snapshot, LocalOrigin(desc)) [GE-09]
        ─► Y transaction ─► doc.on('updateV2') ─┬─► IndexedDBCrdtProvider (history log, y-indexeddb V1)
                                               └─► WssCrdtProvider: merge 150 ms ─► {action:'yjs',kind:'sync',graphId,payload,description,format:2}
                                                    (>28 000 B base64 → POST /crdt/{id}/update)           [GE-25]
 server: handler.crdtSync ─► CrdtService.handleMessage: graphId present? format===2 if given? ─► appendUpdate (S3 ULID key, bytes unparsed)
         ─► fanOut to subscriptions/graph-crdt-{id}/* except sender ─► maybeCheckpoint (≤10 s: snapshot + 3 JSON projections + TOC)  [GS-13..20]
 other browsers: WssCrdtProvider.onMessage ─► session.applyRemote ─► afterTransaction ─► applyProjection ─► scheduler worker re-init [GE-36]
```
No identity, no validation of content, no ack, no reject, no resync after reconnect (GE-23/24, GS-05/13).

### 2.3.2 Execution paths [FACT]

```
Browser:  UI emit / impulse ─► scheduler.instance.url(nodeUrl, value, field, hostNode) ─► Web Worker ─► Scheduler 2.0.3
          set code = new AsyncFunction(scheduler, graph, cache, node, field, state, value, edges, data, properties, require) + Worker globals
          events ─► main thread ─► activityConnectors (edge animation), errors[nodeId]                                   [GE-35..44]
Server:   HTTP ANY /{proxy+} or WS $default/unknown action ─► graphService.init ─► GET graphs/projections/endpoints/<url>.json (dev)
          ─► worker_threads Worker ─► Scheduler 2.0.1 with this={openai,event,context,callback,AWS,console} + host require
          ─► events on WS channel graph-notify-{graphId}; HTTP response always 200 "ok"                                  [GS-27..30]
Rust:     CLI only; not called by anything                                                                              [RT-40]
```

### 2.3.3 Deployment [FACT]
Serverless v3 from a developer machine (`npx serverless deploy --aws-profile …`), account 695527765921, us-west-1, stage `dev`, stack `plastic-io-graph-server`; one 9.2 MB bundle for 33 functions; S3 bucket `plastic-io-graph-server` is the only store; IAM = logs + S3 on that bucket + `execute-api:ManageConnections` + one Secrets Manager secret + one Lambda layer (GS-02/03). Editor is a static GitHub Pages build; its public default is **local-only** (`useLocalStorage=true`, GE-29) and a remote `appConfig` on unpkg can rewrite its preferences (GE-30).

## 2.4 Repository responsibility table and canonical ownership

| Concern | Canonical owner today [FACT] | Consumers | Propagation of changes | Target owner [PROPOSED] |
|---|---|---|---|---|
| Graph document types | `plastic-io/src/{Shared,Node,Edge}.ts` (published as `.d.ts`) | editor (type imports + 3 runtime value imports GE-B.1), server, Rust (hand-copied structs RT-21) | npm publish → bump pins in both consumers; Rust is manual | new package `@plastic-io/graph-schema` (JSON Schema + TS types generated; Rust types generated by `typify`/`schemars` from the same schema) — see §5.3 |
| Yjs layout, codec, reconcile, wire protocol | `graph-editor/packages/GraphCrdt` | editor, server (via `file:` link, compiled from TS source) | editing the editor checkout changes the server build silently (GS-A.1) | publish `@plastic-io/graph-crdt` to npm with a version; server pins it |
| Authorization policy | absent | — | — | server `policy/` module + ACL documents; editor and MCP only display |
| Event/mutation envelope | `YjsEnvelope` in `GraphCrdt/schema.ts` (no actor/id) | editor, server | as above | `MutationEnvelope` in `graph-crdt` (§5.1) |
| Runtime protocol (events) | `plastic-io` `SchedulerEvent`s | server (`graph-notify` channel), editor (worker messages) | none — informal | `Observation` envelope in `graph-schema`; runtimes emit it |
| Published component contract | `{inputs,outputs}` in `node.properties` + artifact JSON | editor, registry, server publish | none | `ComponentManifest` in `graph-schema` (§4.3) |
| Infrastructure | `graph-server/serverless.yaml` | AWS | manual deploy | unchanged for the substrate; IaC component for application infra (§4.9) |

Duplicate models / implicit contracts / dead paths that could invalidate the design (all [FACT], details in A1 §J, A2 §I, A3 §G): the server executes the *unpublished* checkpoint (`STAGE=dev`) while the production key it would read is never written (GS-27); linked graphs are pre-flattened in the browser but cannot load on the server (GE-47, GS-31); `graph.version` is both an LWW counter and the artifact key (GE-51); the `panic` route cannot stop anything (GS-12); the `broadcast` WS route has no handler (GS-04); `S3Service.list` cannot page beyond 1000 keys (GS-37); `sendToChannel` lets any socket forge CRDT frames (GS-06); six editor panels are empty stubs and seven referenced actions do not exist (GE-45/61).

## 2.5 Capability inventory (effects reachable by node code today) [FACT]

| Effect | Browser `set` code (worker) | Browser Vue template (main thread) | Server node code | Reached through an edge? |
|---|---|---|---|---|
| Network | `fetch`, `WebSocket`, `importScripts` (Worker globals) | `fetch`, DOM, `window.OpenAI` (GE-02) | `fetch` (Node 18), `require('http')`, `openai` client with the account key (GS-29/42) | No — ambient |
| Storage | `indexedDB` | `localStorage`, IndexedDB | `AWS.S3` with the Lambda role (bucket-wide r/w/d), filesystem via `require('fs')` | No — ambient |
| Cloud credentials | — | — | Lambda role env credentials via `AWS` namespace | No — ambient |
| Secrets | — | — | `this.openai` / `global.openai` (Secrets Manager value fetched on every run) | No — ambient |
| Dynamic code / modules | `importScripts`, `eval` | `import()` of `data:` URLs (GE-39), `properties.scripts` `<script>` injection (GE-42) | `require` (host CommonJS) | No |
| Timers / process | `setTimeout` | `setTimeout` | `setTimeout`, `process`, `child_process` (+ git layer on `$default`) | No |
| Graph mutation | — | every Pinia store + `transact` (GE-40) | — | No |
| Other nodes / shared state | `state` (shared object), `scheduler` (whole API incl. `url`), `cache` | `scheduler.instance.url` | same as worker | Partly — `edges` is the only *edge* binding; `state` is a side channel |
| WebSocket clients | — | — | `AWS.ApiGatewayManagementApi` → any connection (`ManageConnections *`) | No |

Conclusion for R-2.4/R-7.1: the intended statement "edges are the bindings and there are no hidden effect channels" is **false today in every domain**; §4.5 defines the capability host that makes it true and the observation model that makes it visible.

## 2.6 Glossary (brief term → code term)

| Brief term | Code term and definition | Where | Notes |
|---|---|---|---|
| Graph | `Graph {id, url, nodes, properties, version}` | `plastic-io/src/Shared.ts:214-220` | Y layout: root `Y.Map("graph")`, `nodes: Y.Map<id, Y.Map>` (`GraphCrdt/codec.ts:173-200`) |
| Node | `Node {id, linkedGraph?, linkedNode?, edges, version, graphId, url, data, properties(any), template{set,vue}, __contextId}` | `plastic-io/src/Node.ts:30-61`; editor shape `Graph/mutation.ts:724-771` | `properties` carries ports, layout, tags, scripts |
| Port | editor `{name, type, external, visible}` in `properties.inputs/outputs`; scheduler `FieldMap {id, field, type, external}` for linked-graph boundaries | `Graph/connectors.ts:53-83`; `Shared.ts:46-55` | Every output has exactly one `Edge` named after it |
| Edge | `Edge {field, connectors[]}` on the **source** node | `plastic-io/src/Edge.ts:6-11` | Yjs `edges: Y.Map<field, {field, connectors: Y.Array}>` |
| Hyperedge | an `Edge` with `connectors.length > 1` (fan-out in array order, RT-06); fan-in = several connectors targeting one `(nodeId, field)`, each an independent invocation (no join, RT-08) | `plastic-io/src/Node.ts:246-298` | Rust: broken (RT-26) |
| Connector | `Connector {id, nodeId, field, graphId, version}` — a directed hop to a target field, possibly in another graph | `Shared.ts:33-44`; created `Input/mouse.ts:233-257` | `version` is a weak pin, unchecked in 2.0.3 |
| Published component | artifact `{node}`/`{graph}` at `graphs/projections/published/artifacts/<id>.<version>.json`; registry entry `{id, version, type, artifact}` | `eventSourceService.ts:425,517`; registry repo | overwritable (GS-26); no digest |
| Instance | `Node` with `linkedNode {id, version, node, loaded}` or `linkedGraph {id, version, graph (embedded copy), fields}` and `artifact: "artifacts/{id}.{version}"` | `Graph/mutation.ts:182-370` | embedded whole; opaque in Yjs (`schema.ts:82`) |
| Mutation (semantic intent) | an editor action + its description string, or (proposed) a `MutationOp[]` from an agent | `Graph/mutation.ts` | only the description survives today |
| Application event (legacy) | `GraphDiff {time, crc, description, changes}` deep-diff events | `DocumentProvider/main.ts`; server `addEvent` | deprecated path, still deployed (GS-24) |
| CRDT update | Yjs **V2** update from one transaction; wire `YjsEnvelope {action:'yjs', graphId, kind, payload, description?, format?, origin?}` | `GraphCrdt/updates.ts`, `schema.ts:106-123` | no actor / id / base (GE-23) |
| Runtime observation | scheduler events (`begin, beginedge, endedge, set, afterSet, beginconnector, endconnector, error, warning, load, end`) | `plastic-io/src/Scheduler.ts:231-238` call sites (RT-09) | not persisted; server forwards on `graph-notify-{id}` |
| Revision | **absent**; nearest: LWW `graph.version`, ULID `updateId` history (`/crdt/{id}/history`), snapshot `headId` | `crdtStore.ts:259-281` | proposed `Revision` §4.7 |
| Editable collaborative state | the live `Y.Doc` per graph (`GraphCrdtSession`) replicated over WS/HTTP, persisted V1 in IndexedDB and V2 in S3 | `Graph/crdt.ts:88-162` | |
| Active execution revision | **absent**: browser runs the 250 ms-debounced snapshot (GE-36); server runs the ≤10 s checkpoint projection (GS-20/27) | — | proposed activation pointer §4.7 |
| Capability | **absent** as a type; today = whatever the host realm exposes (§2.5) | — | proposed `CapabilityGrant` §4.5 |
| Observation vs capability | observation = seeing an event/payload; capability = authority to connect/invoke/effect. Today both are all-or-nothing per socket (GS-06) | — | §4.4/4.5 separate them |
