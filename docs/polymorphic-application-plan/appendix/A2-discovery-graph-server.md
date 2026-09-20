# Graph Server — current-state discovery record

Repo: `/Users/tonygermaneri/gh/graph-server` @ `687022195e9b34ac586ac2421557253812530a04` (branch `master`, tree clean before and after this survey; verified `git status --short` empty).
Survey date: 2026-09-20. Nothing under the repo was modified; scratch output lives under the session scratchpad only. No AWS calls were made; deployment evidence is the committed `.serverless/` output of the last `serverless deploy`.

Verification vocabulary used below: **static** = read the cited lines; **traced** = followed the call chain across the cited files; **test** = `npx jest` run in this session; **local** = `npm run dev-server` equivalent run in this session (bundle built with `node scripts/build-dev-server.js`, server started on ports 3037/3038/3039, killed afterwards, `pgrep` confirmed none left); **cf** = read from `.serverless/cloudformation-template-update-stack.json` / `serverless-state.json`; **bundle** = unzipped `.serverless/plastic-io-graph-server.zip` into the scratchpad and grepped `src/handler.js`.

---

## A. Inventory and deployment

### A.1 package.json (`package.json:1-43`)

| Dep | Declared | Installed (`node_modules/*/package.json`) | Lockfile (`package-lock.json`, lockfileVersion 2) | Used by (static grep) |
|---|---|---|---|---|
| `yjs` | `^13.6.27` (l.42) | 13.6.32 | 13.6.32 | `crdtService.ts:1`, `crdtStore.ts:1`, `tocStore.ts:1`, and via `@plastic-io/graph-crdt` |
| `y-protocols` | `^1.0.6` (l.41) | 1.0.7 | 1.0.7 | **unused** — no import in `src/*.ts` nor in `node_modules/@plastic-io/graph-crdt/*.ts` (only a doc comment at `graph-crdt/schema.ts:112`). The sync protocol is home-grown on `lib0` (`graph-crdt/protocol.ts:1-2,22-49`). |
| `lib0` | `^0.2.99` (l.38) | 0.2.117 | 0.2.117 | `graph-crdt/protocol.ts:1-2` (peer dep of graph-crdt) |
| `ulid` | `^2.3.0` (l.40) | 2.4.0 | 2.4.0 | `crdtStore.ts:2,37` (`monotonicFactory`) |
| `openai` | `^4.11.0` (l.39) | 4.11.0 | 4.11.0 | `graphService.ts:7,401-404` |
| `@aws-sdk/client-secrets-manager` | `^3.421.0` (l.32) | 3.421.0 | 3.421.0 | `graphService.ts:15-18,31-50` |
| `aws-sdk` (v2) | `^2.684.0` **under devDependencies** (l.17) | 2.1261.0 | 2.1261.0 | runtime use in `s3Service.ts:2`, `broadcastService.ts:2`, `graphService.ts:12`; it is webpack-bundled into `src/handler.js` (bundle contains the aws-sdk apigatewayv2 API model, e.g. the string `DefaultRouteSettings`), so the devDependency placement is only a categorisation smell |
| `deep-diff` | `^1.0.2` (l.35) | 1.0.2 | 1.0.2 | only the deprecated `EventSourceService.add` (`eventSourceService.ts:2,186,214`) |
| `flatted` | `^3.2.9` (l.36) | 3.2.9 | 3.2.9 | imported at `graphService.ts:10` (`toJSON`) and **never used** |
| `jshashes` | `^1.0.8` (l.37) | 1.0.8 | 1.0.8 | only deprecated `add` (`eventSourceService.ts:3,198,215`) |
| `@plastic-io/plastic-io` | `2.0.1` pinned (l.34) | 2.0.1 (dist only: `dist/{Edge,Loader,Node,Scheduler,Shared,index}.js` + `.d.ts`) | 2.0.1 | `graphService.ts:8`, `graphExecutionService.ts:1` |
| `@plastic-io/graph-crdt` | `file:../graph-editor/packages/GraphCrdt` (l.33) | symlink `node_modules/@plastic-io/graph-crdt -> ../../../graph-editor/packages/GraphCrdt`, version 1.0.0, `main: ./main.ts` (TypeScript source, no build) | `link: true` | `crdtService.ts:2-17`, `crdtStore.ts:3-8`, `tocStore.ts:2-8`, `eventSourceService.ts:4` |

Editor skew: `/Users/tonygermaneri/gh/graph-editor/package.json:33` pins `@plastic-io/plastic-io` **2.0.3**; `diff -r` of the two `dist/` trees shows 4 files differ (`Edge.d.ts`, `Edge.js`, `Node.js`, `Scheduler.js`), 370 changed lines; e.g. `Edge.execute` return type `Promise<any>` (2.0.1) vs `Promise<void>` wrapped in an explicit `new Promise` that rejects on error (2.0.3). The server therefore runs a different scheduler build than the editor previews with. (static: `diff -r` output.)

Dev deps (`package.json:10-29`): serverless 3.25.0, serverless-webpack 5.11.0, webpack 5.75.0, ts-loader 9.4.1, typescript 4.9.3, jest 26.0.1, babel-jest 26.0.1, ws 8.21.3, `@types/node` **9.6.61** (l.15; the runtime is Node 18), handlebars 4.7.7 and typedoc 0.23 (no runtime use; `build-docs` script l.7). Scripts (l.5-9): `test: jest`, `dev-server: node scripts/build-dev-server.js && node .devserver/devServer.js`.

Toolchain versions on this machine: `node v25.7.0`, `npm 11.10.1` (local). Lambda runtime: `nodejs18.x` (`serverless.yaml:6`; cf: every `AWS::Lambda::Function` has `Runtime: nodejs18.x`). Tests therefore run on Node 25 while production runs Node 18.

### A.2 tsconfig / webpack / jest / babel

- `tsconfig.json:2-15`: `module: commonjs`, `moduleResolution: node`, `target: es2019` (comment l.7-10 explains that ES3 downlevel silently emptied `[...map.keys()]`), `lib: [es2019, esnext.asynciterable]`, `inlineSourceMap`. `include` (l.20-23) names `src/**/*.ts` **and** `node_modules/@plastic-io/graph-crdt/*.ts` because the CRDT package is linked as TS source.
- `webpack.config.js:5-20`: entries from `slsw.lib.entries`; **`resolve.symlinks: false`** (l.12) with the rationale at l.7-11: keep the linked package resolving as `node_modules/@plastic-io/graph-crdt` so its `yjs` import binds to this project's copy; following the symlink would pull the editor's `yjs` and produce two Yjs instances, breaking the codec's `instanceof` checks. `ts-loader` with `allowTsInNodeModules: true` (l.31-38). Output `libraryTarget: commonjs`, `target: node` (l.21-26). Verified effect in the deployed bundle: exactly **one** occurrence of the Yjs duplicate-import banner string `Yjs was already imported` in `src/handler.js` (bundle).
- `jest.config.cjs:8` `transformIgnorePatterns: ["/node_modules/(?!(lib0|yjs|y-protocols|@plastic-io/graph-crdt)/)"]`; `:9` extensions js/ts/json/node; `:10` `setupFiles: jest.setup.js`; `:16-19` `moduleNameMapper` pins `^yjs$` and `^lib0/(.*)$` to this repo's `node_modules` (same single-Yjs concern as webpack, but for the symlinked source); `:30` `clearMocks: true`; `:147` `testEnvironment: node`. `jest.setup.js:5-16` bridges `crypto.webcrypto`, `TextEncoder`, `TextDecoder` onto `global` for lib0. `babel.config.json:1-13` = preset-env (node current) + preset-typescript. `__mocks__/aws-sdk.js` is auto-mocked for `aws-sdk` (root `__mocks__`, jest 26 automock of node_modules packages).

### A.3 serverless.yaml (`serverless.yaml:1-402`) — every function

Provider (l.4-48): `runtime: nodejs18.x`, `versionFunctions: false`, `stackName: plastic-io-graph-server`, `stage ${opt:stage,'dev'}`, `region ${opt:region,'us-west-1'}`, `websocketsApiName: plastic-<stage>-plastic-ws` (l.48). `custom.s3Bucket = plastic-io-graph-server` (l.50-52). Plugins: only `serverless-webpack` (l.2-3). No `package.individually`, so one bundle serves all functions (zip contains exactly `src/handler.js` 9,225,274 bytes + `src/handler.js.LICENSE.txt`; bundle listing).

Environment (l.39-46): `API_REGION`, `S3_BUCKET`, `STAGE`, `CHECKPOINT_INTERVAL_MS` (`${opt:checkpointInterval,'10000'}`), `NODE_OPTIONS="--enable-source-maps --unhandled-rejections=warn"`. cf: identical `Environment.Variables` on every function (`API_REGION=us-west-1`, `S3_BUCKET=plastic-io-graph-server`, `STAGE=dev`, `CHECKPOINT_INTERVAL_MS=10000`).

