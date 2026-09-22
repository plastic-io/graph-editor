# Spike S-3 — `subscriptions/listen` on a Lambda Function URL (result: viable; D-3 confirmed, PB-085 implemented)

**Question.** Can `subscriptions/listen` (protocol revision 2026-07-28) be served from this substrate at all? Exit criterion from §9.3: a 10-minute stream with keep-alive comments, and reconnect works. The plan's fallback if it could not: omit subscriptions and let clients poll `observations.query {since}` / `tasks/get`.

**Why it cannot go where the rest of MCP goes.** `POST /mcp` is on the REST API, which has one response per request and 29 seconds to produce it, and which buffers: frames written early would not leave the gateway until the handler returned. A subscription is the opposite shape — open for minutes, silent most of the time, and worth nothing if its frames arrive at the end. A Lambda **Function URL with `InvokeMode: RESPONSE_STREAM`** is the only place on this substrate where a handler may write to the client as it goes, for up to the function's 15-minute ceiling.

**Method.** The endpoint is implemented rather than prototyped: `src/mcp/stream.ts` (the Function URL handler) and `src/mcp/subscriptions.ts` (where the change events come from), deployed to the dev stage, and driven from a browser at `http://localhost:8080` with the page's own bearer. 15 unit tests in `src/__tests__/subscriptions.js`, of which 8 drive a real MCP client (`@modelcontextprotocol/client` v2) through the handler.

## What the substrate demanded

| Finding | What it forced |
|---|---|
| **A function URL needs two permissions, not one.** Since October 2025 a URL requires `lambda:InvokeFunction` as well as `lambda:InvokeFunctionUrl`. Serverless 3.25 emits only the second (its `url:` support predates the change), and the URL answered **403 Forbidden to every request, signed or not, before the function was ever invoked** — no log stream, no invocation, nothing to debug from. | Both statements declared by hand in `resources:`, the second narrowed with `InvokedViaFunctionUrl: true` so it does not quietly make the function callable through the Invoke API. |
| **Serverless 3.25 cannot declare an invoke mode.** `url: true` produces a `BUFFERED` URL, which for a subscription means every frame is held until the handler returns — i.e. until it times out. | The `AWS::Lambda::Url` resource is declared directly, with `InvokeMode: RESPONSE_STREAM`. |
| **`OPTIONS` is not a valid `Cors.AllowMethods` value** for a function URL (preflight is answered by the URL itself). CloudFormation refuses the change set through `AWS::EarlyValidation::PropertyValidation`, whose failure message names no property and produces no stack event. | Narrowed by bisecting the template against a throwaway change set. The `Cors` block was then dropped entirely: a URL that configures CORS adds the headers, and the handler adds them too (it must — the dev server is the same code with no URL in front of it), which leaves a browser with two `Access-Control-Allow-Origin` headers and a refusal. One owner: the handler. |
| **No authorizer stands in front of a Function URL.** `AuthType: NONE` means Lambda authenticates nothing. | The handler verifies the Auth0 bearer itself, with the same `verifyBearer` the REST authorizer uses, and answers 401 with `WWW-Authenticate` when it cannot. |

## What the protocol demanded

The SDK owns the wire — ack first, per-stream filtering by exact URI, keep-alive comments, graceful teardown — and takes its events from a `ServerEventBus`. It does **not** know who is listening: the listen router never sees `authInfo`. So authorization is the endpoint's: a listen naming a graph its caller may not read is refused `-32002 not found: <uri>`, worded as a read of that graph is worded, and the feed only watches graphs that passed.

The events cannot come from memory. The Lambda serving a stream never sees the request that changed a graph — that runs in another sandbox, minutes later, sharing nothing but S3. So the feed watches what is **durable**: the audit chain (every mutation, proposal, revision and publish is a record in it, and `HEAD.json` makes "has anything happened" one GET) and the execution index. A change is something written, which is also why a reconnecting client is told about anything that happened while it was away — the cursor is a key, not a position in a process's memory.

## Results (dev stage, 2026-09-22)

| Check | Result |
|---|---|
| Stream opens and is acknowledged | `200 text/event-stream`, `x-accel-buffering: no`, `Transfer-Encoding: chunked`; `notifications/subscriptions/acknowledged` at 1 s naming the honoured filter |
| Keep-alive comments | `: keepalive` every 15 s, unbroken |
| 10-minute stream | **passed** — one stream held open for **841 s (14 min 01 s)** from a browser, 56 keep-alive frames, no gap and no reconnect |
| Graceful end and re-listen | at 841 s the server sent the `subscriptions/listen` **result** (`resultType: "complete"`, carrying the subscription id and `serverInfo`) rather than dropping the connection — the protocol's "listen again". A new listen was acknowledged at once and heard the next change 12 s later |
| A change made in **another** Lambda invocation | `graph.summary` called over the protocol (which cut this graph's first revision) produced `notifications/resources/updated` for `plastic://graph/<id>` and `…/history` **28 s later on the open stream** — the first poll after the record landed |
| An execution finishing | a graph run through its HTTP entry produced `…/executions` 12 s later on a stream subscribed to it |
| Filtering | a stream subscribed to `…/executions` alone was **not** sent the `…/execution/<id>` event, and one subscribed to `…/history` alone was not sent the graph event |
| Concurrency | three streams open at once from one page, each in its own Lambda sandbox, each with its own feed |
| Unauthenticated / expired token | 401 with `WWW-Authenticate`; the log says which (`Rejected token: "exp" claim timestamp check failed`) |

## What this found that tests would not have

**An execution index is not in id order.** An execution id is made where the execution starts — the server for one it owns, the browser for one the browser owns — so `executions/by-graph/<graph>/` is sorted by an id whose clock is not one clock. On the dev stage a browser-owned execution sat at the top of the listing with every later server execution below it, and a feed keyed on "the largest id seen" announced **nothing** for a graph that was running. The feed tracks membership instead, which is ordering-free; the regression test uses the two real ids.

**A stream's feed has to die with its stream.** A Lambda container is reused. A feed left polling after its client went away would read the store on the next request's time, for nobody — so the response body is wrapped and everything the stream held is released once, on end or on cancel. Related: a request rebuilt without its `signal` can never be told the client cancelled, which the re-listen test caught.

## Decision

D-3 is **confirmed**: MCP stays on `POST /mcp` for request/response, and `subscriptions/listen` is served by a Function URL with response streaming. The fallback (poll `observations.query {since}`) is not needed and stays available — nothing about the read tools changed.

Two limits worth stating rather than hiding. A stream ends after **14 minutes** (`MCP_STREAM_MAX_MS`) because the invocation ends at 15, and ending gracefully is the protocol's way of saying "listen again"; a client that wants a continuous view re-listens, as the spec expects. And the feed's resolution is its poll interval (`MCP_STREAM_POLL_MS`, 2 s), so a change is announced within a few seconds of being written, not the instant it is written — which is the right trade for a channel that says "re-read this", not "here is the new value".