| Function (yaml lines) | Handler export | Trigger | Timeout (yaml → cf) |
|---|---|---|---|
| connect (56-60) | `handler.connect` | WS `$connect` | default → 6 |
| disconnect (62-66) | `handler.disconnect` | WS `$disconnect` | 6 |
| subscribe (68-72) | `handler.subscribe` | WS `subscribe` | 6 |
| unsubscribe (74-78) | `handler.unsubscribe` | WS `unsubscribe` | 6 |
| sendToConnection (80-84) | `handler.sendToConnection` | WS `sendToConnection` | 6 |
| sendToChannel (86-90) | `handler.sendToChannel` | WS `sendToChannel` | 6 |
| **broadcast (92-96)** | `handler.broadcast` — **does not exist**: not in the export list `handler.ts:109-141`, and the deployed bundle's export chain `e.panic=e.defaultRoute=…=e.connect=e.publishNodeWs=…` has no `e.broadcast` (bundle grep, 0 matches for `broadcast:()=>`/export). Invoking WS route `broadcast` will fail with a missing-handler runtime error. | WS `broadcast` | 6 |
| addEvent (98-110, marked DEPRECATED) | `handler.addEvent` | WS `addEvent` **and** HTTP `POST /addEvent` cors `*` | 30 |
| listSubscribers (112-116) | `handler.listSubscribers` | WS `listSubscribers` | 6 |
| listSubscriptions (118-122) | `handler.listSubscriptions` | WS `listSubscriptions` | 6 |
| graphWs (124-128) | `handler.getGraphWs` | WS `getGraph` | **6** (no timeout set, yet it projects a whole Yjs doc from S3 — see D.7) |
| publishNodeWs (130-135) | `handler.publishNodeWs` | WS `publishNode` | 30 |
| publishGraphWs (137-142) | `handler.publishGraphWs` | WS `publishGraph` | 30 |
| deleteGraphWs (144-149) | `handler.deleteGraphWs` | WS `deleteGraph` | 30 |
| events (151-164) | `handler.getEvents` | HTTP `GET /events/{id}` — declares path params `id: true` **and `version: true`** (l.160-162) though the path has no `{version}` | 30 |
| artifact (166-179) | `handler.getArtifact` | `GET /artifacts/{id}/{version}` | 30 |
| graph (181-194) | `handler.getGraph` | `GET /graph/{id}/{version}` | 30 |
| toc (196-204) | `handler.getToc` | `GET /toc.json` | 30 |
| deleteGraph (210-224) | `handler.deleteGraph` | `DELETE /graph/{id}` + querystring `permanent` | 30 |
| undeleteGraph (226-238) | `handler.undeleteGraph` | `POST /graph/{id}/restore` | 30 |
| tocState (242-254) | `handler.getTocState` | `GET /toc/state?sv=` | 30 |
| tocRebuild (258-266) | `handler.rebuildToc` | `POST /toc/rebuild` | **300** |
| deletedGraphs (268-276) | `handler.listDeletedGraphs` | `GET /deleted.json` | 30 |
| undeleteGraphWs (278-283) | `handler.undeleteGraphWs` | WS `undeleteGraph` | 30 |
| crdtSync (288-293) | `handler.crdtSync` | WS `yjs` | 30 |
| crdtState (295-307) | `handler.crdtState` | `GET /crdt/{id}/state` | 30 |
| crdtStateAt (309-322) | `handler.crdtStateAt` | `GET /crdt/{id}/state/{updateId}` | 30 |
| crdtHistory (324-336) | `handler.crdtHistory` | `GET /crdt/{id}/history` | 30 |
| crdtUpdate (338-350) | `handler.crdtUpdate` | `POST /crdt/{id}/update` | 30 |
| crdtCheckpoint (352-364) | `handler.crdtCheckpoint` | `POST /crdt/{id}/checkpoint` | 60 |
| panic (366-371) | `handler.panic` | WS `panic` | 6 |
| default (374-381) | `handler.defaultRoute` | WS `$default`; **only function with the layer** `arn:aws:lambda:${region}:553035198032:layer:git-lambda2:8` (l.376-377) | 30 |
| httpDefault (383-391) | `handler.defaultRoute` | HTTP `ANY /{proxy+}` cors `*` (no layer) | 30 |

Every HTTP event carries `cors: origin: '*'`. cf confirms: 32 `AWS::ApiGateway::Method` (16 MOCK OPTIONS + 16 AWS_PROXY), and the OPTIONS integration response headers are `Access-Control-Allow-Origin: '*'`, `Allow-Headers: 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,X-Amzn-Trace-Id'`, `Allow-Methods: 'OPTIONS,DELETE,GET,HEAD,PATCH,POST,PUT'`. (The word "Authorization" appears in the template only inside that allowed-headers list.)

**git layer**: `grep -rnE '\bgit\b|execSync|child_process|spawn|exec\('` over `src/*.ts` finds nothing except two `RegExp.exec` calls (`crdtStore.ts:105,114`). Nothing in `src` shells out or references git. The layer was added in commit `b38e3d9` ("added git cli. Fixed HTTP get graph bug", 2024-01-27) with no code using it (`git show b38e3d9 --stat`: serverless.yaml, eventSourceService.ts, graphExecutionService.ts, graphService.ts; the only git-related hunks are the IAM statement and the `layers:` lines). Presumably meant for node code doing `require('child_process')` to run git — it is available only in the WS `$default` function, not `httpDefault`.

IAM (`serverless.yaml:11-38`, cf `IamRoleLambdaExecution.Policies[0].PolicyDocument.Statement`), exactly:
1. `logs:CreateLogStream`, `logs:CreateLogGroup` on `/aws/lambda/plastic-io-graph-server-dev*:*` (added by the framework)
2. `logs:PutLogEvents` on the same log groups
3. `lambda:GetLayerVersion` on `arn:aws:lambda:us-west-1:553035198032:layer:git-lambda2:8`
4. `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` on `arn:aws:s3:::plastic-io-graph-server/*`
5. `s3:ListBucket` on `arn:aws:s3:::plastic-io-graph-server`
6. `execute-api:ManageConnections` on `arn:aws:execute-api:*:*:**/@connections/*` (any account/region/API)
7. `secretsmanager:GetSecretValue` on `arn:aws:secretsmanager:us-west-1:695527765921:secret:OPENAI_API_KEY-kcvByO`
8. `execute-api:ManageConnections` on `arn:${Partition}:execute-api:*:*:*/@connections/*` (framework-added duplicate of 6)

There are **no** `cloudformation:*`, `codebuild:*`, `iam:PassRole`, `iam:*`, `dynamodb:*` grants: a text search of the whole template gives 0 occurrences of `cloudformation:`, `codebuild:`, `iam:PassRole`, `iam:`, `dynamodb:`. `sts:AssumeRole` occurs once, only in the role's trust policy for `lambda.amazonaws.com`. `lambda:InvokeFunction` occurs 34 times, all in `AWS::Lambda::Permission` resources whose principal is `apigateway.amazonaws.com`. (cf.)

Resources (`serverless.yaml:393-402`): `StaticSite` = `AWS::S3::Bucket` `plastic-io-graph-server`, `AccessControl: Private` (cf confirms); plus the framework's `ServerlessDeploymentBucket` (AES256, bucket policy denying non-TLS `s3:*`). Output `Prefix: plastic`.

### A.4 Deployment evidence (`.serverless/`)

- `cloudformation-template-update-stack.json`: 201 resources — 33 `AWS::Lambda::Function` (all `MemorySize: 1024`, `Runtime: nodejs18.x`), 33 log groups, 34 Lambda permissions, 1 IAM role, 1 `AWS::ApiGatewayV2::Api` (`Name: plastic-dev-plastic-ws`, `ProtocolType: WEBSOCKET`, `RouteSelectionExpression: $request.body.action`), 18 `ApiGatewayV2::Route`, 18 `ApiGatewayV2::Integration` all `IntegrationType: AWS_PROXY` to the function ARN, 1 WS stage `dev`, 1 `ApiGateway::RestApi` (`dev-plastic-io-graph-server`, `EDGE`), 23 resources, 32 methods, 1 deployment (stage `dev`), 1 request validator (`ValidateRequestParameters: true`, `ValidateRequestBody: true`), 2 buckets, 1 bucket policy.
- **Authorizers: absent.** No resource of type `AWS::ApiGatewayV2::Authorizer` or `AWS::ApiGateway::Authorizer`. Every one of the 18 WS routes and 32 REST methods has `AuthorizationType: NONE` and no `AuthorizerId`; `ApiKeyRequired: false` on the AWS_PROXY methods. (cf, programmatic scan.)
- WS route keys: `$connect $disconnect subscribe unsubscribe sendToConnection sendToChannel broadcast addEvent listSubscribers listSubscriptions getGraph publishNode publishGraph deleteGraph undeleteGraph yjs panic $default` (cf).
- `serverless-state.json`: `package.artifactDirectoryName = serverless/plastic-io-graph-server/dev/1789927742670-2026-09-20T18:09:02.670Z`; 33 functions with the timeouts above; `provider.iamRoleStatements` identical to the yaml; `frameworkVersion` not recorded. The package was built at 18:09:02Z; HEAD (`6870221`) is committed 18:12:08Z and touches only `README.md` (git show --stat), so the bundle corresponds to HEAD's `src/`. Bundle markers confirming the current toc store shipped: `root:"index"` ×1, `graphs/projections/deleted.json` ×1, `crdt/v${…}` ×2 (bundle grep).

---

## B. Request entry and principal resolution

### B.1 Handlers (`src/handler.ts:1-141`)

Four module-level singletons are created at import time (`handler.ts:5-8`): `BroadcastService`, `EventSourceService`, `CrdtService`, `GraphService` (each constructing its own `S3Service`/`aws-sdk` clients; they persist across warm invocations). Every exported handler is a one-line delegate `(event, context, callback)`:

- Broadcast: `connect`, `disconnect`, `subscribe`, `unsubscribe`, `sendToChannel`, `sendToConnection`, `listSubscribers`, `listSubscriptions` (l.9-26, 60-65).
- Event-source/legacy + toc: `addEvent`, `getGraph`, `getToc`, `getEvents`, `deleteGraph`, `deleteGraphWs`, `undeleteGraph`, `undeleteGraphWs`, `listDeletedGraphs`, `getTocState`, `rebuildToc`, `getGraphWs`, `publishGraphWs`, `publishNodeWs`, `getArtifact` (l.27-74, 87-89).
- Execution: `defaultRoute` (l.75-83) calls `graphService.init(event, context)` and **always** answers `{statusCode: 200, body: "ok"}` — both on resolve (l.78) and on rejection (l.81). `panic` (l.84-86) delegates to the exported `panic` in `graphService.ts:55`.
- CRDT: `crdtSync`, `crdtState`, `crdtStateAt`, `crdtHistory`, `crdtUpdate`, `crdtCheckpoint` (l.91-108).
- Export list l.109-141 (31 names). `broadcast` is not among them (see A.3).

What is parsed from the event (static, per service):
- WS handlers read `event.requestContext.connectionId` / `.domainName` and `JSON.parse(event.body)` (e.g. `broadcastService.ts:153-154`, `crdtService.ts:152-154`, `eventSourceService.ts:333-335`).
- HTTP handlers read `event.pathParameters.{id,version,updateId}` and `event.queryStringParameters.{sv,permanent}` (`crdtService.ts:243-244,291,307-308,331`, `eventSourceService.ts:55,128,540,621,730-738,760`).
- `graphService.init` (l.172-190) distinguishes WS vs HTTP by `!event.path`; for HTTP it uses `event.path`, for WS `body.{graphUrl,nodeUrl,field,value}`.
- Headers are never read by any handler (grep `headers` in src: only the CORS *response* headers). `$connect`'s whole event (which, per API Gateway WebSocket semantics, carries the upgrade request headers and query string) is persisted verbatim to S3 (`broadcastService.ts:90`), as is the `subscribe` event (l.158,163).

### B.2 Identity extraction — verbatim grep results

`grep -rniE 'jwt|auth|token|\buser|owner|permission|\bacl\b|principal|cookie' src/*.ts` (non-test) yields only:
- `devServer.ts:9` comment "nothing here authenticates"; `devServer.ts:149,229` fabricate `identity.userArn = "dev:<connectionId>"` / `"dev:http"`.
- `crdtService.ts:31-37` `userIdOf(event)` = `ctx.identity.userArn || ctx.connectionId || "Unknown"`; used at l.211 and l.344 only as a *label* stored in the update's object key/metadata.
- `eventSourceService.ts:337` `event.userId = ctx.identity.userArn || "Unknown userArn"`; `:411,484,515` same for publish; `:740,808` `userId = requestContext.identity.userArn` for soft delete (stored as `deletedBy`).
- All other hits are the `userId` *label* plumbing in `crdtStore.ts`, `tocStore.ts`, `tocService.ts`.
- No hit for `jwt`, `auth0`, `token`, `Authorization`, `cookie`, `permission`, `owner`, `acl`, `principal`, `sub`.

`requestContext.identity.userArn` is only populated by API Gateway when the route uses IAM (SigV4) authorization; with `AuthorizationType: NONE` everywhere (A.4) it is null (AWS behaviour, not runtime-verified here). Hence in production every legacy/publish write is attributed to the literal string `"Unknown userArn"` and every CRDT update to the sender's `connectionId`.

**No permission check exists.** Files checked for any authorisation branch: `handler.ts`, `broadcastService.ts`, `crdtService.ts`, `crdtStore.ts`, `tocStore.ts`, `tocService.ts`, `eventSourceService.ts`, `graphService.ts`, `s3Service.ts`, `devServer.ts` — absent in all.

### B.3 Effective trust model (stated plainly)

Any network client that can reach the WebSocket URL (`wss://<WebsocketsApi>.execute-api.us-west-1.amazonaws.com/dev`) or the REST URL (`https://<RestApi>.execute-api.us-west-1.amazonaws.com/dev`) may, without any credential:
- open a socket and subscribe to **any** channel id (`broadcastService.ts:152-175` only requires `body.channelId`), including `graph-crdt-<graphId>` (`graph-crdt/protocol.ts:85-87`), `graph-notify-<graphId>` (`graphService.ts:134`), `graph-event-<graphId>` (`eventSourceService.ts:259`) and `graphs/projections/toc.json` (`tocService.ts:11,19`);
- inject an arbitrary message into any channel via `sendToChannel` (`broadcastService.ts:324-333`) — its envelope `{channelId, response: value}` (l.317-323) is byte-for-byte the same shape `CrdtService.fanOut` uses (`crdtService.ts:76-90`), so a client can forge `{kind:"sync"|"awareness", graphId, payload}` to every peer of any graph without the server storing anything;
- read/write/poison the Yjs document of **any** graph id (D.3, D.9), soft- or permanently delete any graph (E.4), publish any graph/node (E.3), rebuild the list (I), and execute any graph's node code on the server with the Lambda role's credentials (F.6).
- CORS `*` on every HTTP route means a browser on any origin can do the HTTP subset.

---

## C. WebSocket connection, subscription and fan-out (`src/broadcastService.ts:1-353`)

### C.1 Storage model — everything is an S3 key; nothing is in memory
- `connect` (l.88-96): `store.set("connections/<connectionId>/<domainName>", event)` — fire-and-forget (callback returns 200 before the PUT completes, l.95).
- `subscribe` (l.152-175): requires `body.channelId` (throws `TypeError` otherwise, l.155-157 — an uncaught throw inside a Lambda callback handler → 500/`Internal server error` to the socket). Writes two keys, both fire-and-forget: `subscriptions-reverse/<connectionId>/<channelId>/<domainName>` (l.158) and `subscriptions/<channelId>/<connectionId>/<domainName>` (l.163); then posts `{subscribed: channelId}` back to the caller (l.168).
- `unsubscribe` (l.128-151): deletes both keys; posts `{unsubscribed: channelId}`.
- `disconnect`/`_disconnect` (l.97-127): removes the connection key, lists `subscriptions-reverse/<connectionId>` (l.103, via `_listSubscriptions` l.227-235) and deletes each forward+reverse key (l.104-120).
- A "channel" is therefore just the string used as the middle path segment; subscribers are discovered by `S3.listObjects(prefix="subscriptions/<channelId>")` (`_listSubscribers` l.236-244 → `s3Service.list` l.103-123).

### C.2 Delivery — `postToClient` (l.33-87)
- Creates a fresh `ApiGatewayManagementApi` client per chunk with `endpoint = https://<domainName>/<STAGE>` (l.49-52; `STAGE` from env l.5).
- Serialises with a circular-reference replacer (l.34-45). Messages longer than `CHUNK_SIZE = 35000` chars (l.7) are split into `{chunkCollectionId, totalLength, chunkSize, parts, part, value}` objects (l.17-32, 73-85), each posted separately; `chunkCollectionId` comes from `newId()` imported from `eventSourceService.ts:27`.
- Error handling (l.58-68): HTTP **410 → `_disconnect(domainName, connectionId)`** (stale connection cleanup, l.58-60); **429 → retry with linear backoff** `+35 ms` per attempt, unbounded (l.61-64); any other error is logged and then **`callback(null, okResponse)` is still invoked** (l.65-68) — delivery failures are invisible to callers.
- `broadcast(channelId, value, callback, excludeConnectionId?)` (l.186-226): lists subscribers, maps key segments `path[2]=connectionId, path[3]=domainName` (l.192-195), filters out `excludeConnectionId` (l.195-200), calls back once when no targets (l.201-203; comment l.176-185 records that this used to hang the Lambda) and otherwise once after the first callback per recipient (l.204-224; `settled` guards the per-chunk multi-callback).
- `_sendToChannel(channelId, value, cb, exclude?)` (l.317-323) wraps as `{channelId, response: value}`; `sendToChannel` handler (l.324-333) forwards `body.channelId`/`body.value` **with no exclusion and no validation**, returning 200 immediately.
- `sendToConnection` (l.334-352): posts `{to, from: ctx.connectionId, response: body.value}` to `body.connectionId` at `body.domainName || ctx.domainName` — a client may name any connection id and domain.
- `listSubscribers` (l.245-268): **bug** — it calls `_listSubscriptions(body.channelId)` (l.251), i.e. lists prefix `subscriptions-reverse/<channelId>`, which is keyed by connection id, so it always answers with an empty list for a channel id; its error string also says `sendToChannel:` (l.249). Reply envelope `{messageId, response}` (l.256-259).
- `listSubscriptions` (l.269-292): throws unless `body.connectionId` present (l.272-274), then lists `subscriptions-reverse/<body.connectionId>` — any client can enumerate any other connection's subscriptions.
- `sendToAll`/`_sendToAll` (l.293-316): dead code — no handler export references it (grep). Would post to every `connections/` key.

### C.3 Envelopes sent to clients (static)
- Direct replies: `{subscribed}`, `{unsubscribed}`, `{messageId, response}`, `{messageId, error: true, response: {err}}`.
- Channel traffic: `{channelId, response: <value>}`; CRDT: `{channelId: "graph-crdt-<id>", response: {kind: "sync"|"awareness", graphId, payload: <base64>}}` (`crdtService.ts:78-80,182-201`); execution: `{channelId: "graph-notify-<id>", response: <scheduler event with eventType>}` (`graphService.ts:132-134`); legacy edits: `{channelId: "graph-event-<id>", response: [event, versionEvent]}` (`eventSourceService.ts:259-261`); list: `{channelId: "graphs/projections/toc.json", response: {type: "toc", toc}}` (`tocService.ts:19-22`).
- Chunked frames: `{chunkCollectionId, totalLength, chunkSize, parts, part, value}` (l.22-29).

### C.4 `$default` → execution
The WS API's `RouteSelectionExpression` is `$request.body.action` (cf). Any message whose `action` matches no declared route key lands on `$default` → `handler.defaultRoute` (`serverless.yaml:374-381`) → `graphService.init` with `isWs = true` (`graphService.ts:172-181`), taking `graphUrl`, `nodeUrl`, `field`, `value` from the body and executing that graph (section F). So any unknown `action` string is an execution request.

### C.5 `panic` (`graphService.ts:55-85`)
Writes the string `"PANIC!"` to `panic/<graphId>.json` (l.61), sets module-level `paniking = Date.now()` (l.59) in **the panic function's own process**, posts `{graphId, response:{panicFileWritten:true}}` to the caller, and `process.exit(1)`s the Lambda if the S3 write fails (l.69). The consumer side is inert: `checkPanic` (l.158-168) reads `panic/<graphId>` (no `.json`, key mismatch with l.61) and is never called (grep: only its definition); the `paniking > 0` check in `send` (l.128-131) can only fire inside the same Lambda instance that handled the `panic` route, which is never the executing `default`/`httpDefault` instance. Net effect: panic cannot stop a running graph.

---

## D. CRDT (Yjs) path (`src/crdtService.ts`, `src/crdtStore.ts`, `src/tocStore.ts`, `src/tocService.ts`)

### D.1 Protocol used (server view of `@plastic-io/graph-crdt`)
The server imports (`crdtService.ts:2-17`): `MESSAGE_SYNC_STEP1, readSyncMessage, writeSyncStep1, writeSyncStep2, writeUpdate, toBase64, fromBase64, channelIdFor, UPDATE_FORMAT, encodeState, mergeUpdates, diffUpdate, stateVectorFromUpdate, encodeStateVector`. `UPDATE_FORMAT = 2` (`graph-crdt/updates.ts:23`) and the helpers wrap the V2 API: `mergeUpdates → Y.mergeUpdatesV2` (returns the single input unchanged when `length === 1`, `updates.ts:38-43`), `diffUpdate → Y.diffUpdateV2` (l.46-48), `stateVectorFromUpdate → Y.encodeStateVectorFromUpdateV2` (l.51-53), `encodeState → Y.encodeStateAsUpdateV2` (l.29-31), `applyUpdate → Y.applyUpdateV2` (l.33-35). Wire messages are `{type varuint, content varuint8array}` written with lib0 (`protocol.ts:22-49`), base64 inside a JSON envelope; `channelIdFor(id) = "graph-crdt-" + id` (`protocol.ts:85-87`). `y-protocols` is not used (A.1).

### D.2 WS route `yjs` — `CrdtService.sync` → `handleMessage` (`crdtService.ts:151-224`)
Incoming body: `{action:"yjs", graphId, kind?, payload(base64), format?, description?}`.
1. `graphId` missing → `TypeError` (l.155-157), caught by `sync` (l.220-223) → logged, **200 returned**.
2. `kind === "awareness"` → `fanOut(graphId, "awareness", bytes, ctx.connectionId)` (l.159-163): never stored, sender excluded.
3. Format gate: **only if `body.format !== undefined`** and `!== 2` → log + silent return (l.169-174). A message without `format` is accepted.
4. `readSyncMessage(fromBase64(body.payload))` (l.176).
5. `type === MESSAGE_SYNC_STEP1` (l.178-204): `loadMerged(graphId)`; replies **directly to the sender** (`post`, l.61-74) with step-2 = `diffUpdate(update, clientStateVector)` (or an empty doc's state when nothing stored, l.180-181), then a step-1 carrying the server's state vector so the client pushes what the server lacks (l.190-203). Both replies are wrapped `{channelId: "graph-crdt-<id>", response:{kind:"sync", graphId, payload}}`.
6. Any other type (STEP2 or UPDATE) (l.206-214): `appendUpdate(graphId, message.content, body.description || "Change", userIdOf(event))` → `fanOut(graphId, "sync", writeUpdate(content), ctx.connectionId)` (sender **excluded**) → `maybeCheckpoint(graphId)`.
7. All errors → 200 (l.217-224).

**What is validated on an incoming update: the `graphId` presence and the optional `format` stamp. Nothing else** — no size limit, no schema, no attempt to decode the bytes as a Yjs update before persisting, no check that `message.type` is STEP2/UPDATE (a type-0 message with content is only distinguished by the `===` at l.178; any other integer is treated as an update). Verified **local**: a WebSocket client that never subscribed sent `payload = base64([2,3,1,2,3])` for graph `g9`; the server stored `graphs/g9/crdt/v2/updates/01M301KES2WTCFE383QBEWHW7V~<label>.bin` (label decodes to `{"d":"Change","u":"dev:conn-2"}`), fanned `{"kind":"sync","graphId":"g9","payload":"AgMBAgM="}` out to the other subscriber, then wrote `graphs/g9/crdt/v2/snapshots/01M301KES2WTCFE383QBEWHW7V.bin` containing the same garbage (single-update `mergeUpdates` is identity), and logged `Checkpoint failed. g9 RangeError: Invalid typed array length: 2`. Afterwards `GET /crdt/g9/state` fails (`Cannot read the document state. RangeError`, HTTP 500 on Lambda / `{}` body on the dev server) while `GET /crdt/g9/history` happily lists the poisoned entry. One unauthenticated frame therefore renders a graph id unreadable until the objects are removed by hand (`removeAll`, `crdtStore.ts:368-379`, only reachable through a permanent delete).

### D.3 HTTP routes (`crdtService.ts:242-374`)
- `GET /crdt/{id}/state[?sv=<base64 state vector>]` → `getState` (l.242-286): `loadMerged`; if nothing stored `{graphId, exists:false, format:2, payload:null, stateVector:null}` (l.248-259; local: confirmed for `nope`); else `{graphId, exists:true, format, payload: base64(diffUpdate(update, sv) or whole update), stateVector: base64(stateVectorFromUpdate(update))}` (l.261-280); an unusable `sv` falls back to the whole document (l.263-269); errors → `500` with CORS headers and no body (l.282-285).
- `GET /crdt/{id}/history` → `getHistory` (l.289-303) → `CrdtStore.history` (`crdtStore.ts:259-268`): `[{seq, id (ULID), time (decoded from ULID), description, userId}]` oldest first — parsed purely from object **keys** (`parseUpdateKey`, l.103-110; label codec l.82-101), no GETs.
- `GET /crdt/{id}/state/{updateId}` → `getStateAt` (l.306-327) → `updatesUpTo` (`crdtStore.ts:271-281`, every update with `id <= updateId`, GET each) → `{graphId, format, payload: base64(mergeUpdates(...)) | null}`. Snapshots are ignored here, so cost is O(all updates ever).
- `POST /crdt/{id}/update` → `postUpdate` (l.330-358): body `{payload, format?, description?, origin?}`; wrong `format` → **409** `{error}` (l.333-341; local: confirmed); otherwise `appendUpdate` → `fanOut(..., "sync", ..., body.origin)` → `maybeCheckpoint` → `{ok:true}` (local: confirmed, including for a garbage payload `"AAAA"`, which decodes as type 0 with empty content and is still appended). **Exclusion depends on the caller supplying its own connection id as `origin`**; the editor's HTTP fallback sends `{payload, description, format}` without `origin` (`/Users/tonygermaneri/gh/graph-editor/packages/WssCrdtProvider/main.ts:202`, static), so HTTP-posted updates are echoed back to their author. No idempotency key, no size limit (API Gateway's 10 MB body limit is the only bound).
- `POST /crdt/{id}/checkpoint` → `checkpoint` (l.361-374) → `ensureProjection` (l.139-147): returns `{ok:false, version:null}` when `exists()` is false (`crdtStore.ts:349-356`), else forces `writeSnapshot` + `writeProjections` + `listGraph` and returns `{ok:true, version}`.

### D.4 S3 layout (`crdtStore.ts:20-27, 64-79`)
- Root `graphs` for graphs, `index` for the list (`DEFAULT_ROOT` l.66; `TocStore` passes `{root:"index"}` at `tocStore.ts:67`).
- Updates: `<root>/<id>/crdt/v2/updates/<ULID>~<label>.bin` (`updatePrefix` l.72-74, key built at l.296). `<label>` = URL-safe base64 of `JSON.stringify({d: description, u: userId})` truncated to `MAX_LABEL = 160` chars (l.30, 82-90) — a long description is silently cut and then fails `decodeLabel`'s JSON parse, degrading to `{"Change","Unknown"}` (l.92-101). Object metadata: `graph-id`, `user-id`, `update-format` (l.297-301). ContentType `application/octet-stream` (`s3Service.ts:79`).
- Snapshots: `<root>/<id>/crdt/v2/snapshots/<ULID>.bin` where the ULID is the `headId` of the merged state (newest of last update id / previous snapshot id, l.237-241, 311).
- Format `v2` is part of the prefix by design (comment l.56-63); `allCrdtPrefixes` (l.77-79) deletes `graphs/<id>/crdt/` wholesale.
- ULIDs come from one module-level `monotonicFactory()` (l.37), monotonic **per process**; `SNAPSHOT_SAFETY_WINDOW_MS = 60000` (l.46) makes `listUpdates(afterId)` also include any update whose ULID time is within 60 s before the snapshot's (l.205-213), so an update minted on another Lambda in the same millisecond but sorting below the snapshot id is still folded in (comment l.39-45). Idempotent re-application is what makes that safe.
- Projections written by `writeProjections` (l.322-346): `graphs/projections/latest/<id>.json`, `graphs/<id>/projections/<id>.<version>.json`, `graphs/projections/endpoints/<url>.json` (metadata `id,name,version,description,icon,type,url,user-id`; endpoint gets `type: endpoint`). `graph.version` is whatever `toJSON(doc)` yields — **the server never increments it on the CRDT path** (only the deprecated `add` did, `eventSourceService.ts:199-202`), so the "versioned" projection key is overwritten in place unless the editor bumps `version` inside the document (editor behaviour is out of scope here).

### D.5 Read/merge strategy (`crdtStore.ts:177-256`)
`latestSnapshot` = LIST snapshots prefix, pick the lexically greatest ULID, **GET its body** (l.177-192; note `maybeCheckpoint` calls this just to read the id, `crdtService.ts:100-101`, so every WS edit downloads the full snapshot). `listUpdates` = LIST updates prefix, filter by `afterId`/safety window, sort (l.195-215). `loadMerged` = snapshot bytes + GET of each qualifying update, `mergeUpdates(parts)` (l.221-243). `projectGraph` = `applyUpdate` onto a fresh `Y.Doc`, `toJSON`, `destroy` (l.246-256). Every read is O(updates since snapshot) GETs, sequential (`for … await`, l.228-233).

### D.6 Checkpoint / projection cadence (`crdtService.ts:29, 98-147`)
`CHECKPOINT_INTERVAL_MS` (env, default 10000) governs `maybeCheckpoint`: after every stored update it reads the newest snapshot's ULID time; if younger than the interval it returns; otherwise `writeSnapshot` → `writeProjections` → `listGraph` (toc entry, l.121-136, which also runs `ensureBuilt` = `migrate()` = `isEmpty()` = a full `loadMerged` of the toc document every time). Errors are swallowed (l.108-110). Routes that read projections rather than the CRDT: execution (`graphService.ts:194-196`, endpoints), publishing (`eventSourceService.ts:389,478`, versioned projection — but both `publishNodeWs`/`publishGraphWs` call `ensureProjection` first, l.376-382, 468-472), `getGraph`/`getGraphWs` for a **specific version** (l.564-566, 622-624), `getStoredGraph` fallback for `latest` when no CRDT state exists (l.627-636), and the toc `scanProjections` rebuild (`tocStore.ts:329-361`). `latest` reads project directly from the CRDT (`eventSourceService.ts:570,627`).

### D.7 Concurrency, duplicates, errors
- **No lock, no conditional PUT anywhere** (grep for `IfNoneMatch`/`ETag`/`ConditionExpression`: none; `s3Service.ts:74-102` plain `putObject`). Two Lambdas appending simultaneously write two distinct keys (different ULID random bits) — no overwrite. Two Lambdas snapshotting simultaneously can write the same `snapshots/<headId>.bin` key with different merged contents (last writer wins); the loser's missing update is recovered on the next read only through the 60 s safety window, after which an update older than the snapshot's time − 60 s that was not in the winning snapshot would be dropped from reads (it stays on disk). Static reasoning; not reproduced.
- Toc `commit` (`tocStore.ts:148-164`) is read-modify-**append**: it loads the doc, applies the mutation, and appends only the emitted delta; concurrent commits therefore merge (Y.Map LWW per key) instead of clobbering. Test `tocStore.js: "merges two writes that happened at the same time"` passes (test).
- Duplicate delivery: no idempotency token; a retried `POST /crdt/{id}/update` or re-sent frame appends a second object. Harmless to document state (Yjs idempotence, test `crdtStore.js: "gives the same result whichever order concurrent updates arrive in"`) but it inflates the log and `history`.
- Errors: WS path always 200 (l.217-224); HTTP paths 500 without body on unexpected errors; `Checkpoint failed` only logged.
- The `graphWs` Lambda (WS `getGraph`) has the 6 s default timeout yet performs the full `projectGraph` read (`eventSourceService.ts:570`) — on a graph with many post-snapshot updates this can exceed 6 s (static; not measured).

### D.8 Fan-out after an update
WS: `fanOut(graphId, "sync", writeUpdate(content), ctx.connectionId)` — envelope `{channelId:"graph-crdt-<id>", response:{kind:"sync", graphId, payload}}` to every `subscriptions/graph-crdt-<id>/*` key **except the sender** (`crdtService.ts:213`, `broadcastService.ts:195-200`). Local: subscriber A received exactly one `sync` frame for B's update; B (unsubscribed) received the two direct STEP1 replies only. HTTP: exclusion by `body.origin` (D.3). Step-1 replies go only to the requester, not the channel.

### D.9 List-of-graphs document (`tocStore.ts`, `tocService.ts`)
- One Yjs doc `TOC_DOCUMENT_ID = "toc"` (l.32) under root `index` → keys `index/toc/crdt/v2/updates/…` and `index/toc/crdt/v2/snapshots/…` (l.67 + D.4; test `tocScale.js:42` asserts the prefix). Root map `entries` (l.35) of `Y.Map` per entry; `TocEntry` fields l.43-55 (`id,name,description,icon,type,url,version,deleted,deletedOn,deletedBy,…`). Each graph has two entries: `<id>` (`type: graph`) and `endpoint/<id>` (`type: endpoint`) (`tocService.ts:33-49, 52-63`); published artifacts `artifacts/<id>.<version>` (`eventSourceService.ts:450,522`).
- Deletion is a flag: `markDeleted` sets `deleted/deletedOn/deletedBy` on every entry with that `id` (l.221-231); `markRestored` clears (l.234-244); `remove` deletes the keys (l.247-257); `put` un-hides on rewrite (l.195-198); `project()` omits `deleted` unless `includeDeleted` (l.90-103); `listDeleted` folds the graph+endpoint pair into one row (l.111-125).
- Snapshot after `SNAPSHOT_AFTER_UPDATES = 50` updates (l.58, 167-177).
- Migration (l.275-296): if the doc is empty, read legacy `graphs/projections/toc.json` (l.38) and `graphs/projections/deleted.json` (l.41) and `putMany`; else `scanProjections` (LIST `graphs/projections/` + HEAD each object, l.329-361). `ensureBuilt` (`tocService.ts:114-123`) is called on nearly every read/write path (`eventSourceService.ts:68,76,90,97,111,129,447,519,712,783`; `crdtService.ts:126`).
- `POST /toc/rebuild` → `rebuildToc` (`eventSourceService.ts:150-163`) → `TocStore.rebuild` (l.304-308): scan + `putMany` merged over the existing doc; 300 s timeout. No `ensureBuilt` first, no auth.
- `GET /toc/state?sv=` → `getTocState` (`eventSourceService.ts:127-147`) → `encodeFor` (l.128-138): `{format, exists, payload, stateVector}` differential.
- Every list mutation ends with `announce` broadcasting the **entire projected list** on channel `graphs/projections/toc.json` (`tocService.ts:14-30`).

---

## E. Legacy event-sourcing path (`src/eventSourceService.ts:1-821`)

### E.1 Still reachable in the deployed configuration
| Route | Method | Lines | Notes |
|---|---|---|---|
| WS `addEvent`, `POST /addEvent` | `addEvent` → `add` | 332-375, 173-331 | Deprecated (comment l.164-172, yaml l.98-99) but deployed. Read-modify-write: GET `graphs/projections/latest/<id>.json` (missing → `{}` l.177-179, which then throws at l.200 on `graph.properties`), `applyChange` each deep-diff change (l.185-195), bump `version` (l.199-202), stamp `lastUpdatedBy = userId` (`"Unknown userArn"` in prod), write latest projection + toc entry (l.229-237), version event `graphs/<id>/events/<uuid>.json` (l.249), edit event `graphs/<id>/events/<event.id>.json` (l.271), versioned projection (l.284), endpoint file, removing the old one on URL change (l.293-322); broadcast `[event, versionEvent]` on `graph-event-<id>` (l.259-266). **It writes JSON projections that the CRDT path will later overwrite from the document, and never touches the Yjs document** — a client on the old bundle and a client on the new one diverge silently. |
| `GET /events/{id}` | `getEvents` | 54-65 | Returns the raw `listObjects` result for `graphs/<id>/events/` (keys, sizes, ETags). yaml l.160-162 declares `version: true` for a path that has no `{version}`; cf shows `RequestParameters: {"method.request.path.id": true, "method.request.path.version": true}` and the request validator has `ValidateRequestParameters: true` — the same defect commit `9664b1a` describes for DELETE ("returned 400 for everything"). Likely returns 400 in production; not runtime-verified. |
| `GET /graph/{id}/{version}` | `getGraph` | 620-654 | `latest` → `crdtStore.projectGraph` (l.627) with fallback to the stored file; specific version → `graphs/<id>/projections/<id>.<version>.json`. |
| WS `getGraph` | `getGraphWs` | 560-619 | Same, reply `{messageId, response: graph}`; `body.version` absent means latest (l.563). |
| `GET /artifacts/{id}/{version}` | `getArtifact` | 539-559 | GET `graphs/projections/published/artifacts/<id>.<version>.json`; 404 on `NoSuchKey`, else 500 — but note `callback(err, {...})` passes the error as first arg (l.543,548), which Lambda treats as a failed invocation (API Gateway 502), not the intended 404/500. |
| WS `publishNode` | `publishNodeWs` → `_publishNodeWs` | 376-467 | `ensureProjection(graphId)` first; GET versioned projection; find node by `nodeId`; if absent it posts an error **and continues** (l.397-409 has no `return`), then dereferences `node.publishedOn` (l.410) → `TypeError` → unhandled. Writes `graphs/projections/published/artifacts/<nodeId>.<node.version>.json` (l.425) with metadata incl. `artifact-url: artifacts/<id>/<version>`; lists `artifacts/<id>.<version>` in the toc (l.447-465). |
| WS `publishGraph` | `publishGraphWs` → `_publishGraphWs` | 468-538 | Writes `graphs/projections/published/artifacts/<id>.<version>.json` (l.517) **and** `graphs/projections/published/endpoints/<url>.json` (l.518, the production execution file); `sendResponse` is passed to both PUTs so the client gets two success replies. Stamps `publishedOn/publishedBy` (l.483-484). |
| `DELETE /graph/{id}[?permanent=true]` | `deleteGraph` | 729-756 | Soft: `hideGraph` (toc flag). Permanent: `_deleteGraph` (l.655-720): `crdtStore.removeAll` (fire-and-forget l.656-658), HEAD latest projection to learn `url` (l.659-668), delete `graphs/<id>/projections`, `graphs/<id>/events`, both endpoint files, latest, then `unlistGraph`. **Published artifacts/endpoints under `graphs/projections/published/` are not removed.** |
| `POST /graph/{id}/restore` | `undeleteGraph` | 759-779 | `markRestored`. |
| WS `deleteGraph` / `undeleteGraph` | `deleteGraphWs` / `undeleteGraphWs` | 797-820 | Body `{id, permanent?}`; always 200. |
| `GET /deleted.json` | `listDeletedGraphs` | 782-796 | |
| `GET /toc.json` | `getToc` | 110-124 | projects the toc document. |

### E.2 Artifact/publish storage layout and `version` semantics
- Working projections: D.4. Published: `graphs/projections/published/artifacts/<graphId|nodeId>.<version>.json` and `graphs/projections/published/endpoints/<graph.url>.json`. Execution in `STAGE=production` reads the latter (`graphService.ts:194-195`); the deployed stage is `dev`, which reads the unpublished `graphs/projections/endpoints/<url>.json` (l.196) — i.e. **the live server executes unpublished, checkpoint-fresh graphs**.
- `version` is the graph's/node's `version` field as found in the projection at publish time. **Immutability is not enforced**: both publish writers are unconditional `putObject`s (`s3Service.ts:89-102`), so republishing the same `version` overwrites the artifact, and the endpoints file is overwritten on every publish by design. README's "published versions are immutable" (`README.md:53`) is documentation only.

### E.3 Known bugs — verified status
- **DELETE `/graph/{id}` `version` path-param mismatch: FIXED** at `9664b1a`; yaml l.217-222 now declares only `id: true` + querystring `permanent`; cf `ApiGatewayMethodGraphIdVarDelete.RequestParameters = {querystring.permanent:false, path.id:true}`.
- **`deleteGraph` reading `event.path.id`: FIXED** in the same commit (`git show 9664b1a` hunk `-this._deleteGraph(event.path.id, …` / `+const id = (event.pathParameters || {}).id;`); current code `eventSourceService.ts:730`.
- The same class of defect **still exists** on `GET /events/{id}` (E.1 row 2).
- Test coverage for delete: `src/__tests__/deleteGraph.js` (11 tests) exercises soft/permanent/restore over both HTTP and WS (test).

---

## F. Graph execution on the server (`src/graphService.ts`, `src/graphExecutionService.ts`, `src/proxy.ts`)

### F.1 Route → graph → node (`graphService.ts:169-262`, `init`)
- HTTP (`ANY /{proxy+}` → `event.path` present): `segments = event.path.split(/[/.]/)`; `graphUrl = segments[1]`, `nodeUrl = segments[2]`, `value = event` (the whole API Gateway event), `field = event.path` (l.183-190). E.g. `/home.html` → graph `home`, node `html`. `target = nodeUrl || 'index'` (l.192) is computed **but never used** — `nodeUrl` stays `undefined`, so `/home` runs `scheduler.url(undefined, …)` where `new RegExp(undefined)` (`dist/Scheduler.js:126`) matches every node and the **first** node in `graph.nodes` executes (traced). README's "index" default (`README.md:45`) is not implemented.
- WS (`$default`): `body.{graphUrl,nodeUrl,field,value}` (l.175-181).
- Graph resolution: **not** from the toc, not from the CRDT; a direct GET of `graphs/published/endpoints/<graphUrl>.json` when `STAGE === "production"` else `graphs/projections/endpoints/<graphUrl>.json` (l.194-197). Note the production key `graphs/published/endpoints/` **does not match** what `publishGraphWs` writes (`graphs/projections/published/endpoints/`, `eventSourceService.ts:518`) — production execution would 500 on every request (static; no production stage is deployed).
- Missing graph → `resolve({statusCode:500})` (l.199-204) but `handler.defaultRoute` returns 200 `"ok"` regardless (`handler.ts:76-82`). If the node is not found, `this.node.id` at l.238/251 throws inside the worker event handlers.
- `getGraph` (l.144-157) has an inverted module cache: reads `objectCache` only when `STAGE !== "production"` (l.145) but fills it only when `STAGE === "production"` (l.152-154) — never hits in either stage. `objectCache` is module-level (l.21) and would otherwise persist across warm invocations.

### F.2 Worker + Scheduler construction (`graphService.ts:209-262, 263-480`)
- `init` serialises `{graph, nodeUrl, value, field, event, context}` to JSON (l.209-216) and spawns `new Worker(__filename, {workerData})` (l.219-221; `worker_threads`, l.4). The worker bootstrap at l.484-526 (`!isMainThread`) calls `router(...)`, then polls `process._getActiveHandles()/_getActiveRequests()` every 500 ms (l.496-520, `HEARTBEAT_INTERVAL` l.24) and posts `'shutdown'` when the event loop is empty; the parent terminates the worker and resolves (l.222-232). Worker `error`/`exit` also resolve after sending an `info` event (l.233-257).
- `router` (l.263-480): `graphTimeout = min(MAX_TIMEOUT 900000, graph.properties.timeout || 25000)` (l.23,29,270) with a `responseTimeout` that resolves early (l.271-279) — but the Lambda itself is capped at 30 s (yaml l.378,385), so `properties.timeout` above ~25 s is meaningless. `logLevel`, `broadcastConnectors`, `broadcastEvents` come from `graph.properties` (l.352-360); logger (l.286-351) forwards `error` always, `warn/log/info/debug` by `logLevel`, each as a `log` event; `process.on('unhandledRejection'|'uncaughtException')` → `log` error + `'shutdown'` (l.361-376).
- Secret: `getSecret()` (l.31-50) — `SecretsManagerClient({region:"us-west-1"})` hard-coded, `SecretId "OPENAI_API_KEY"`, `AWSCURRENT`; `new OpenAI({apiKey})` and **`global.openai = openai`** (l.400-404). This runs on **every** execution regardless of whether the graph uses OpenAI, so an unreachable secret fails every graph run.
- `new Scheduler(graph, {openai, event, context, callback: cb}, workerObjProxy, logger)` (l.406) — signature `constructor(graph, context?, state?, logger?)` (`dist/Scheduler.d.ts:31`). `state` is a deep `Proxy` (`proxy.ts:2-17`, `createDeepProxy`) whose every `set` emits a `state-update` event `{path, value}` to the channel (l.379-398); it is pre-seeded with `nodes[nodeId][inputName] = undefined` (l.391-398).
- Entry: `scheduler.url(nodeUrl, value, field, null)` (l.475) → `Scheduler.prototype.url` (`dist/Scheduler.js:107-158`): dispatches `begin`, finds the node by `new RegExp(url).test(node.url)`, `Edge.execute(this, graph, node, field, value)`, dispatches `end`, resolves `{nodes: []}` — the resolved value carries no output; results only exist as events.
- Linked graphs/nodes: `Loader.load(url)` (`dist/Loader.js:51-101`) first dispatches a `load` event whose `setValue` can supply the resource; otherwise it calls global `fetch(url)` (l.88-95) with `url = "artifacts/graph/{id}.{version}"` / `"artifacts/nodes/{id}.{version}"` (`Scheduler.js:69-70,101-106`). The server registers `load` only to forward it to the channel (`graphService.ts:111,122,447-451`); nothing calls `setValue` (grep: no `setValue` in `src`). On Node 18 `fetch("artifacts/…")` with a relative URL rejects (`TypeError: Invalid URL`), so **linked graphs/nodes cannot resolve on the server** (static + traced; not executed).

### F.3 Host context available to node code (no sandbox)
- Node code runs via `new AsyncFunction("scheduler","graph","cache","node","field","state","value","edges","data","properties","require", escodegen.generate(ast))` (`dist/Node.js:61`) after a `meriyah.parseScript` (l.50-55), invoked with `this = nodeInterface.context` and a `require` argument that is the host's real `eval("require")` (l.74-76). No `vm`, `isolated-vm`, `vm2` or any sandbox in `src` (grep: only `worker_threads` at `graphService.ts:4` and `graphExecutionService.ts:2`); a `worker_threads` Worker shares the process's credentials and filesystem — isolation is only against crashing the parent.
- `setContext` (`graphService.ts:408-446`) gives every node `this = {openai, event (full API Gateway event), context (Lambda context), callback, AWS (the whole aws-sdk v2 namespace with the Lambda role's ambient credentials), console: {…forwarded as log events}}`. Combined with IAM (A.3), node code can read/write/delete every object in the bucket, read the OpenAI secret, and post to any WebSocket connection. `global.openai` is also set (l.404).
- Rust runtime: not referenced anywhere — `grep -rniE 'rust|wasm|\bffi\b|napi'` across `src/*.ts`, `serverless.yaml`, `package.json`, `webpack.config.js`, `scripts/*.js` → 0 matches.

### F.4 How results/events leave the server
- Never in the HTTP response: `defaultRoute` returns `"ok"` (`handler.ts:78,81`); `init`/`router` resolve `{statusCode:200, body:"ok"}` in every branch (l.228,245,256,278,300,373,466,472). The `callback: cb` handed to the scheduler (l.280-285) resolves the router promise with the node's `response`, but `init` never reads it and `handler` discards it.
- Everything goes over WebSocket channel **`graph-notify-<graph.id>`** via `send(type)` → `_sendToChannel` (l.125-143): scheduler events `begin, end, beginconnector, endconnector, set, afterSet, error, warning, load` (l.102-112, 447-451; `e.eventType = type`, `nodeInterface` stripped l.132-133), `log` events from the logger and node `console`, `state-update` from the proxy, `info` from worker error/exit/timeout/heartbeat (l.236-257, 272-279, 502-510). A subscriber to `graph-notify-<id>` therefore receives the full event/log stream of every execution of that graph, from any caller.
- Note `send` is invoked from the **worker**, which constructs its own `BroadcastService` (l.100 in the worker's `GraphService`), so each event is a LIST of `subscriptions/graph-notify-<id>` plus one `postToConnection` per subscriber.
- Timeouts: Lambda 30 s (yaml), in-worker `graphTimeout` default 25 s (l.29), `MAX_PANIC_FAILSAFE_TIME 2000` (l.22, only meaningful if `paniking` was set in this process — never, C.5).
- Module-level mutable state that survives warm invocations (`graphService.ts:20-29`): `STAGE`, `objectCache`, `responseTimeout`, `paniking`, `graphExecutionComplete`, `graphTimeout` (mutated at l.270 — a graph with a custom timeout changes the default for the next graph on the same instance). Elsewhere: `crdtStore.ts:37` `ulid` factory (benign), `handler.ts:5-8` service singletons, `Loader.cache` per Scheduler (per invocation).

### F.5 `graphExecutionService.ts` and `proxy.ts`
`graphExecutionService.ts:1-51` is dead: not imported by anything (grep across `src`, `serverless.yaml`, `scripts`); its `route()` is an empty stub (l.28-30) and the worker branch even passes `field`/`value` in swapped order (l.39-43). `proxy.ts` is used only for the state proxy (F.2).

### F.6 Unauthenticated execution chain (traced, not executed)
`POST /crdt/<any id>/update` with a valid V2 update that creates a node whose `template.set` contains arbitrary JS → `POST /crdt/<id>/checkpoint` (or wait ≤10 s and send one more update) writes `graphs/projections/endpoints/<url>.json` (`crdtStore.ts:340`) → `GET /<url>` (`ANY /{proxy+}`) loads exactly that file (`graphService.ts:196`) and runs the node code with `require` and `AWS` in scope (F.3). Every step is anonymous and CORS-open.

---

## G. Dev server (`src/devServer.ts:1-301`, `scripts/build-dev-server.js:1-37`)

- Build: reuses `webpack.config.js` (l.7,10-11), `mode: development`, entry `src/devServer.ts` (l.15), externals `ws` and `aws-sdk` (l.16), `ts-loader` `transpileOnly` (l.18-26), output `.devserver/devServer.js` (l.17; 830 KB). Local: `node scripts/build-dev-server.js` printed `dev server bundled`.
- Runtime: one HTTP + WS server on `PORT` (default 3030, l.24). `MemoryStore` (l.30-84) implements the `S3Service` surface (`getRaw/setRaw/get/set/head/remove/removePath/list`). `DevBroadcastService` (l.93-131) keeps `sockets`/`channels` Maps (l.90-91) and implements `postToClient/broadcast/_sendToChannel/subscribe/unsubscribe/dropConnection`. Events are fabricated with `requestContext.identity.userArn = "dev:<connectionId>"` (l.143-152).
- Fidelity: it runs the **real** `CrdtService` (with a `CrdtStore` over the memory store) and the real `EventSourceService` with `store`, `broadcastService`, `crdtStore`, `crdtService` swapped in (l.133-141). **Gap: `eventSourceService.tocStore` is not rewired** (l.137-141 omit it), so it keeps a `TocStore` over a real `S3Service` with `S3_BUCKET` undefined. Local: `GET /toc.json` returned `{}` and the log shows `list error MissingRequiredParameter: Missing required key 'Bucket'` / `Cannot build the graph list` / `Cannot read the graph list`. `crdtService.tocStore` *is* memory-backed (constructed from `this.store.store`, `crdtService.ts:57`), so checkpoints list graphs but `/toc.json` cannot read them.
- Route names: HTTP `debug/keys` (extra, l.199-203), `toc.json`, `crdt/{id}/state[?sv]`, `crdt/{id}/state/{updateId}`, `crdt/{id}/history`, `crdt/{id}/update`, `crdt/{id}/checkpoint`, `artifacts/{id}/{version}`, `graph/{id}/{version}` (l.204-242); everything else 404 (local: `/addEvent`, `/home.html` → 404). WS `action`s: `subscribe`, `unsubscribe`, `yjs`, `getGraph`, `deleteGraph`, `publishGraph`, `publishNode`; others logged `ignoring action` (l.273-290). **Not emulated**: `$default`/execution, `addEvent`, `sendToChannel`, `sendToConnection`, `broadcast`, `listSubscribers`, `listSubscriptions`, `undeleteGraph` (WS), `DELETE /graph/{id}`, `/graph/{id}/restore`, `/toc/state`, `/toc/rebuild`, `/deleted.json`, `/events/{id}`, `panic`, chunking, 410/429 handling.
- Usable for plan tests of: the CRDT sync/HTTP surface, checkpoint/projection writing, publish, `getGraph`. Not usable for: broadcast semantics, execution, toc read path (until l.137-141 also set `tocStore = new TocStore(store)`).

---

## H. Tests actually run

Command: `npx jest` from the repo root (Node 25.7.0, jest 26.0.1). Result (verbatim tail):

```
PASS src/__tests__/s3Service.js
PASS src/__tests__/eventSourceService.js
PASS src/__tests__/crdtStore.js
PASS src/__tests__/broadcastService.js
PASS src/__tests__/tocStore.js
PASS src/__tests__/crdtService.js
PASS src/__tests__/tocScale.js
PASS src/__tests__/deleteGraph.js
Test Suites: 8 passed, 8 total
Tests:       83 passed, 83 total
Snapshots:   0 total
Time:        5.381 s (5.584 s on the first run)
```
No failures. `--json` per file: broadcastService 13/13 (312 ms), crdtService 19/19 (347 ms), crdtStore 12/12 (324 ms), deleteGraph 11/11 (5198 ms — uses a 400 ms `settle()` sleep per case, `deleteGraph.js:67`), eventSourceService 3/3, s3Service 6/6, tocScale 3/3 (755 ms; prints a `console.table` of reads/bytes per save at 100/1000/10000 graphs: 0 HEADs, 45-46 bytes written), tocStore 16/16. Console noise from `ensureBuilt` logs is expected.

What each file covers (static):
- `s3Service.js` — each `S3Service` method calls the matching mocked `aws-sdk` S3 method.
- `broadcastService.js` — connect/disconnect/subscribe/unsubscribe key writes, `postToClient` → `postToConnection`, list*/sendToAll/sendToChannel/sendToConnection, and the three `broadcast` completion cases (nobody, only-sender, several).
- `eventSourceService.js` — `getEvents` lists S3; `getToc` never HEADs; empty list → `{}`.
- `crdtStore.js` — label/ULID codecs, `exists`, seed→project round trip, merge order-independence, snapshot+tail ≡ raw log, log kept after snapshot, history ordering/labels, `updatesUpTo`, projection keys, `removeAll`.
- `crdtService.js` — step-1 answer, store+fan-out excluding sender, awareness not stored, two-client convergence, HTTP state (whole/diff/unusable sv/nonexistent), history, state-at, oversized HTTP update, format refusal (WS silent, HTTP 409), format-stamped acceptance, checkpoint writes projections + toc entry, listing doesn't read other graphs, checkpoint on unknown graph, staleness-triggered refresh.
- `tocStore.js` — CRUD on entries, delta-only writes, no cross-reads, concurrent merge, hide/restore/remove, differential `encodeFor`, migration from legacy toc + deleted index, projection scan fallback, build-once, rebuild-over-top, snapshot folding.
- `tocScale.js` — save cost at 100/1000/10000 entries.
- `deleteGraph.js` — soft delete keeps files, hidden graph still served, restore, list deleted, permanent delete removes everything, 400 without id, non-"true" `permanent` is a hide, WS variant.

Test doubles a plan should reuse:
- `__mocks__/aws-sdk.js:1-22` — exports `mocks.S3.{getObject,deleteObject,listObjects,putObject,headObject}` and `mocks.ApiGatewayManagementApi.postToConnection` as `jest.fn()`, plus constructors `S3`/`ApiGatewayManagementApi` returning those shared objects; tests `mockClear()` them in `beforeEach` (`broadcastService.js:4-11`).
- `src/__testHelpers__/fakeS3.js:1-61` — `FakeS3Service` with `objects: Map<key, Buffer>`, `meta: Map`, `calls: {list, head}` counters, and the same callback API as `S3Service` (`getRaw/setRaw/get/set/head/removePath/remove/list`; `list` returns sorted `[{Key}]`). Services are wired by constructor injection (`new CrdtStore(fake)`, `new CrdtService(store, fakeBroadcast)`, `new TocStore(fake)`) or by overwriting public fields on `EventSourceService` (`deleteGraph.js:50-58`). A `FakeBroadcastService` recording `direct`/`channel` arrays is defined inline in `crdtService.js:36-49`; `wsEvent`/`httpEvent`/`invoke` helpers at `crdtService.js:51-74`.
- Fixture: `src/__tests__/__data__/event_http_request.json` = `{event:{requestContext:{domainName:"localhost", connectionId:"123456"}}, context:{}}`.

Coverage gaps (static): no tests for `graphService`/execution, `panic`, `postToClient` chunking, 410/429 handling, `listSubscribers` (the bug in C.2 passes because the test only asserts S3 was read), `addEvent`, `publishNodeWs` missing-node branch, `S3Service.list` pagination, `getArtifact` error path, `devServer`.

---

## I. Debt, contradictions, bypass paths

### I.1 Mutation/execution paths outside the editor's normal `yjs` WS route
| Path | Who can call | What it does | Idempotent? |
|---|---|---|---|
| `POST /crdt/{id}/update` (`crdtService.ts:330-358`) | anyone, any origin | appends any bytes as a V2 update for any graph id, fans out, may checkpoint (writes endpoint file) | No — each call appends a new ULID object; garbage poisons reads (D.2) |
| `POST /crdt/{id}/checkpoint` (l.361-374) | anyone | forces snapshot + 3 JSON projections + toc entry + toc broadcast | Yes (same headId key rewritten) |
| WS `yjs` with any `graphId` (l.151-215) | any socket | same as update; also step-1 reads any doc | No |
| WS `sendToChannel` / `sendToConnection` (`broadcastService.ts:324-352`) | any socket | inject arbitrary frames into any channel/connection, incl. forged CRDT sync/awareness envelopes | n/a (no state) |
| WS `subscribe` to any channel (l.152-175) | any socket | receive every graph's edits, execution logs, and the toc | Yes |
| `POST /addEvent` and WS `addEvent` (`eventSourceService.ts:332-375`) | anyone | legacy read-modify-write of JSON projections + event files + `graph-event-` broadcast, bypassing the Yjs document | No — bumps `version`, writes new event objects each call |
| `POST /toc/rebuild` (l.150-163) | anyone | full LIST+HEAD walk of `graphs/projections/`, 300 s Lambda, merges into the list; broadcasts the list | Effectively yes (entries LWW), but each run appends a toc update |
| `DELETE /graph/{id}` and WS `deleteGraph` (l.729-756, 797-810) | anyone | hide, or with `permanent=true` destroy events/projections/endpoints/CRDT objects | Soft: yes. Permanent: yes (deletes), but leaves published artifacts |
| `POST /graph/{id}/restore`, WS `undeleteGraph` (l.759-779, 812-820) | anyone | un-hide | Yes |
| WS `publishGraph` / `publishNode` (l.376-538) | anyone | overwrite `published/artifacts/<id>.<version>.json` and `published/endpoints/<url>.json`; toc entry | Overwrites (not immutable) |
| `ANY /{proxy+}` and WS `$default` (`serverless.yaml:374-391`) | anyone, CORS `*` | executes a node of any graph by URL with host `require`, `AWS`, OpenAI key (F) | No — side effects are whatever the node code does |
| WS `panic` (`graphService.ts:55-85`) | any socket | writes `panic/<id>.json`; can `process.exit(1)` the Lambda on S3 failure | Yes |
| WS `broadcast` (`serverless.yaml:92-96`) | any socket | **handler missing** → runtime error (A.3) | n/a |

### I.2 Contradictions and defects found (all static unless noted)
1. `handler.broadcast` declared in `serverless.yaml:93` but not exported (`handler.ts:109-141`; bundle).
2. `GET /events/{id}` declares a phantom `version` path param (`serverless.yaml:160-162`; cf) — same defect class the DELETE fix removed.
3. `graphService.getGraph` cache logic inverted (`graphService.ts:145,152`).
4. Production endpoint key mismatch: executor reads `graphs/published/endpoints/` (`graphService.ts:195`), publisher writes `graphs/projections/published/endpoints/` (`eventSourceService.ts:518`).
5. `target`/`'index'` default never applied (`graphService.ts:192` vs l.207,475); regex matching on `nodeUrl` (`dist/Scheduler.js:126-129`) means a URL like `.` or `undefined` matches any node.
6. `panic` key mismatch `panic/<id>.json` vs `panic/<id>` and `checkPanic` unreferenced (`graphService.ts:61,159`).
7. `listSubscribers` lists the reverse index (`broadcastService.ts:251`).
8. `S3Service.remove` double-invokes the callback on error (`s3Service.ts:47-53`, no `return`).
9. `S3Service.list` paginates with `response.NextMarker` (`s3Service.ts:116-118`) — for `ListObjects` v1 without a `Delimiter`, S3 does not return `NextMarker`, so once any prefix (`subscriptions/<channel>`, `connections/`, a graph's `crdt/v2/updates/` after 1000 edits, `graphs/projections/` during a rebuild) exceeds 1000 keys the loop re-requests page 1 forever (`Marker: undefined`). Static reasoning from the S3 API contract; not reproduced.
10. `_publishNodeWs` continues after "Cannot find node" (`eventSourceService.ts:397-410`); `_publishGraphWs` calls `sendResponse` twice (l.517-518).
11. `getArtifact` passes `err` as the Lambda callback error (l.543,548) → 502 instead of 404/500.
12. `addEvent` on a missing graph uses `{}` then dereferences `graph.properties` (l.178,200).
13. `graphWs` (WS `getGraph`) has the 6 s default timeout while projecting a full document (`serverless.yaml:124-128`, `eventSourceService.ts:570`).
14. `latestSnapshot` GETs the whole snapshot body just to learn its id on every edit (`crdtStore.ts:187`, `crdtService.ts:100-101`); `ensureBuilt` re-reads the toc document on every list write (`tocService.ts:114-123`).
15. Long descriptions break the label codec (`crdtStore.ts:30,89,92-101`).
16. `$connect`/`subscribe` persist the full event (headers, query string) to S3 (`broadcastService.ts:90,158,163`).
17. Hard-coded region/secret name/account in code and IAM (`graphService.ts:32-34`, `serverless.yaml:38`); `getSecret` runs on every execution (l.400).
18. Lambda `NODE_OPTIONS=--unhandled-rejections=warn` (`serverless.yaml:46`) masks rejections process-wide.
19. `git-lambda2` layer attached to `default` only, unused by code (A.3).
20. Linked graph/node loading cannot work server-side (F.2).
21. Version skew `@plastic-io/plastic-io` 2.0.1 (server) vs 2.0.3 (editor); `@types/node` 9.x on a Node 18 runtime; tests run on Node 25.
22. Unused deps: `y-protocols`, `flatted` (imported, unused), `handlebars`, `typedoc`; `aws-sdk` misfiled as devDependency; `deep-diff`/`jshashes` only serve the deprecated route. Dead code: `graphExecutionService.ts`, `sendToAll`, `checkPanic`, `updateToc` in `tocService.ts:126-136` (grep: no callers), unused imports `S3CreateEvent/APIGatewayEvent/path/toJSON` in `graphService.ts:6,10,13`.
23. Only explicit markers: `graphService.ts:1` "experimental state"; `eventSourceService.ts:165` and `serverless.yaml:98` "DEPRECATED". No `TODO`/`FIXME` anywhere in `src`.
24. Dev server does not rewire `EventSourceService.tocStore` (`devServer.ts:137-141`; local).
25. Lockfile: consistent with `package.json` and `node_modules` (lockfileVersion 2, all listed versions match installed); the `file:` link means the server's build depends on the sibling checkout's uncommitted state.

---

## J. Evidence ledger

| ID | Claim | Location | Symbol | Verified by |
|---|---|---|---|---|
| GS-01 | No API Gateway authorizer; all 18 WS routes and 32 REST methods `AuthorizationType: NONE` | `.serverless/cloudformation-template-update-stack.json` (resources `*WebsocketsRoute`, `ApiGatewayMethod*`) | — | cf (programmatic scan) |
| GS-02 | IAM policy is exactly logs, `lambda:GetLayerVersion`, S3 Get/Put/Delete/ListBucket on one bucket, `execute-api:ManageConnections`, `secretsmanager:GetSecretValue`; 0 hits for `cloudformation:`, `codebuild:`, `iam:`, `iam:PassRole`; `sts:AssumeRole` only in trust policy | `serverless.yaml:11-38`; cf `IamRoleLambdaExecution` | — | static + cf |
| GS-03 | Single 9.2 MB bundle `src/handler.js` serves all 33 functions; one Yjs copy | `.serverless/plastic-io-graph-server.zip`; `webpack.config.js:12` | `resolve.symlinks` | bundle |
| GS-04 | `handler.broadcast` referenced by yaml but not exported | `serverless.yaml:92-96`; `handler.ts:109-141`; bundle export chain | — | static + bundle |
| GS-05 | No identity extraction beyond `identity.userArn` fallback; no permission check in any service | grep over `src/*.ts`; `crdtService.ts:31-37`; `eventSourceService.ts:337,411,484,515,740,808` | `userIdOf` | static (grep) |
| GS-06 | Any socket may subscribe to / inject into any channel; injected envelope equals CRDT fan-out envelope | `broadcastService.ts:152-175,317-333`; `crdtService.ts:76-90` | `subscribe`, `_sendToChannel`, `fanOut` | static + traced |
| GS-07 | Subscriptions/connections are S3 keys `connections/…`, `subscriptions/<ch>/<conn>/<domain>`, `subscriptions-reverse/…` | `broadcastService.ts:90,110,115,134,139,158,163` | `connect`, `subscribe` | static; tests `broadcastService.js` |
| GS-08 | 410 → `_disconnect`; 429 → unbounded linear backoff; other errors swallowed | `broadcastService.ts:58-68` | `postToClient` | static |
| GS-09 | Chunking at 35000 chars; `broadcast` callback once per recipient | `broadcastService.ts:7,17-32,73-86,186-226` | `createChunks`, `broadcast` | static; tests |
| GS-10 | `listSubscribers` lists the reverse index (bug) | `broadcastService.ts:251` | `listSubscribers` | static |
| GS-11 | `$default` executes graphs from WS body fields | `serverless.yaml:374-381`; `graphService.ts:172-181` | `defaultRoute`, `init` | static + traced |
| GS-12 | Panic cannot reach the executing Lambda; key mismatch; `checkPanic` unused | `graphService.ts:55-85,128-131,158-168` | `panic`, `checkPanic` | static (grep) |
| GS-13 | Incoming update validation = `graphId` present + optional `format === 2`; bytes stored unparsed | `crdtService.ts:155-176,206-212,333-344` | `handleMessage`, `postUpdate` | static + local (garbage accepted, doc poisoned) |
| GS-14 | Step-1 handled with `diffUpdate`/`stateVectorFromUpdate`, replies direct to sender | `crdtService.ts:178-204` | `handleMessage` | static; test "answers a sync step 1" |
| GS-15 | Update/STEP2 → append, fan-out excluding sender, maybe checkpoint | `crdtService.ts:206-214` | `handleMessage` | static; local (A got 1 frame, B got none) |
| GS-16 | HTTP update excludes only `body.origin`; editor fallback omits it | `crdtService.ts:345`; `graph-editor/packages/WssCrdtProvider/main.ts:202` | `postUpdate` | static |
| GS-17 | Key layout `graphs/<id>/crdt/v2/{updates,snapshots}/…`, ULID monotonic factory, 60 s window, label codec | `crdtStore.ts:20-27,37,46,68-74,82-110,296,311` | `appendUpdate`, `writeSnapshot`, `listUpdates` | static; local (`/debug/keys`); tests `crdtStore.js` |
| GS-18 | Merge = newest snapshot + later updates via `mergeUpdatesV2`; single update returned unchanged | `crdtStore.ts:221-243`; `graph-crdt/updates.ts:38-43` | `loadMerged`, `mergeUpdates` | static |
| GS-19 | Projections: latest / versioned / endpoints; version never incremented server-side on CRDT path | `crdtStore.ts:322-346`; `eventSourceService.ts:199-202` | `writeProjections`, `add` | static |
| GS-20 | `CHECKPOINT_INTERVAL_MS` gates snapshot+projection+toc after each edit; errors swallowed | `crdtService.ts:29,98-111`; `serverless.yaml:45` | `maybeCheckpoint` | static; test "refreshes the projection once an edit has left it stale" |
| GS-21 | No locks/conditional writes; concurrent appends safe, concurrent snapshots LWW | `s3Service.ts:74-102`; `crdtStore.ts:289-316` | `setRaw`, `appendUpdate`, `writeSnapshot` | static |
| GS-22 | Toc is a Yjs doc under `index/toc/crdt/v2/…`; deletion is a flag; legacy migration; `/toc/rebuild` | `tocStore.ts:32-41,58,67,148-164,221-257,275-308,329-361` | `TocStore` | static; tests `tocStore.js`, `tocScale.js` |
| GS-23 | Toc changes broadcast the whole list on channel `graphs/projections/toc.json` | `tocService.ts:11,14-30` | `announce` | static |
| GS-24 | Deprecated `addEvent` still deployed on WS + HTTP and bypasses the Yjs doc | `serverless.yaml:98-110`; `eventSourceService.ts:173-375` | `add`, `addEvent` | static + cf |
| GS-25 | DELETE path-param bug and `event.path.id` bug fixed in `9664b1a`; `GET /events/{id}` retains a phantom `version` param | `serverless.yaml:157-162,214-222`; `eventSourceService.ts:730`; cf `RequestParameters` | `deleteGraph`, `getEvents` | static + git history + cf |
| GS-26 | Published artifacts are unconditional overwrites; permanent delete leaves them | `eventSourceService.ts:425,517-518,655-720` | `_publishNodeWs`, `_publishGraphWs`, `_deleteGraph` | static |
| GS-27 | Execution loads `graphs/projections/endpoints/<url>.json` in `dev`, `graphs/published/endpoints/…` in production (mismatched with publisher) | `graphService.ts:194-196`; `eventSourceService.ts:518` | `init` | static + traced |
| GS-28 | Scheduler constructed with `{openai,event,context,callback}` context, proxied state, logger; entry `scheduler.url(nodeUrl, value, field, null)` | `graphService.ts:406,475`; `dist/Scheduler.d.ts:31,37`; `dist/Scheduler.js:107-158` | `router`, `Scheduler.url` | static |
| GS-29 | Node code runs as `AsyncFunction` with host `require`; `this` = `{openai,event,context,callback,AWS,console}`; no sandbox | `dist/Node.js:44-76`; `graphService.ts:408-446`; grep for vm/isolated-vm | `parseAndRun`, `setContext` | static |
| GS-30 | Results never in HTTP response; all events on `graph-notify-<id>` | `handler.ts:75-83`; `graphService.ts:125-143,447-451` | `defaultRoute`, `send` | static + traced |
| GS-31 | Linked graph loading relies on global `fetch` of a relative `artifacts/…` path; no `setValue` on the server | `dist/Loader.js:51-101`; `dist/Scheduler.js:69-70`; grep `setValue` in src | `Loader.load` | static |
| GS-32 | Rust/wasm/ffi/napi not referenced | grep over src + config | — | static (0 matches) |
| GS-33 | Module-level mutable state in `graphService.ts` survives warm starts; cache logic inverted | `graphService.ts:20-29,144-157` | `objectCache`, `getGraph` | static |
| GS-34 | `graphExecutionService.ts` dead; `sendToAll` dead; unused deps `y-protocols`, `flatted` | grep across src/yaml/scripts; `package.json:36,41` | — | static (grep) |
| GS-35 | Dev server runs real `CrdtService`/`EventSourceService` over a memory store; `tocStore` not rewired; execution/addEvent/broadcast not emulated | `devServer.ts:133-141,199-242,273-290` | `MemoryStore`, `DevBroadcastService` | static + local (log `Missing required key 'Bucket'`) |
| GS-36 | 8 suites / 83 tests pass in ~5.4 s | `npx jest` | — | test |
| GS-37 | `S3Service.list` pagination uses `NextMarker` without `Delimiter` | `s3Service.ts:103-123` | `list` | static (S3 API contract; not reproduced) |
| GS-38 | Deploy artifact built 2026-09-20T18:09:02Z; HEAD commit 18:12:08Z touches README only; bundle carries HEAD's toc markers | `.serverless/serverless-state.json` `package.artifactDirectoryName`; `git show --stat HEAD`; bundle grep | — | cf + git + bundle |
| GS-39 | `@plastic-io/plastic-io` 2.0.1 (server) vs 2.0.3 (editor); 370 diff lines in dist | `package.json:34`; `graph-editor/package.json:33`; `diff -r` | — | static |
| GS-40 | `git-lambda2` layer only on `default`; nothing in src uses git | `serverless.yaml:376-377`; grep; `git show b38e3d9` | — | static + cf + git |
| GS-41 | `$connect`/`subscribe` persist the full event to S3 | `broadcastService.ts:90,158,163` | `connect`, `subscribe` | static |
| GS-42 | `getSecret` hard-codes region/secret and runs on every execution | `graphService.ts:31-50,400-404` | `getSecret` | static |
| GS-43 | `graphWs` has 6 s timeout while projecting full document | `serverless.yaml:124-128`; cf; `eventSourceService.ts:570` | `getGraphWs` | static + cf |

Failed/limited checks recorded: (a) first grep batch failed on an unquoted zsh glob and was re-run with quotes; (b) the first bundle export grep used an unminified pattern and returned nothing until the minified `e.name=` chain was inspected; (c) a first WebSocket probe failed with `Cannot find module 'ws'` from the scratchpad and was re-run with `NODE_PATH`; (d) one dev-server instance was left running between two probe commands and was killed before the next run (`pgrep` confirmed none remain); (e) the `GET /events/{id}` 400 behaviour, the >1000-key pagination loop, the production endpoint-key mismatch and the relative-`fetch` failure are inferred statically and were **not** exercised against AWS or a live scheduler run.
