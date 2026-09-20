# Plastic-IO runtimes — current-state discovery record

Scope: the two graph execution runtimes only.

| Runtime | Repo (read-only clone) | Commit | Declared version |
|---|---|---|---|
| TypeScript scheduler `@plastic-io/plastic-io` | `scratchpad/repos/plastic-io` (branch master) | `c9e19bec88f97e291cb1b3e9f308c564a60dba59` ("Merge pull request #75 from plastic-io/next") | `package.json:6` `"version": "2.0.3"`; only git tag is `v1.0.0` at `ff9387c6` (`git tag -l`, `git show-ref --tags`) |
| Rust runtime `plastic-io` (crate) | `scratchpad/repos/plastic-io-rust` (branch main) | `4fee99f897a87e287ad8ada8b3060ac1e32ad70e` ("switched to rt from multi-channel for wasm compat", 2024-03-02) | `Cargo.toml:2-3` `name = "plastic-io"`, `version = "0.1.0"`; 19 commits total, all between 2024-02-11 and 2024-03-02 (`git log`) |

All paths below are relative to the respective repo root unless absolute. Every claim cites `path:lineStart-lineEnd` and a symbol. Experiments were run in the scratchpad only; graph-editor and graph-server were not modified (only grepped, sections C and H).

---

## A. TypeScript scheduler: types and model

### A.1 The document model (`src/Shared.ts`, `src/Node.ts`, `src/Edge.ts`)

`Graph` — `src/Shared.ts:214-220`:
```ts
export interface Graph {
    id: string;
    url: string;
    nodes: Node[];
    properties: GraphProperties;
    version: number;
}
```

`GraphProperties` — `src/Shared.ts:222-241`: `name`, `description`, `createdBy`, `createdOn: Date`, `lastUpdate: Date`, `exportable: boolean`, `height: number`, `width: number`, `icon: string`. None of these are read by the scheduler (grep of `src/*.ts` for `properties.` finds only the node-level `vect.properties` / `linkedGraph.properties` uses in `src/Node.ts:162,210,331`). They are editor/registry metadata.

`Node` — `src/Node.ts:30-61`:
```ts
export default interface Node {
    id: string;
    linkedGraph?: LinkedGraph;
    linkedNode?: LinkedNode;
    edges: Edge[];            // "Output edges on the node"
    version: number;          // "Used along with graphId to locate nodes in linked resources"
    graphId: string;
    url: string;              // "The URL to this node, combined with the node's graphId"
    data: any;
    properties: any;          // "placement in the UI, executable code, and other meta properties"
    template: NodeTemplate;
    __contextId: any;         // "Ephemeral value that should not be committed to a data store"
}
```

`Edge` — `src/Edge.ts:6-11`:
```ts
export default interface Edge {
    field: string;
    connectors: Connector[];
}
```

`Connector` — `src/Shared.ts:33-44`:
```ts
export interface Connector {
    id: string;
    nodeId: string;    // "Node.id this connector connects to"
    field: string;     // "Edge name this connector connects to"
    graphId: string;   // "The graph id the node belongs to"
    version: number;   // "The graph version this node belongs to"
}
```

`NodeTemplate` — `src/Shared.ts:62-64`: `{ set: string }`. The doc comment (`src/Shared.ts:56-61`) says it may be "extended to contain other templates, for example Vue or React templates" — but the scheduler source only ever reads `template.set` (`src/Node.ts:333-335`). There is no Vue/React template compilation anywhere in `src/` (grep for `vue`, `React`, `template.` finds only `template.set`). The README claim "Graphs support templating engines to create UIs" (`README.md:24`) is not implemented in this package.

`LinkedNode` — `src/Shared.ts:66-75`: `{ id, version, node?: Node, loaded: boolean }`.

`LinkedGraph` — `src/Shared.ts:77-103`: `{ id, version, graph: Graph, loaded: boolean, data: {[nodeId]: any}, properties: {[nodeId]: object}, fields: { inputs: {[hostField]: FieldMap}, outputs: {[hostField]: FieldMap} } }`.

`FieldMap` — `src/Shared.ts:46-55`: `{ id: string /* inner node id */, field: string /* inner edge name */, type: string, external: boolean }`.

`ExecutionResult` — `src/Shared.ts:243-245`: `{ nodes: Node[] }` — always returned as `{nodes: []}` (`src/Scheduler.ts:327-329`), i.e. a stub.

### A.2 Relationships and the "hyperedge"

- graph → `nodes[]` → each node has output `edges[]` → each edge has `connectors[]` → each connector points at a *target* `(graphId, version, nodeId, field)`. The target's `field` is the name the receiving node sees as `field` in its set function (`src/Node.ts:262` passes `connector.field` as the `field` argument of the next `execute`).
- Edges are inputs from the receiver's perspective ("Edges are always inputs (LTR)", `src/Edge.ts:13`) but are stored on the *sender* as outputs (`src/Node.ts:35` "Output edges on the node").
- **Hyperedge**: one `Edge` may have N `connectors` → one `edges.<field> = v` assignment fans out to N targets, iterated in array order (`src/Node.ts:246-298`). There is no notion of an edge with multiple *sources*; fan-in is simply N separate connectors targeting the same `(nodeId, field)`, each producing an independent invocation (see B.5).
- A `Connector` may target a node in a *different* graph (`connector.graphId !== graph.id`, `src/Node.ts:247-249`) which triggers a loader fetch of `artifacts/graph/{id}.{version}`.

### A.3 How the scheduler keys things

| Lookup | Key | Where |
|---|---|---|
| Entry node for `scheduler.url(url)` | `new RegExp(url).test(node.url)` — regex test, first match in `graph.nodes` order | `src/Scheduler.ts:296-299` |
| Connector target | `graph.nodes.find(v => connector.nodeId === v.id)` | `src/Node.ts:250-252` |
| Per-node private cache | `scheduler.nodeCache[vect.id]` (inner node id for linked graphs) | `src/Node.ts:319,328` |
| Linked graph document | `graphPath = "artifacts/graph/{id}.{version}"` | `src/Scheduler.ts:205,242-244` |
| Linked node document | `nodePath = "artifacts/nodes/{id}.{version}"` | `src/Scheduler.ts:206,239-241` |
| Loader cache | by resolved path string | `src/Loader.ts:10-12,35-38,56` |
| Linked-graph input mapping | `linkedGraph.fields.inputs[hostField]` → `{id, field}` → inner node by `id` | `src/Node.ts:130-138` |
| Linked-graph output mapping | `linkedGraph.fields.outputs[hostField]` → inner node `id` + inner edge `field`; host connectors are *pushed onto the inner node's edge* | `src/Node.ts:163-183` |

Note the regex entry match: `url("index")` also matches a node whose url is `"index2"`, and `url(".")` matches any non-empty url. `url` is compiled with `new RegExp(url)` with no escaping (`src/Scheduler.ts:296`).

### A.4 Runtime-relevant vs editor-only fields

Read by the runtime: `graph.id`, `graph.nodes`; `node.id`, `node.url`, `node.edges[].field`, `node.edges[].connectors[]`, `node.linkedGraph`, `node.linkedNode`, `node.template.set`, `node.data`, `node.properties` (passed through opaquely as `properties`/`data` bindings, `src/Node.ts:330-331`), `node.graphId` (event payloads only, `src/Node.ts:80`). `connector.{nodeId, field, graphId, version, id}`.

Never read by the runtime: `graph.url`, `graph.version` (2.0.3; 2.0.1 read it — see C.3), all of `GraphProperties` (`height`, `width`, `icon`, `exportable`, timestamps), `node.version` (only `linkedNode.version`/`linkedGraph.version`/`connector.version` are used), `node.__contextId`, `FieldMap.type`, `FieldMap.external`. Node positions/appearance are not modelled at all in this package: they live inside the opaque `node.properties` (the doc comment at `src/Node.ts:48-53` says "placement in the UI"). The `"type": "normal"` seen on connectors in `tests/stubs/proxyToLog.json:15` is likewise ignored (not in the `Connector` interface).

---

## B. TypeScript scheduler: execution semantics

### B.1 Entry API

`Scheduler` constructor — `src/Scheduler.ts:181-211`: `constructor(graph: Graph, context: object = {}, state: object = {}, logger: Logger = nullLogger)`. Throws `"No graph was passed to the scheduler constructor."` if `graph` is falsy (`:183-185`). Sets `graphPath`/`nodePath` templates (`:205-206`), creates `graphLoader`/`nodeLoader` (`:208-209`), `nodeCache = {}` (`:204`), `events = {}` (`:203`).

Entry — `src/Scheduler.ts:282`: `async url(url: string, value: any, field: string, currentNode: Node): Promise<ExecutionResult>`. All four parameters are required by the TS signature (JS callers such as the tests call `scheduler.url("index")` with one argument, `tests/unit/Scheduler.spec.js:150`; graph-server passes `null` for `currentNode`, see H).

Trace of `url()`:
1. `dispatchEvent("begin", {url, time, id})` — `:285-289`.
2. Graph selection: if `currentNode?.linkedGraph?.graph` use that inner graph, else `this.graph` — `:290-295` (this is how the editor invokes nodes inside an already-loaded linked graph, doc at `:274-281`).
3. Entry node by regex (A.3) — `:296-299`. No node → `logger.warn` + `dispatchEvent("warning", {url, time, id, message: "Cannot find node at the specified URL."})` — `:300-308`.
4. `try { await execute(this, graph, node, field, value) } catch (err) { dispatchEvent("error", {time, id, err}) }` — `:309-320` (`execute` is `Edge.execute`).
5. `dispatchEvent("end", {url, time, id, duration})` — `:321-326`; return `{nodes: []}` — `:327-329`.

### B.2 Edge.execute (`src/Edge.ts:14-64`)

Returns `new Promise(async (resolve, reject) => …)`. Dispatches `beginedge` `{time, id, nodeId, graphId, field, value}` (`:17-24`), calls `Node.execute` (`:45`), and on settle calls `end(er)` (`:28-43`) which **rejects if `er`** (`:29-31`), then dispatches `endedge` `{time, id, duration, nodeId, graphId, field, value}` (`:33-41`) and calls `resolve()` (`:42`, a no-op after reject). On `Node.execute` rejection it also dispatches `error` `{id, time, err: new Error("Edge: Error occurred during node.execute: " + err), message, nodeId, graphId, field, value}` (`:47-59`). So `endedge` is emitted even for failed edges.

### B.3 Node.execute (`src/Node.ts:187-368`) — linked resources, bindings, dispatch

1. **Linked node** (`:191-212`): if `node.linkedNode && !loaded`, `await scheduler.nodeLoader.load(getNodePath(id, version))` (`:193`); if the loader returns falsy → `error` event `"Node: Critical Error: Linked node not found on node.id: …"` (`:194-204`) and execution *continues with the host node* (falls through; the host's `template` is `{}` in `tests/stubs/linkedLogNode.json:14` so it then hits the "No template" error at `:355-367`). On success the loaded node replaces `vect`, and **the host's `data`/`properties` overwrite the published node's** (`:208-210`).
2. **Linked graph** (`:213-237`): if `!loaded`, `await scheduler.graphLoader.load(getGraphPath(id, version))` (`:216`), then `linkInnerNodeEdges(vect, scheduler)` (`:217`), which throws `"Critical Error: Linked graph not found on node.id: …"` if the graph is missing (`:150-152`). That throw propagates out of `Node.execute` → `Edge.execute` catch → `error` event + rejection → and, at top level, `Scheduler.url`'s catch dispatches a *second* `error` event (`src/Scheduler.ts:313-319`). Verified: one failed linked-graph load yields **2 error events** — `[0] "Error: Edge: Error occurred during node.execute: Error: Critical Error: Linked graph not found on node.id: 2"`, `[1] "Error: Critical Error: Linked graph not found on node.id: 2"` (experiment against `dist/` at HEAD with `tests/stubs/linkedGraph.json` and `fetch = () => ({json: () => undefined})`). The `if (node.linkedGraph && !node.linkedGraph.graph)` branch at `:220-230` is therefore unreachable for a missing graph (coverage report confirms `221-223` uncovered, see C.1).
   - `linkInnerNodeEdges` (`:145-185`) **mutates the loaded (cached) inner graph in place**: overlays `linkedGraph.data[innerId]` onto inner `v.data` (`:158-161`), `linkedGraph.properties[innerId]` onto `v.properties` (`:162`), and pushes the host node's output connectors onto the mapped inner node's edge, de-duplicated by connector id only (`:163-183`). Because `Loader.cache` returns the same object for the same path (`src/Loader.ts:35-38`), two host nodes linking the same graph/version (e.g. nodes `2` and `3` in `tests/stubs/cacheLinkedGraph.json`) share one inner graph object; the second host's `data`/`properties` overlay wins and both hosts' output connectors accumulate on the same inner edges. This aliasing is not covered by a test (the cacheLinkedGraph test only counts fetches, `tests/unit/Scheduler.spec.js:81-96`).
   - Input mapping `getLinkedInputs` (`:121-143`): replaces `(vect, field)` with the inner node/field from `fields.inputs[field]` (`:130-138`); if there is no mapping for `field`, the *host* node itself is executed (`:139-142`) — with the inner graph as `graph` (`:232`).
3. **The `edges` object** (`:238-317`): a plain `{}` with one `Object.defineProperty(edges, edge.field, { set: async (setterVal) => … })` per output edge (`:241-243`). There is **no getter** (reading `edges.x` yields `undefined`; `Object.keys(edges)` is empty because the properties are non-enumerable — verified: `edgesKeys=` is empty in experiment C). Function-call style `edges.x(v)` is not supported (no such property value); dispatch is assignment only.
4. **Setter / fan-out** (`:243-315`): the setter synchronously calls `setter(setterVal)` (`:300`) which is an `async function` that `for (const connector of edge.connectors)` (`:246`):
   - if `connector.graphId !== graph.id` → `graph = await scheduler.graphLoader.load(…)` (`:247-249`). Note this **reassigns the enclosing `execute`'s `graph` parameter** for the rest of the loop, for every later invocation of every setter of this node, and for the `graphId` in subsequent error payloads (`:281,295,312`) — a latent cross-graph bug; not covered by tests (no stub has a cross-graph connector).
   - `nodeNext = graph.nodes.find(v => connector.nodeId === v.id)` (`:250-252`); if missing → `error` event `"Connector refers to a node edge that does not exist.  Connector.id: …"` (`:284-297`) and the loop continues.
   - `dispatchEvent("beginconnector", {time, id, connector, value})` (`:256-261`), then **`edgeExecute(...)` is called but not awaited** (`:262`); its `.then` dispatches `endconnector` `{time, duration, id, connector, value}` (`:262-270`) and `.catch` dispatches `error` `{…, edgeField, connectorId, nodeId, graphId}` (`:271-283`).
   - `setter(...).then(log).catch(error event "Node: Edge setter error. field …")` (`:300-314`) — the only way `setter` itself rejects is a throw inside the loop, e.g. the malformed-schema stub where `edge.connectors` is undefined (`tests/stubs/malformedSchema.json:5-7`, test at `tests/unit/Scheduler.spec.js:378-391`).
5. **nodeInterface + set invocation** (`:318-354`): `scheduler.nodeCache[vect.id] ||= {}` (`:319`); `nodeInterface = {scheduler, edges, state: scheduler.state, field, value, node: vect, cache, graph, data: vect.data, properties: vect.properties}` (`:321-332`). If `vect.template.set` is truthy → `parseAndRun(...)` **not awaited** (`:335`); on fulfil → `afterSet` `{id, return: setResult, time, nodeInterface}` (`:336-341`); on reject → `logger.error("Node: set function caused an error: …")` + `error` `{id, time, err, message, nodeId, graphId, field}` (`:342-354`). Empty/missing `set` on a non-linked-graph node → `error` `"Node: No template for set found on node.id …"` (`:355-367`). A linked-graph host node with `template: {}` is silently accepted (`:355`).

### B.4 Compilation and the exact bindings (`parseAndRun`, `src/Node.ts:63-119`)

- Parse: `meriyah.parseScript(code, {loc: true, module: true, next: true, globalReturn: true})` (`:66-71`), regenerate with `escodegen.generate(ast)` (`:76`). Purpose: validate syntax and permit top-level `return` (`globalReturn`). Dependencies: `meriyah ^1.9.12`, `escodegen ^1.14.1` (`package.json:44-46`); resolved as `meriyah 1.9.15` in the clone, in graph-server's root `node_modules`, and in graph-editor's nested `node_modules/@plastic-io/plastic-io/node_modules/meriyah` (the editor's own root has `meriyah ^4.3.3`, `graph-editor/package.json:44`, but the scheduler does not resolve to it — `require.resolve` from the package dir returns the nested 1.9.15).
- **Top-level `await` does not parse** under these options with meriyah 1.9.15: `parseScript("await 1;", opts)` → `[1:5]: 'Await' may not be used as an identifier in this context`; same for `const x = await p;` and `return await 1;`; `(async()=>{ await 1; })()` parses (verified in the clone). meriyah 4.3.3 parses all four (verified with the editor's root copy) — but that copy is not the one the scheduler uses. Consequence: a set function can only use `await` inside a nested async function, or return a Promise (`return new Promise(...)` works, experiment B2).
- Compile: `const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor; new AsyncFunction("scheduler","graph","cache","node","field","state","value","edges","data","properties","require", generatedCode)` (`:74-76`). This is `Function`-constructor compilation in the host realm — **no sandbox, no separate context**; the code sees every host global.
- `set` event before invocation: `{id, nodeId, graphId, field, time, nodeInterface, setContext(val)}` (`:77-88`); `setContext` assigns `nodeInterface.context`, which becomes the `this` of the call (`:84-87, :91`). If no listener calls `setContext`, `this` is `undefined` (constructor `context` at `src/Scheduler.ts:127,201` is stored on the scheduler but **never passed** to the node — verified: `this.ctxTag=undefined` in experiment C even though the scheduler was constructed with `{ctxTag:"CTX"}`; only `set`-listener `setContext` populates `this`. graph-server and the editor both rely on `setContext`, see H).
- Call (`:90-105`), positional bindings in order:

| Binding | Value | Line |
|---|---|---|
| `this` | `nodeInterface.context` (set via `set` event `setContext`, else `undefined`) | `:91` |
| `scheduler` | the `Scheduler` instance (full API: `url`, `addEventListener`, `state`, `graph`, loaders…) | `:92` |
| `graph` | the graph the node lives in (inner graph for linked-graph nodes, `:232`) | `:93` |
| `cache` | `scheduler.nodeCache[vect.id]` — per-node-id object, shared across invocations and across linked-graph instances with the same inner id | `:94`, `:319,328` |
| `node` | the node object (`vect`) | `:95` |
| `field` | receiving edge name (connector.field or the `url()` `field` arg) | `:96` |
| `state` | `scheduler.state` — the constructor's `state` object, one per scheduler, shared by all nodes and all runs | `:97`, `src/Scheduler.ts:129,202` |
| `value` | the incoming value, passed by reference (verified: mutation in the receiver is visible to the sender, experiment F) | `:98` |
| `edges` | the setter-only object of B.3 | `:99` |
| `data` | `vect.data` | `:100` |
| `properties` | `vect.properties` | `:101` |
| `require` | `(path) => eval("require")(path)` — the host's CommonJS `require` (works in Node; verified `require('os').platform()` returns a string, experiment C) | `:102-104` |

- Result: `Promise.resolve(nodeFn.call(...)).then(resolve).catch(reject)` (`:90-113`); parse/compile errors are caught by the outer `try` and rejected (`:114-117`).
- **Ambient authority**: the code runs in the host global scope; verified in experiment C on Node 25: `typeof fetch=function typeof process=object typeof require=function typeof scheduler.url=function`. In a browser worker (editor) it sees `self`, `fetch`, `postMessage`, `importScripts`, etc. There is no allow-list, no `vm`/`Realm`, no CSP hook.

### B.5 Dispatch order, sync/async model, fan-in, cycles

Verified with `scratchpad/ts-experiments/exp.js` and `exp2.js` against the HEAD build (identical to the editor's 2.0.3 dist, see C.2):

- **Synchronous depth-first prefix.** Everything from `url()` down through connectors runs synchronously on the caller's stack until the first genuine `await` (a loader fetch or a promise returned by user code). Experiment A order: `begin, beginedge(a), set, a:set, beginconnector(c1), beginedge(b), set, b:set, beginconnector(c2), beginedge(c), set, c:set, a:after-assign, <url() returned synchronously here>, …`. This is also what makes `tests/unit/Scheduler.spec.js:35-36` pass without awaiting `url()`.
- **Fan-out order** = `edge.connectors` array order (`src/Node.ts:246`); each target's synchronous prefix completes before the next connector starts (depth-first), because `edgeExecute` runs synchronously up to its first await.
- **Sibling isolation on error**: `b` threw `"b boom"`; `c` still ran; only **one** `error` event was emitted (2.0.3), and `endconnector(c1)` still fired because set-function errors never reject `Node.execute` in 2.0.3 (they are caught at `src/Node.ts:342-354`). Experiment A tail: `endedge(b), endedge(c), endedge(a), error(b):Error: b boom, endconnector(c1), afterSet(c)="c-done", endconnector(c2), afterSet(a)=undefined, end`.
- **Fan-in / join**: absent. There is no accumulation of inputs; each connector delivery is an independent `Node.execute` with its own `value` and `field`. Joining state must be done by the node author in `cache`/`state`. (Checked: no code path in `src/Node.ts` inspects other incoming connectors.)
- **Cycles**: permitted, no guard, no visited-set (checked `src/Node.ts:238-317`, `src/Scheduler.ts:282-330`). A bounded self-loop works (experiment D: `a:v=0 … a:v=3` recursively, all inside the synchronous prefix). An **unbounded synchronous self-loop overflows the stack**: 153 hops (2.0.3) / 170 hops (2.0.1) then `error(a):RangeError: Maximum call stack size exceeded` (one error event, the recursion unwinds, the process survives; in 2.0.1 Node also printed `Exception in PromiseRejectCallback … RangeError` to stderr). An unbounded *asynchronous* loop (each hop after a timer) would run forever — there is no hop budget.
- **When is a run "done"?** In 2.0.3, `url()` resolves when the entry node's `Node.execute` resolves, which happens as soon as `parseAndRun` has been *started* (`src/Node.ts:335` is not awaited). Experiment B2 (entry set returns a Promise that fires after a 20 ms timer): `begin, beginedge(a), a:sync-part, <url() returned>, endedge(a), end, <url() promise resolved>, a:timer-fired, beginconnector(c1), beginedge(b), b:set, endedge(b), afterSet(b), endconnector(c1), afterSet(a)="a-done"`. So **`end`, `endedge` and `url()` resolution all precede the entry node's asynchronous work and everything downstream of it.** The only completion signal for async graphs is the scheduler falling silent; there is no "all in-flight promises settled" event. The `endedge` doc comment ("Occurs after all all edge promises are completed", `src/Scheduler.ts:71-75`) is not accurate for 2.0.3.
- **Event ordering for a purely synchronous entry node** (spec `tests/unit/Scheduler.spec.js:232-251` and `:252-276`): `begin, beginedge, endedge, afterSet, end` (microtask interleaving: `afterSet` lands before `end` because the `parseAndRun` continuation is queued before `url()`'s continuation).

### B.6 Events — the complete observability surface

`dispatchEvent` (`src/Scheduler.ts:231-238`) runs listeners **synchronously, in registration order, with `this` = scheduler, and without try/catch** — a throwing listener propagates into the dispatcher (the editor exploits this for its "panic" stop, see H). `addEventListener`/`removeEventListener` at `:225-229`/`:213-223`. The typed `begin/…/afterSet` properties on the class (`:65-115`, assigned no-op arrows at `:187-198`) are documentation stubs only (`:186`) and are never invoked by the scheduler.

| Event | Emitted at | Payload |
|---|---|---|
| `begin` | `src/Scheduler.ts:285-289` | `{url, time, id}` |
| `warning` | `src/Scheduler.ts:302-307` | `{url, time, id, message: "Cannot find node at the specified URL."}` |
| `load` | `src/Loader.ts:25-34` | `{time, id, url, setValue(val)}` — calling `setValue` writes `cache[url]` and pre-empts `fetch` |
| `beginedge` | `src/Edge.ts:17-24` | `{time, id, nodeId, graphId, field, value}` |
| `endedge` | `src/Edge.ts:33-41` | `{time, id, duration, nodeId, graphId, field, value}` |
| `set` | `src/Node.ts:77-88` | `{id, nodeId, graphId, field, time, nodeInterface, setContext}` |
| `afterSet` | `src/Node.ts:336-341` | `{id, return, time, nodeInterface}` — success only in 2.0.3 (`err` is typed at `src/Shared.ts:145-147` but never set) |
| `beginconnector` | `src/Node.ts:256-261` | `{time, id, connector, value}` |
| `endconnector` | `src/Node.ts:264-270` | `{time, duration, id, connector, value}` |
| `error` | `src/Edge.ts:50-59`; `src/Node.ts:197-204, 223-230, 273-282, 287-296, 305-313, 345-353, 358-366`; `src/Loader.ts:45-51`; `src/Scheduler.ts:314-318` | `{id, time, err, message?, nodeId?, graphId?, field?, value?, edgeField?, connectorId?, url?}` — shape varies per site; only `id, time, err` are guaranteed (`EdgeError`, `src/Shared.ts:256-261`) |
| `end` | `src/Scheduler.ts:321-326` | `{url, time, id, duration}` |

`Logger` (`src/Shared.ts:182-193`) is a second, informal channel: every `logger.error(...)` call site also emits `error` except `src/Edge.ts:49` (which passes the Error object rather than `.stack`).

### B.7 Loader (`src/Loader.ts:9-59`)

`Loader<T>` with `cache: {[url]: T}` (`:10-12`), `clearCache()` (`:18-22`), `async load(url)` (`:23-58`): dispatch `load` (`:25-34`) → cache hit returns (`:35-38`) → if `typeof fetch === "undefined"` log + `error` event + **throw** (`:40-53`) → else `await fetch(url)`, `await data.json()`, cache, return (`:54-57`). No timeout, no retry, no content validation (a `json()` returning `undefined` is cached as-is and surfaces later as "Linked … not found"). The cache is keyed by the path string and lives for the scheduler's lifetime. `linkedCycleInner/Outer` stubs: `tests/stubs/linkedCycleOuter.json` node `2` links graph `"inner"` with `inputs.proxy → inner node 1` and `outputs.proxy → inner node 2`; `tests/stubs/linkedCycleInner.json` node `1 → 2` with node `2`'s `proxy` edge empty (connectors are spliced in by `linkInnerNodeEdges`), so the value flows outer 1 → inner 1 → inner 2 → outer Z. The test (`tests/unit/Scheduler.spec.js:97-112`) asserts `console.info` was called with the value. Despite the name, nothing cycles back: it is a round-trip into and out of a linked graph, not a cycle.

### B.8 State scope summary

| Object | Scope | Evidence |
|---|---|---|
| `state` | per `Scheduler` instance, shared by every node and every `url()` call; caller-supplied and mutable | `src/Scheduler.ts:129,202`; `src/Node.ts:324` |
| `cache` | per `nodeCache[vect.id]`; survives across runs; **collides across instances of the same linked graph** (inner ids are equal) | `src/Node.ts:319,328` |
| `context` (ctor) | stored, never used | `src/Scheduler.ts:127,201`; grep shows no other reader |
| `this` | per invocation, from `set` listener `setContext` | `src/Node.ts:84-87,91` |
| `sequence` | declared "Edge traversal counter", initialised to 0, never incremented | `src/Scheduler.ts:125,200` |
| Loader caches | per scheduler | `src/Scheduler.ts:208-209` |

### B.9 Absent features (checked)

- **Cancellation**: absent. No abort token, no `stop()`; grep of `src/` for `abort|cancel|stop|terminate` finds nothing. Once `url()` is called the synchronous prefix cannot be interrupted, and in-flight promises cannot be revoked. The editor's workaround is to throw from a `beginedge` listener (H).
- **Timeouts**: absent (no `setTimeout` in `src/`; graph-server wraps the whole invocation in its own `responseTimeout` timer, `graph-server/src/graphService.ts:271,283,456`).
- **Resource limits / sandboxing**: absent (B.4).
- **Hop / recursion limits**: absent (B.5).
- **Structured completion**: absent (B.5).

---

## C. TypeScript scheduler: tests and dist skew

### C.1 Build and test of HEAD (clone)

Environment: Node `v25.7.0`, npm `11.10.1`. Commands run in the clone: `npm ci` → "added 774 packages … 26 vulnerabilities (4 low, 5 moderate, 16 high, 1 critical)"; `npm run build` (`tsc`, `package.json:15`) → clean; `npm test` (`jest`, `package.json:17`; the spec `require`s `../../dist/index.js` at `tests/unit/Scheduler.spec.js:3`, so the build must precede the test — the repo scripts do not chain them; `jest.config.js:7-9` collects coverage from `dist/**/*.js`).

```
PASS tests/unit/Scheduler.spec.js
  Basic scheduler functions (3 tests)
  Scheduler graph linking input and output connectors (5 tests)
  Scheduler node linking (1 test)
  Scheduler event emitter and scheduler sequence validation (9 tests)
  Scheduler error states and matching error events (9 tests)
--------------|---------|----------|---------|---------|---------------------------
File          | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
All files     |   96.14 |    92.85 |   86.76 |   96.61 |
 Edge.ts      |     100 |      100 |     100 |     100 |
 Loader.ts    |     100 |      100 |     100 |     100 |
 Node.ts      |   93.61 |    96.96 |   82.75 |   93.93 | 85-86,103,111-112,221-223
 Scheduler.ts |   97.05 |    83.33 |   95.23 |   98.63 | 292
 Shared.ts    |     100 |      100 |     100 |     100 |
Test Suites: 1 passed, 1 total
Tests:       27 passed, 27 total
Time:        0.502 s
```

(The stack trace printed above `PASS` is the expected `console.error` from the cacheLinkedGraph test at `tests/unit/Scheduler.spec.js:82-95`.) Uncovered: `setContext` (`src/Node.ts:85-86`), the `require` shim (`:103`), the compiled-function-error debug branch (`:111-112`), the unreachable missing-graph branch (`:221-223`), and `url()` with `currentNode.linkedGraph` (`src/Scheduler.ts:292`).

Test-quality notes: several assertions are inside `setTimeout` callbacks (`tests/unit/Scheduler.spec.js:58-61, 73-79, 108-111, …`) which works only because execution is synchronous up to the first await; `tests/unit/Scheduler.spec.js:271-276` calls `done()` *before* its `setTimeout` assertion, so that expectation cannot fail the test; `tests/unit/Scheduler.spec.js:365-377` collects `afterSet` `e.err` into `evs` but never asserts on it (in 2.0.3 `afterSet` no longer fires on error, so `evs` is empty and the test still passes). No test exercises cross-graph connectors (`src/Node.ts:247-249`), fan-out to more than one node beyond `cacheLinkedGraph`, or async set functions.

CI (`.github/workflows/continuous-integration-workflow.yml`): on push to `master`: Node 16 → `npm install`, `npm run build`, `npm run build-docs`, `npm run lint`, `npm test`, publish docs to gh-pages; a second job on Node 10 runs `npm ci && npm run build` and publishes to npm with `check-version: false`. PR workflow (`pull-request-test-workflow.yml`): Node 16, install/build/lint/test.

### C.2 Which commit is which npm version

`git log -p -- package.json` (version-bump commits): `c9df8b8` 2022-11-26 1.0.18→2.0.0 ("renamed node"); `08c7b6a` 2022-11-26 2.0.0→**2.0.1** ("ticked version due to error type update"); `a9e7dbb` 2024-01-05 2.0.1→2.0.2 ("better error handling"); `e559e31` 2024-02-08 2.0.2→**2.0.3** ("removed connector version match check"); HEAD `c9e19be` is the merge of that. `git diff 08c7b6a 035e2b8 -- src` is empty, so every 2.0.1-era commit has the same source.

Verification by rebuild:
- `git worktree add ../plastic-io-v201 08c7b6a` → `npm ci && npm run build` → `diff -r` of the six `dist/*.js` (after stripping the `//# sourceMappingURL` line) against `/Users/tonygermaneri/gh/graph-server/node_modules/@plastic-io/plastic-io/dist` → **IDENTICAL**; all six `.d.ts` identical. So the server's installed 2.0.1 is exactly the source at `08c7b6a`.
- HEAD build `dist/*.js` (sourcemap line stripped) vs `/Users/tonygermaneri/gh/graph-editor/node_modules/@plastic-io/plastic-io/dist` → **no diff**; all `.d.ts` identical. So the editor's installed 2.0.3 is exactly HEAD.
- The inline source maps carry no `sourcesContent` (tsconfig has `inlineSourceMap` but not `inlineSources`, `tsconfig.json:11`), hence the rebuild route.

### C.3 2.0.1 (server) vs 2.0.3 (editor): semantic differences

`diff -rq` of the installed dists: `Edge.d.ts`, `Edge.js`, `Node.js`, `Scheduler.js` differ; `Loader.*`, `Shared.*`, `index.*`, `Node.d.ts`, `Scheduler.d.ts` identical. Source-level diff (`git diff 08c7b6a HEAD -- src`: Edge.ts +78/−, Node.ts 158 lines, Scheduler.ts +10):

| # | Area | 2.0.1 (server, `08c7b6a`) | 2.0.3 (editor, HEAD) | Consequence |
|---|---|---|---|---|
| 1 | `Edge.execute` signature | `async function … Promise<any>`, awaited `nodeExecute`, `.catch` swallowed the error and always called `end()` — **never rejected** | `new Promise` that **rejects** on node failure (`src/Edge.ts:14-15,28-31`); `dist/Edge.d.ts:8` now `Promise<void>` | Rejections now reach `Scheduler.url` (caught, `src/Scheduler.ts:311-319`, added in 2.0.3) and connector `.catch` (`src/Node.ts:271-283`) → duplicated `error` events for load failures (B.3) |
| 2 | Set-function invocation | `setResult = await parseAndRun(...)` inside try/catch; `afterSet` **always** dispatched with `{err, return}` (2.0.1 `src/Node.ts` ≈ `dist/Node.js:331-365` in the server copy) | `parseAndRun(...).then(afterSet).catch(error)` — **not awaited** (`src/Node.ts:335-354`) | (a) `url()` / `endedge` / `end` no longer wait for the entry node's async work (B.5, experiment B2: in 2.0.1 the order was `a:timer-fired … afterSet(a) … endedge(a) … end, <url() resolved>`; in 2.0.3 `end` and `<url() resolved>` come **before** `a:timer-fired`). (b) `afterSet` no longer fires on error and never carries `err`. (c) `endedge` now precedes `afterSet` for the same node. |
| 3 | Connector loop | `await edgeExecute(...)` then `endconnector` — connectors **serialised**: connector 2 started only after connector 1's whole (async) chain finished (experiment A on 2.0.1: `… endconnector(c1), beginconnector(c2), beginedge(c) …`) | `edgeExecute(...).then(endconnector).catch(error)` — fire-and-forget (`src/Node.ts:262-283`) | In 2.0.3 fan-out targets run concurrently after their synchronous prefixes; a slow/async first target no longer delays the second. Also the setter's promise no longer reflects downstream completion. |
| 4 | Cross-graph reload test | `if (connector.graphId !== graph.id \|\| connector.version !== graph.version)` (server `dist/Node.js:224`) | `if (connector.graphId !== graph.id)` (`src/Node.ts:247`; editor `dist/Node.js:237`) | On 2.0.1 a connector whose `version` differs from the *current graph's* `version` (e.g. editor-saved graphs whose `graph.version` increments while connectors keep `version: 0`) triggers a `graphLoader.load("artifacts/graph/{id}.{version}")` fetch for every such connector; on 2.0.3 it does not. |
| 5 | `parseAndRun` parse errors | thrown synchronously (still caught by the `await` try/catch) | wrapped in `new Promise` + try/catch → rejection (`src/Node.ts:64-65,114-117`) | Same observable outcome (`error` event) except for #2(b) |
| 6 | Error text | `"Edge: Error occured during node.execute: " + err.stack` (server `dist/Edge.js:73`) | `"Edge: Error occurred during node.execute: " + err` (`src/Edge.ts:48`; editor `dist/Edge.js:76`) | Message text changed; graph-server matches nothing on it (grep) |
| 7 | `Scheduler.url` | no try/catch around `await execute` | try/catch → `error {time, id, err}` (`src/Scheduler.ts:311-319`) | `url()` never rejects in either version (2.0.1: Edge never rejected; 2.0.3: caught) |

Would a component break moving between versions? A node whose set function performs async work and whose *host* (graph-server) relies on `scheduler.url(...).then(postGraph)` to know that work is finished (`graph-server/src/graphService.ts:475`) behaves differently: on 2.0.1 `postGraph` runs after the entry node's promise settles; on 2.0.3 it runs after only the synchronous prefix. Nodes that read `e.err` from `afterSet` stop seeing errors on 2.0.3. Nodes with connectors whose `version` lags `graph.version` trigger loader fetches on 2.0.1 only.

Both installed copies resolve `meriyah 1.9.15` (server: root `node_modules`; editor: nested under the package because the root pins 4.3.3), so the top-level-`await` parse limitation of B.4 applies to both deployments.

---

## D. Rust runtime: types and loading

### D.1 `src/types.rs` (all structs `#[derive(Debug, Clone, Serialize, Deserialize)]` + `#[serde(rename_all = "camelCase")]`; serde defaults apply: unknown JSON fields are ignored, missing non-`Option` fields are hard errors)

```rust
pub struct Graph { pub id: String, pub url: String, pub nodes: Vec<Node>, pub properties: GraphProperties, pub version: u32 }                // :47-55
pub struct GraphProperties { pub name: String, pub description: String, pub created_by: String, pub created_on: DateTime<Utc>,
                             pub last_update: DateTime<Utc>, pub exportable: bool, pub height: u32, pub width: u32, pub icon: String }      // :57-69
pub struct Node { pub id: String, pub linked_graph: Option<LinkedGraph>, pub linked_node: Option<LinkedNode>, pub edges: Vec<Edge>,
                  pub version: u32, pub graph_id: String, pub url: String, pub data: String, pub properties: HashMap<String, Value>,
                  pub template: NodeTemplate }                                                                                              // :71-84
pub struct Edge { pub field: String, pub connectors: Vec<Connector>, pub external: bool }                                                   // :86-92
pub struct Connector { pub id: String, pub node_id: String, pub field: String, pub graph_id: String, pub version: u32 }                     // :94-102
pub struct FieldMap { pub id: String, pub field: String, pub data_type: String }                                                            // :104-110
pub struct LinkedNode { pub id: String, pub version: u32, pub node: Option<Box<Node>>, pub loaded: bool }                                   // :112-119
pub struct NodeTemplate { pub set: String }                                                                                                 // :121-125
pub struct LinkedGraph { pub id: String, pub url: String, pub version: u32, pub graph: Option<Box<Graph>>, pub loaded: bool,
                         pub data: HashMap<String, Value>, pub properties: HashMap<String, Value>, pub fields: LinkedGraphFields }           // :127-138
pub struct LinkedGraphFields { pub inputs: HashMap<String, FieldMap>, pub outputs: HashMap<String, FieldMap> }                              // :140-145
pub struct Scheduler { pub graph: Graph, pub id: String, pub event_emitter: Arc<EventEmitter> }   // #[derive(Clone)] only                   // :147-152
pub enum EventType { AfterSet, Begin, BeginConnector, BeginEdge, End, EndConnector, EndEdge, Error, Load, Set, Warning }                     // :12-25
pub struct Event { pub event_type: EventType, pub data: serde_json::Value }                                                                // :27-31
pub struct BusMessage { value, scheduler_id, node_id, graph_id, connector_id, field, connector_field, connector_graph_id, connector_node_id, edge_field }  // :33-45
pub struct EventEmitter { pub subscribers: Arc<Mutex<HashMap<EventType, Vec<Arc<dyn Fn(Event) + Send + Sync>>>>> }                       // :7-10
```

Differences from the TS model (each one either rejects a TS document or drops information):

| Field | TS | Rust | Effect on a TS/editor document |
|---|---|---|---|
| `Graph.url` | optional in practice (test stubs omit it) | required `String` (`:51`) | parse error if absent |
| `GraphProperties.createdOn/lastUpdate` | `Date` (stubs use `0`) | `DateTime<Utc>` — RFC-3339 string (`:63-64`) | numeric timestamps fail to parse |
| `GraphProperties.icon` | present in interface | required `String` (`:68`) | absent in all TS stubs → parse error |
| `Node.data` | `any` | `String` (`:81`) | non-string data fails to parse |
| `Node.properties` | `any` | `HashMap<String, Value>` (`:82`) | must be an object |
| `Node.template` | `NodeTemplate` but stubs use `{}` for linked-graph hosts | `NodeTemplate { set: String }` required (`:83, :123-125`) | `"template": {}` → parse error |
| `Node.__contextId` | present | absent | ignored |
| `Edge.external` | absent | required `bool` (`:91`) | **every TS stub fails**: feeding `tests/stubs/proxyToLog.json` to the CLI → `panicked at src/loader.rs:95:8: Error parsing JSON into Graph: Error("missing field \`external\`", line: 18, column: 17)` (verified) |
| `FieldMap.type`, `.external` | present | replaced by `data_type` (`dataType`) required (`:109`), `external` dropped | TS stubs have neither `dataType` → parse error |
| `LinkedGraph.url` | absent | required (`:131`) — used as a **file path** by the loader | TS documents cannot express it |
| `LinkedGraph.loaded`, `LinkedNode.loaded` | present (`loaded: boolean`) but absent in stubs | required `bool` (`:134`, `:118`) | parse error if absent |
| `LinkedGraph.graph`, `LinkedNode.node` | `graph: Graph` / `node?: Node` | `Option<Box<…>>` (`:133`, `:117`) | fine |
| `Connector.type` (`"normal"` in stubs) | not in interface | not in struct | ignored by both |

`LinkedNode` is parsed but **never used**: grep of `src/` for `linked_node` finds only the struct field (`types.rs:76`) and the fixture nulls. Published/linked nodes are unsupported in Rust.

### D.2 Loading (`src/loader.rs`)

- Sources: `loader::file(path)` reads a file with `std::fs::read_to_string(path).expect("Failed to read test data file")` (`:90-98`); `loader::json(str)` parses an inline string (`:80-87`). Both call `parse_graph` (`:23-25`, `serde_json::from_str`), then `integrate_linked_graphs_with_fields` (`:27-33`), then `set_graph_to_global_store` (`:13-16`) — a process-global `lazy_static! GRAPHS: Mutex<HashMap<String, Graph>>` keyed by `graph.id` (`:7-11`); a second load with the same id silently replaces the first. No URL/HTTP loading exists (grep for `http`, `reqwest`, `fetch`: nothing; `Cargo.toml` has no HTTP crate).
- **Flattening** (`load_and_integrate_linked_graphs_with_fields`, `:35-78`): for each node with `linked_graph`, `take()` it (`:37`, the host node keeps its `edges` and empty `template` but loses `linked_graph`), load `linked_graph.url` **from the filesystem** (`:39-40`, relative to the process cwd), then:
  - *Input rewiring* (`:44-56`): intended to redirect connectors that target the host node to the inner input node. It iterates `global_nodes`, which is **still empty** at this point (nodes are only appended at `:77`, after the loop), and inside it the loop variable `node` **shadows** the host node, so the test `connector.node_id == node.id` (`:48`) compares a connector against the node that owns it. Net effect: input mapping is dead code. Verified at runtime: with `tests/fixtures/graphs/graph_cycle_outer.json --url index --value foo --verbosity 1`, the outer node `1` (`edges.alpha = value`) never runs (`grep -c 'edges.alpha'` on the trace = 0).
  - *Output rewiring* (`:59-73`): for each `outputs[hostField] = {id, field}`, host connectors on the edge named `hostField` are **copied** onto the inner node's edge (`:68`); note `if output_host_field != edge.field { return }` (`:61`) returns from the whole function on the first non-matching edge, aborting further outputs, the recursion into the loaded graph, and the append of this graph's nodes.
  - Recurse into the loaded graph (`:74`); finally `global_nodes.append(&mut graph.nodes)` (`:77`). Result order: deepest linked graph's nodes first, root graph's nodes last (`:32`).
- Consequence for the cycle fixtures: after flattening, `graph.nodes` contains several nodes with `url == "index"` (`graph_cycle_inner.json:32` node `86c4e1de…`; `graph_cycle_outer.json:17` node `1`; likewise `graph_three_cycle_step_three.json` node `92252777…`, `…step_two.json` nodes `e6bdf9c3…` and `02407f01…`, `…step_one.json` node `e2cacfa4…`). `Scheduler::url` picks the **first** match (`src/scheduler.rs:318`), which is the innermost graph's node. The tests `async_linked_cycle_graph` (`src/scheduler.rs:493-518`, expects `"foxtrot foo bar"`) and `async_linked_three_cycle_graph` (`:520-545`, expects `"oscar foo baz bar zaz"`) pass only because the inner entry node's chain reaches the *output*-mapped connector; the outer entry and the input mapping are never exercised. Verified trace: `url → node 86c4e1de… → edges.delta → e4431ec2… → edges.indigo → 5b07b419…` (three AfterSet returns printed in unwind order: `"foxtrot foo bar""foo bar""foo bar"`).
- Fixtures (`tests/fixtures/graphs/`): `graph_minimal.json`, `graph_with_one_js_test.json`, `graph_with_edge.json`, `graph_with_two_edges.json`, `graph_with_two_edges_then_error.json`, `graph_linked.json` (→ `graph_proxy_to_log.json`), `graph_cycle_outer.json` (→ `graph_cycle_inner.json`), `graph_three_cycle_step_one.json` (→ `_two` → `_three`). Every `linkedGraph.url` is a repo-relative path, so tests only pass when run from the crate root.

---

## E. Rust runtime: execution, V8, threads

### E.1 Runtimes and threads

- **Tokio**: `Cargo.toml:17` enables `["sync", "time", "rt", "macros"]` — `rt-multi-thread` is *not* enabled, so only the current-thread flavour is compiled in. Tokio is used **only in tests** (`#[tokio::test]` at `src/scheduler.rs:382,401,420,439,466,493,520`, `tokio::sync::mpsc::channel(1)` and `tokio::time::timeout(5s)` at e.g. `:384,395`). `src/main.rs:34` is a plain `fn main()`; the library never constructs a runtime, never `spawn`s, never uses `spawn_blocking` (grep of `src/` for `tokio::` matches only the test module). The commit message "switched to rt from multi-channel for wasm compat" (`4fee99f`) refers to this feature change.
- **V8 platform**: `Scheduler::initialize_v8` (`src/scheduler.rs:27-34`) under a `static V8_INIT: Once` (`:9`): `v8::new_default_platform(8, true).make_shared()` — 8 platform worker threads, idle-task support on — then `V8::initialize_platform`, `V8::initialize`. Called from `Scheduler::new` (`:13`). **Never disposed**: grep for `dispose` in `src/` finds nothing (`V8::dispose`/`dispose_platform` exist in the crate at `rusty_v8-0.32.1/src/V8.rs:227`).
- **Isolate lifetime**: one **new `Isolate` per node execution** — `v8::Isolate::new(v8::CreateParams::default())` at `src/scheduler.rs:59`, inside `Scheduler::edge`, followed by `HandleScope::new` (`:61`), `Context::new` (`:62`), `ContextScope::new` (`:63`). It is dropped (and disposed by `OwnedIsolate`'s `Drop`, `rusty_v8-0.32.1/src/isolate.rs:887`) when `edge()` returns (`:316`). No snapshot, no context reuse, no isolate pool.
- **Thread ownership**: everything runs on the caller's thread. `Scheduler::url` (`:317`) → `execute_node_by_id` (`:352`) → `edge` (`:49`) → `Script::run` (`:283`) → V8 invokes the property setter (`:96-165`) *on the same thread, re-entrantly*, which constructs another `Scheduler` (`:156`) and recurses into `edge()` (`:160-164`), creating a **nested isolate while the parent isolate is entered**. Isolate is `!Send` (only `IsolateHandle` is `Send + Sync`, `rusty_v8-0.32.1/src/isolate.rs:775-776`); the code never needs to move it. The `Scheduler` struct holds no V8 state (`src/types.rs:147-152`), so it is `Clone` and shareable. No `thread_local!`, no `unsafe` (grep of `src/` for `unsafe`: none). `libc` is declared (`Cargo.toml:18`) but **unused** in `src/` (grep: no match) — it is only a transitive need.
- **EventEmitter** (`src/event_emitter.rs`): `emit` locks `subscribers` (`:64`), spawns one `std::thread` **per subscriber** (`:72-75`) and `join`s them all before returning (`:79-81`, `expect("Thread panicked")`). So `emit` is synchronous from the scheduler's point of view but every callback runs on a fresh OS thread; the `subscribers` mutex is held for the whole duration, so (by inspection, not tested) a callback that calls `subscribe`/`emit` on the same emitter deadlocks. Emitters live in a process-global `lazy_static! EVENT_EMITTERS: Arc<Mutex<HashMap<String /*scheduler id*/, Arc<EventEmitter>>>>` (`:7-11`), inserted by `Scheduler::new` (`src/scheduler.rs:15-18`) and never removed (the comment at `:149-153` acknowledges "some memory impact").

### E.2 Building the JS environment (`Scheduler::edge`, `src/scheduler.rs:49-316`)

Per node execution:
1. `increment_sequence_counter()` (`:56`, global `Mutex<u32>` in `src/utils.rs:7,30-33`).
2. New isolate/context (`:59-63`); `object_template = v8::ObjectTemplate::new` (`:65`).
3. For each output `edge` (`:68`): emit `BeginEdge` (`:69-78`); for each `connector` (`:79`): emit `BeginConnector` (`:81-95`); register **one accessor per connector** on the *same template key* `edge.field` via `object_template.set_accessor_with_setter(key, getter, setter)` (`:173-174`); instantiate `edges_object = object_template.new_instance` (`:176`); write the *string* properties `schedulerId, nodeId, graphId, field, connectorId, connectorField, connectorGraphId, connectorNodeId, edgeField` onto **both** `edges_object` and the context `global` (`:179-196`, `set_key_value` at `:36-48`); `global.edges = edges_object` (`:198`); emit `EndConnector` (`:200-214`). After the connector loop emit `EndEdge` (`:216-225`).
   - So `BeginEdge/BeginConnector/EndConnector/EndEdge` are emitted **during setup, before the script runs**, once per output edge/connector — not around actual traversal. They describe the node's *outputs*, whereas the TS events describe the *input* edge being executed.
   - Because the last iteration's `edges_object` wins (`:198` runs each iteration) and the setter ignores the property name it was invoked for (`_: v8::Local<Name>` at `:98`) and instead reads `connectorNodeId`/`connectorField` from `this` (`:127-148`), **any assignment to any `edges.<field>` dispatches to the last connector of the last edge**. Verified with the release CLI: graph `a --out→[b, c]` with `edges.out = value + '-from-a'` prints `"C_GOT:in:foo-from-a ""A_RET "` — `b` never runs; graph `a --left→b, --right→c` with `edges.left = 'L'` prints `"C_GOT:in:L ""A_RET "` — the value assigned to `left` is delivered to `right`'s target. There is no fan-out and no per-field routing.
4. Globals `schedulerId, nodeId, graphId (node.graph_id), field` as strings (`:228-233`); if `connector_count == 0` an empty `edges` object (`:236-239`); `value` converted by `serde_json_to_v8` (`:241-248`, `src/utils.rs:40-74`). Verified global surface: `Object.keys(globalThis)` = `schedulerId,nodeId,graphId,field,edges,value`; `this===globalThis` is `true`; `typeof fetch/require/scheduler/state/data/node` are all `undefined`; `typeof setTimeout/queueMicrotask` are `undefined`; `typeof console` is `object` (V8's built-in console — `console.log('CONSOLE_OUT')` printed nothing because no console delegate is installed; grep of `src/` for `console`: none); `typeof Promise` is `function`.
5. Emit `Set` `{graphId, nodeId, field, value}` (`:250-258`).
6. Compile and run under a `TryCatch` (`:260`): `v8::Script::compile(try_catch, code, None)` (`:265`) — a **classic script**, not a function body and not a module — so top-level `return` and top-level `await` are **SyntaxErrors** (verified: both `return 1;` and `const x = await Promise.resolve(1); x` produce a `Compile error` log line and an `Error` event; the CLI prints nothing and exits 0). The script's completion value is the result: `compiled_script.run` (`:283`) → `AfterSet` `{graphId, nodeId, field, value, "return": result.to_rust_string_lossy()}` (`:288-297`) — the return is **always a string** (V8 `ToString`; an object becomes `"[object Object]"`, `undefined` becomes `"undefined"`). Compile failure → `Error` `{graphId, nodeId, field, value, error: exceptionString}` (`:267-280`); runtime throw → `Error` with the same shape (`:299-313`). Microtasks: default V8 policy runs the microtask queue when `run()` unwinds — verified that `Promise.resolve().then(() => { edges.out = 'FROM_MICROTASK'; })` does deliver (`"B_GOT:FROM_MICROTASK ""A_RET "`), but there are no timers, so nothing can run after `run()` returns.

### E.3 The setter (`src/scheduler.rs:96-165`) — how values get back into Rust

Inside the V8 property callback: `v8_value_to_serde_json(value, scope)` (`:115`, `src/utils.rs:76-112`) — handles string, number (integral → i64, else f64), boolean, null, undefined→null; **arrays and objects become `Null`** (`src/utils.rs:108-111`, "Placeholder for simplicity"; verified: `edges.out = {a:1,b:[1,2]}` delivers `"B_GOT:object:null "`; `42.5` and `true` round-trip). It then reads the nine string properties from `this` (`:127-148`) into a `BusMessage` (`src/types.rs:33-45`), looks the graph up **by the scheduler's graph id** from the global store (`:154-155`, `expect(...)` panics if missing), constructs a new `Scheduler` sharing the same emitter id (`:156`), and **synchronously recurses** `execute_node_by_id(connector_node_id, value, connector_field)` (`:160-164`). No channels, no `Arc<Mutex>` hand-off of results — the "bus" is a struct populated from JS globals. The getter always returns `42` (`:166-172`; verified: `'edges.out reads as ' + edges.out` → `"edges.out reads as 42 "`).

Consequences: dispatch is synchronous, depth-first and re-entrant across nested isolates; downstream `AfterSet` events are emitted **before** the upstream node's own `AfterSet` (visible in every CLI output above: `"C_GOT…" "A_RET "`). Values crossing an edge are copied through JSON (no reference sharing, unlike TS). Node lookup for the target is by `id` in the flattened `self.graph.nodes` (`:354`), first match; `connector.graph_id` and `connector.version` are carried in events but **not** used for resolution.

### E.4 Entry, errors, exits

- `Scheduler::url(url: String, value: Value, field: String)` (`:317-350`): exact string match `node.url == url`, first in `graph.nodes` order (`:318`); emit `Begin` `{field, value, url, nodeId, graphId}` (`:322-331`); `execute_node_by_id` (`:333`); emit `End` `{url, nodeId, graphId}` (`:335-342`). **No node → `eprintln!` + `std::process::exit(1)`** (`:344-348`); same in `execute_node_by_id` (`:359-363`) — the library kills the host process on a bad url/id. Verified: `--url nope` → `Cannot find node URL nope`, exit 1.
- Returns `()`; the only result channel is the emitter. `main.rs:49-56` subscribes to `AfterSet` and `print!`s `data["return"]` (so the CLI concatenates every node's stringified completion value, innermost first, with no newline).
- Errors in a node: caught by `TryCatch`, emitted as `Error`, and **the recursion continues/unwinds normally** — a throwing downstream node does not affect its upstream (test `async_graph_with_two_edges_then_error`, `:439-464`, expects `"TypeError: Cannot read properties of undefined (reading 'cause')"` from `this.should.cause.an.error`, `tests/fixtures/graphs/graph_with_two_edges_then_error.json:64`).
- Every `expect(...)` in `src/scheduler.rs`/`src/loader.rs`/`src/event_emitter.rs`/`src/utils.rs` is a panic path (graph store misses `:155`, V8 string creation `:42-44,66,173,262`, mutex poisoning, file/JSON parse `src/loader.rs:83,92-95`, thread panic in a subscriber `src/event_emitter.rs:80`). There is no `catch_unwind`; a panic in the CLI aborts the process; in the test harness it fails the test.
- CLI (`src/main.rs:11-32`, clap derive): `-v/--verbosity <u32>` (default 0), `-p/--path`, `-g/--graph` (inline JSON), `-u/--url` (default `"index"`), `-v/--value` (default `""`, always passed as a JSON **string**, `:57`), `-f/--field` (default `"main"`). `verbosity` and `value` both declare short flag `-v` (`:15,:27`): a **debug build panics at startup** — `clap_builder-4.5.1/src/builder/debug_asserts.rs:112:17: Command plastic-io: Short option names must be unique for each argument, but '-v' is in use by both 'verbosity' and 'value'` (verified with `target/debug/plastic-io --help`); the release build skips the assert and `--help` lists both `-v` entries. All CLI experiments in this record therefore used `target/release/plastic-io` with long flags only. Verbose logging (`src/utils.rs:11-17`) prints the message with commas replaced by newlines.

### E.5 Cancellation, limits, teardown — all absent

| Capability | Status | Checked |
|---|---|---|
| `isolate.terminate_execution()` | **absent** — exists in the crate (`rusty_v8-0.32.1/src/isolate.rs:328,797`) but never called | grep `terminate` in `src/`: none |
| Heap limits (`CreateParams::heap_limits`, crate `isolate_create_params.rs:153`) | **absent** — `CreateParams::default()` at `src/scheduler.rs:59` | grep `heap_limits`: none |
| `add_near_heap_limit_callback` / `set_oom_error_handler` (crate `isolate.rs:589,611`) | **absent** | grep: none |
| Wall-clock timeout | **absent** (only the 5 s `tokio::time::timeout` in tests, `:395` etc., which fails the test but does not stop V8) | grep `timeout` in non-test code: none |
| Recursion / hop limit | **absent**. An unbounded self-loop (`edges.out = Number(value) + 1` with a connector to itself) crashes the process after ~20 s with `<--- Last few GCs ---> … # Fatal javascript OOM in GC during deserialization #`, **exit 133 (SIGTRAP)** — each hop allocates a fresh isolate (verified, `scratchpad/rust-experiments/infloop.json`). A bounded loop works (`"hop3 ""hop2 ""hop1 ""hop0 "`). | experiment |
| Metrics | only the global `SEQUENCE_COUNTER` (`src/utils.rs:7,30-38`), printed in verbose logs | — |
| `V8::dispose` / `dispose_platform` | **absent** | grep: none |
| Panic handling | none (`expect` everywhere) | — |
| Bundled V8 | `rusty_v8 0.32.1` (`Cargo.lock`), prebuilt static lib downloaded from `https://github.com/denoland/rusty_v8/releases/download` by its `build.rs:236`; headers declare `V8_MAJOR_VERSION 9`, `V8_MINOR_VERSION 6` (`rusty_v8-0.32.1/v8/include/v8-version.h`) — a late-2021 V8; patch status not assessed here | — |

### E.6 Hyperedge / fan-out, linked graphs, cycles vs TS

- Fan-out: **broken** (E.2 item 3) — effectively one connector per node, the last one declared, regardless of field.
- Linked graphs: resolved at load time by file path and flattened (D.2); input mapping dead, output mapping copies connectors; cycles across linked graphs in the fixtures are really straight chains entered from the innermost graph. Runtime cross-graph loading (TS `connector.graphId !== graph.id` path) has no equivalent.
- Cycles within a graph: allowed, synchronous recursion with a new isolate per hop, no guard, fatal OOM on unbounded recursion (E.5).

---

## F. Rust runtime: build and tests

Toolchain: `cargo 1.98.0 (797e8a9bc 2026-08-05)`, `rustc 1.98.0 (88d9e12ae 2026-08-18)`, host `arm64` (macOS, `uname -m`). Note: macOS has no `timeout(1)`; the first attempt logged `(eval):1: command not found: timeout` and did nothing. Re-run with `perl -e 'alarm 600; exec @ARGV' cargo …`.

`cargo build` (debug): succeeded in **13.44 s** — `Downloaded rusty_v8 v0.32.1` (19.7 MB crate) … `Compiling rusty_v8 v0.32.1` … `Finished \`dev\` profile [unoptimized + debuginfo] target(s) in 13.44s`. The prebuilt `librusty_v8.a` for `aarch64-apple-darwin` was fetched by rusty_v8's `build.rs` (`download_static_lib_binaries`, `build.rs:79`) — no V8-from-source build was needed. The build-script `output` records `cargo:rerun-if-env-changed=RUSTY_V8_ARCHIVE` / `RUSTY_V8_MIRROR` (offline builds would need one of these).

`cargo build --release`: `Finished \`release\` profile [optimized] target(s) in 10.59s`.

`cargo test -- --test-threads=1`:
```
running 8 tests   (unittests src/lib.rs)
test scheduler::tests::async_graph_with_two_edges_then_error ... ok
test scheduler::tests::async_linked_cycle_graph ... ok
test scheduler::tests::async_linked_graph ... ok
test scheduler::tests::async_linked_three_cycle_graph ... ok
test scheduler::tests::graph_with_edge ... ok
test scheduler::tests::graph_with_two_edges ... ok
test scheduler::tests::minimal_viable_graph ... ok
test scheduler::tests::single_node_js_invoke ... ok
test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s
running 8 tests   (unittests src/main.rs) — same 8, ok. 8 passed
Doc-tests plastic_io: running 2 tests (src/event_emitter.rs lines 25, 35) — ok. 2 passed
```
The tests are compiled twice because `src/main.rs:1-5` re-declares the modules instead of using the library crate (`src/lib.rs:1-5`). All test code is the `#[cfg(test)] mod tests` at `src/scheduler.rs:368-547`; each test subscribes to one event type, calls `url`, and awaits the first event with a 5 s timeout — none asserts event counts, order, or the absence of errors, which is why the fan-out and input-mapping defects (D.2, E.2) are invisible to the suite.

CI (`.github/workflows/rust.yml`): on push/PR to `main`, `ubuntu-latest`, `actions/checkout@v3`, `cargo build --verbose`, `cargo test --verbose`. No caching, no clippy, no fmt, no release artefacts.

---

## G. Semantic comparison TS vs Rust

| Semantic | TypeScript (`plastic-io` 2.0.3) | Rust (`plastic-io-rust` 0.1.0) | Verdict |
|---|---|---|---|
| Entry API | `new Scheduler(graph, context, state, logger)`; `await scheduler.url(url, value, field, currentNode)` → `{nodes: []}` (`src/Scheduler.ts:181,282,327`) | `Scheduler::new(graph, Option<id>)`; `scheduler.url(url, Value, field)` → `()` (`src/scheduler.rs:12,317`) | differs: Rust has no context/state/logger, no `currentNode`, no promise |
| Entry node match | regex `new RegExp(url).test(node.url)`, first match (`src/Scheduler.ts:296-299`) | exact `node.url == url`, first match in *flattened* list (`src/scheduler.rs:318`) | differs: `"index"` matches `"index2"` in TS only; in Rust the first match may be an inner-graph node (D.2) |
| Missing entry node | `warning` event, `end` still fires (`src/Scheduler.ts:300-308`) | `process::exit(1)` (`src/scheduler.rs:344-348`) | differs: Rust kills the process |
| Document schema | lenient (`any` data/properties, optional fields) | strict serde structs; requires `Edge.external`, `LinkedGraph.url`, `icon`, RFC-3339 dates, string `data` (`src/types.rs`) | differs: no TS test stub parses in Rust (D.1) |
| Compile | `AsyncFunction` body after meriyah `parseScript` (`src/Node.ts:66-76`); top-level `return` ok, top-level `await` **not** (meriyah 1.9.15) | `v8::Script::compile` classic script (`src/scheduler.rs:265`); top-level `return` and `await` are SyntaxErrors; completion value is the result | differs: `return x` breaks in Rust; expression-statement results only work in Rust |
| Bindings | `this, scheduler, graph, cache, node, field, state, value, edges, data, properties, require` + all host globals (`src/Node.ts:90-105`) | globals `schedulerId, nodeId, graphId, field, edges, value` (strings + converted value) + V8 builtins (`src/scheduler.rs:186-198,228-243`) | differs: no `scheduler/state/cache/data/properties/require/console output/fetch` in Rust |
| Isolation | none; host realm (`new AsyncFunction`) | fresh isolate + context per node execution (`src/scheduler.rs:59-63`) | differs: Rust isolates node code from the host and from other nodes (no shared `state`) |
| `edges.<field> = v` | setter per edge, iterates `connectors[]` in order, dispatches to each (`src/Node.ts:241-298`) | accessor per connector on one key; last connector wins; field name ignored (`src/scheduler.rs:96-198`) | differs: **fan-out and multi-edge routing broken in Rust** |
| Reading `edges.x` | `undefined` (setter-only) | `42` (`src/scheduler.rs:166-172`) | differs (cosmetic) |
| Value transport | by reference (experiment F) | JSON copy; objects/arrays → `null` (`src/utils.rs:108-111`) | differs: structured values do not cross edges in Rust |
| Dispatch order / model | synchronous depth-first prefix, then promise-driven; fire-and-forget connectors (`src/Node.ts:262`) | fully synchronous depth-first recursion inside V8 property callbacks (`src/scheduler.rs:160-164`) | same for sync code; Rust has no async continuation (no timers, no event loop) |
| Async in node code | promises/timers/`fetch` work (host loop); `url()` resolves before they finish (B.5) | microtasks run at script end; no timers; `url()` returns after everything | differs |
| Fan-in / join | absent, independent invocations | absent | same |
| Cycles | allowed, no guard; stack overflow → one `error` event, process survives | allowed, no guard; new isolate per hop → fatal V8 OOM, exit 133 | differs in failure mode |
| Linked graphs | JIT-loaded via `Loader` (`fetch` or `load` event), input+output mapping at runtime (`src/Node.ts:121-185,191-237`) | flattened at load time from **file paths**; input mapping dead (`src/loader.rs:35-78`) | differs |
| Linked nodes | supported (`src/Node.ts:191-212`) | parsed, ignored | differs |
| Errors | per-site `error` events, sibling isolation, duplicates for load failures | `Error` event `{graphId,nodeId,field,value,error}`; sibling isolation; panics/`exit` for infrastructure errors | partly same (isolation), differs in surface |
| Events | 11 names, listeners sync on caller thread, throw propagates (`src/Scheduler.ts:231-238`) | 11 `EventType`s (`src/types.rs:12-25`; `Load`/`Warning` never emitted — grep), each callback on its own OS thread, joined (`src/event_emitter.rs:63-83`); `Begin/EndEdge`, `Begin/EndConnector` emitted at setup not traversal (E.2) | differs: names align, timing/semantics do not |
| `state` / shared | `scheduler.state` shared object, `cache` per node id (B.8) | absent | differs |
| Cancellation | absent | absent (`terminate_execution` unused) | same (both absent) |
| Timeouts / limits | absent | absent (default `CreateParams`, no heap/OOM hooks) | same (both absent) |
| Completion signal | `end` after entry's sync prefix; nothing for async tails | `End` after full synchronous traversal (`src/scheduler.rs:335-342`) | differs |
| Teardown | GC | isolates dropped per node; platform never disposed | differs |

What breaks when moving a component between runtimes: any TS node that uses `return …` (SyntaxError in Rust), `await` inside an async IIFE plus timers (never fires in Rust), `state`/`cache`/`data`/`properties`/`scheduler`/`this`/`require`/`fetch`/`console` (undefined or silent in Rust), sends objects/arrays over edges (arrive as `null`), or relies on more than one connector or more than one output edge (mis-routed). Any Rust-oriented node written as an expression statement (`'a' + value`) runs in TS but its completion value is not returned (`afterSet.return` is `undefined` unless the code says `return`), and TS additionally rejects top-level `await`. Documents authored for one runtime do not parse in the other (D.1).

---

## H. Integration status

Rust runtime references in the consumers: **none**. `grep -rniE 'rust|plastic-io-rust|cargo|\.wasm|rusty_v8'` over `/Users/tonygermaneri/gh/graph-server/src`, `graph-server/package.json`, `graph-server/serverless.yml`, and over `/Users/tonygermaneri/gh/graph-editor/packages` (and `--include` ts/js/vue/json/md across the editor, excluding `node_modules`) returned no matches.

graph-server (pins `"@plastic-io/plastic-io": "2.0.1"`, `graph-server/package.json:34`):
- `graph-server/src/graphService.ts:8` `import Scheduler, {Node, Graph} from "@plastic-io/plastic-io";`
- `graph-server/src/graphService.ts:406` `const scheduler = new Scheduler(graph, {openai, event, context, callback: cb}, workerObjProxy, logger);` — `state` is a deep proxy that forwards mutations as `state-update` messages (`:379-388`); `logger.error` resolves the Lambda response (`:287-302`).
- `graph-server/src/graphService.ts:408-446` `scheduler.addEventListener("set", e => e.setContext({openai, event, context, callback: cb, AWS, console: {...}}))` — this is how nodes get `this` (B.4); `:447-451` forwards `this.graphEvents` to `this.send(eventName)`.
- `graph-server/src/graphService.ts:475` `scheduler.url(nodeUrl, value, field, null).then(postGraph).catch(graphCatch);` — the response resolves on `url()` settling, i.e. (on 2.0.1) after the entry node's set function completes (C.3 #2).
- `graph-server/src/graphExecutionService.ts:1` imports `Scheduler` but never instantiates it (grep: single match).

graph-editor (pins `"@plastic-io/plastic-io": "2.0.3"`, `graph-editor/package.json:33`):
- `graph-editor/packages/Orchestrator/schedulerWorker.ts:1` `import Scheduler from "@plastic-io/plastic-io";` — runs in a Web Worker (`main.ts:14` `import SchedulerWorker from "./schedulerWorker?worker"`, `:477`).
- `schedulerWorker.ts:49` `scheduler = new Scheduler(e.graph, e, workerObjProxy, logger);` with a no-op logger (`:30-36`); `:50` `addEventListener("load", loader)` where `loader` answers every load with `scheduler.graph` itself (`:13-15`) because the main thread pre-flattens linked graphs before `init` (`main.ts:396` `loadAndIntegrateLinkedGraphsWithFields`, called at `:597` and `:682`); `:51-58` forwards `beginconnector, endconnector, set, afterSet, error, warning, begin, end` to the main thread via `postMessage`.
- `schedulerWorker.ts:82-84` generic RPC: `scheduler[e.data.method].apply(scheduler, e.data.args)`; the main thread exposes `this.scheduler.instance = { url: sendMessage('url') }` (`main.ts:665-667`, `sendMessage` at `:584-591`), and nodes are invoked from the UI with `this.scheduler.instance.url(this.node.url, val, output.name, this.hostNode)` (`graph-editor/packages/Node/Node.vue:269`, `:288`; `NodeComponent.vue:31,60`).
- "Stop": `schedulerWorker.ts:61-68` `panic()` registers a `beginedge` listener that throws `Error('PANIC!')` — relying on `dispatchEvent` propagating listener exceptions (B.6); on graph change the worker panics then re-inits (`:76-81`). This is the only cancellation mechanism in the system and it only interrupts the next edge traversal.

---

## I. Evidence ledger

| ID | Claim | Repo | path:lines | Symbol | How verified |
|---|---|---|---|---|---|
| RT-01 | Graph/Node/Edge/Connector model as quoted | plastic-io | `src/Shared.ts:214-220,33-44`; `src/Node.ts:30-61`; `src/Edge.ts:6-11` | `Graph`, `Connector`, `Node`, `Edge` | read |
| RT-02 | Entry node resolved by regex, first match | plastic-io | `src/Scheduler.ts:296-299` | `Scheduler.url` | read |
| RT-03 | Node code compiled with `AsyncFunction` after meriyah parse; 11 positional bindings + `this` | plastic-io | `src/Node.ts:66-76,90-105` | `parseAndRun` | read; experiment C |
| RT-04 | Constructor `context` never reaches node `this`; only `set`-event `setContext` does | plastic-io | `src/Scheduler.ts:127,201`; `src/Node.ts:84-87,91` | `Scheduler.context`, `setContext` | read; experiment C (`this.ctxTag=undefined`) |
| RT-05 | Top-level `await` fails to parse (meriyah 1.9.15) | plastic-io | `src/Node.ts:66-71`; `package.json:44-46` | `parseScript` options | node one-liner: `[1:5]: 'Await' may not be used as an identifier` |
| RT-06 | `edges` is setter-only; assignment iterates connectors in order; `edgeExecute` not awaited | plastic-io | `src/Node.ts:241-243,246,262` | `execute` setter | read; experiment A |
| RT-07 | Synchronous depth-first prefix; `url()` resolves before entry's async work in 2.0.3 | plastic-io | `src/Node.ts:335`; `src/Edge.ts:45`; `src/Scheduler.ts:312` | `execute`, `Edge.execute`, `url` | experiments A, B2, B3 on HEAD dist |
| RT-08 | Fan-in absent; cycles unguarded; sync self-loop → `RangeError` after ~153 hops | plastic-io | `src/Node.ts:238-317` | `execute` | experiments D, E |
| RT-09 | Complete event list and payloads | plastic-io | see B.6 table | `dispatchEvent` call sites | read; grep `dispatchEvent(` |
| RT-10 | Listeners run synchronously, exceptions propagate | plastic-io | `src/Scheduler.ts:231-238` | `dispatchEvent` | read; editor `panic()` relies on it |
| RT-11 | Loader uses global `fetch`, `load` event pre-empts, cache by path, throws if no fetch | plastic-io | `src/Loader.ts:23-58` | `Loader.load` | read; spec `:152-163,288-302` |
| RT-12 | Linked graph load mutates cached inner graph; duplicate `error` events on load failure | plastic-io | `src/Node.ts:145-185,216-217`; `src/Edge.ts:47-60`; `src/Scheduler.ts:313-319` | `linkInnerNodeEdges` | read; experiment (2 error events) |
| RT-13 | `graph` parameter reassigned by cross-graph connector load | plastic-io | `src/Node.ts:247-249` | `execute` setter | read (untested by suite) |
| RT-14 | Cancellation / timeouts / limits absent | plastic-io | whole `src/` | — | grep `abort|cancel|stop|terminate|setTimeout`: none |
| RT-15 | Ambient authority: `fetch`, `process`, `require` reachable | plastic-io | `src/Node.ts:74-76,102-104` | `AsyncFunction`, `require` shim | experiment C |
| RT-16 | `npm ci`/`build`/`test`: 27/27 pass, coverage 96.6 % lines | plastic-io | `tests/unit/Scheduler.spec.js` | — | ran (C.1) |
| RT-17 | 2.0.1 = commit `08c7b6a`; server dist byte-identical to its rebuild | plastic-io | `package.json` history; worktree build | — | `git log -p -- package.json`; `diff -r` (C.2) |
| RT-18 | 2.0.3 = HEAD; editor dist byte-identical to HEAD build | plastic-io | `dist/` | — | `diff -r` (C.2) |
| RT-19 | 2.0.1→2.0.3 semantic differences (#1–#7) | plastic-io | `git diff 08c7b6a HEAD -- src` (C.3) | `Edge.execute`, `parseAndRun`, `execute`, `url` | read diff; experiments A/B2/G on both dists |
| RT-20 | `afterSet` no longer fires on error / never carries `err` in 2.0.3 | plastic-io | `src/Node.ts:335-354` vs server `dist/Node.js:331-365` | `execute` | read; experiment A/G both dists |
| RT-21 | Rust structs and serde attributes; required fields that TS lacks | plastic-io-rust | `src/types.rs:47-145` | `Graph`…`LinkedGraphFields` | read; TS stub → `missing field external` panic |
| RT-22 | Loader reads linked graphs from file paths and flattens; input mapping dead (shadowing + empty `global_nodes`) | plastic-io-rust | `src/loader.rs:35-78` (esp. `:44-56,:77`) | `load_and_integrate_linked_graphs_with_fields` | read; trace shows outer node never runs |
| RT-23 | Cycle tests pass via duplicate `url:"index"` nodes; entry is the innermost node | plastic-io-rust | `src/scheduler.rs:318`; fixtures `graph_cycle_inner.json:32`, `graph_cycle_outer.json:17` | `Scheduler::url` | verbose trace; fixture url listing |
| RT-24 | V8 platform init once, 8 threads, never disposed | plastic-io-rust | `src/scheduler.rs:9,27-34` | `initialize_v8`, `V8_INIT` | read; grep `dispose`: none |
| RT-25 | New isolate + context per node execution, default `CreateParams` | plastic-io-rust | `src/scheduler.rs:59-63` | `Scheduler::edge` | read |
| RT-26 | Accessor per connector on one key; last connector wins; field ignored | plastic-io-rust | `src/scheduler.rs:96-100,173-176,198` | setter closure, `set_accessor_with_setter` | read; CLI experiments `fanout.json`, `twoedges.json` |
| RT-27 | JS global surface = `schedulerId,nodeId,graphId,field,edges,value`; no console output; no timers | plastic-io-rust | `src/scheduler.rs:186-198,228-243` | `set_key_value` | CLI experiments `console.json`, `timers.json` |
| RT-28 | Classic `Script::compile`; `return`/top-level `await` are compile errors → `Error` event | plastic-io-rust | `src/scheduler.rs:265-280` | `Script::compile` | CLI `return.json`, `await.json` with `--verbosity 1` |
| RT-29 | Objects/arrays crossing an edge become `null`; return is always a string | plastic-io-rust | `src/utils.rs:108-111`; `src/scheduler.rs:295` | `v8_value_to_serde_json`, `to_rust_string_lossy` | CLI `objvalue.json` |
| RT-30 | Setter recurses synchronously by constructing a new `Scheduler` and calling `execute_node_by_id` | plastic-io-rust | `src/scheduler.rs:154-164` | setter closure | read; output ordering (downstream `AfterSet` first) |
| RT-31 | Events: one OS thread per subscriber, joined; lock held during emit; `Load`/`Warning` never emitted | plastic-io-rust | `src/event_emitter.rs:63-83`; `src/types.rs:12-25` | `EventEmitter::emit` | read; grep `EventType::Load` / `Warning`: only in enum |
| RT-32 | `Begin/EndEdge`, `Begin/EndConnector` emitted during setup, per output | plastic-io-rust | `src/scheduler.rs:69-78,81-95,200-214,216-225` | `Scheduler::edge` | read |
| RT-33 | Unknown url/id → `process::exit(1)` | plastic-io-rust | `src/scheduler.rs:344-348,359-363` | `url`, `execute_node_by_id` | CLI `--url nope` → exit 1 |
| RT-34 | `terminate_execution`, heap limits, OOM hooks, timeouts, `unsafe`, `libc` use: all absent | plastic-io-rust | `src/*.rs`; crate `isolate.rs:328,589,611` | — | grep (E.5) |
| RT-35 | Unbounded self-loop → V8 fatal OOM, exit 133 | plastic-io-rust | `src/scheduler.rs:59` (isolate per hop) | `Scheduler::edge` | CLI `infloop.json` under 20 s alarm |
| RT-36 | Tokio: `rt`+`macros`+`sync`+`time` only, used only in tests; `main` is sync | plastic-io-rust | `Cargo.toml:17`; `src/main.rs:34`; `src/scheduler.rs:382-545` | `#[tokio::test]` | read; grep `tokio::` |
| RT-37 | Debug CLI panics on clap `-v` collision; release works | plastic-io-rust | `src/main.rs:14-16,26-28` | `Args` | ran debug and release binaries |
| RT-38 | `cargo build` 13.4 s (prebuilt V8 9.6 static lib), `cargo test` 8+8+2 pass | plastic-io-rust | — | — | ran (F) |
| RT-39 | CI = `cargo build --verbose` + `cargo test --verbose` on ubuntu-latest | plastic-io-rust | `.github/workflows/rust.yml` | — | read |
| RT-40 | No consumer references the Rust runtime | graph-server, graph-editor | `graph-server/src`, `graph-editor/packages` | — | grep (H) |
| RT-41 | graph-server call sites | graph-server | `src/graphService.ts:8,406,408-446,475`; `src/graphExecutionService.ts:1` | `new Scheduler`, `scheduler.url` | grep + read of `:280-480` |
| RT-42 | graph-editor call sites and worker RPC; `panic()` stop | graph-editor | `packages/Orchestrator/schedulerWorker.ts:1,13-15,49-58,61-68,82-84`; `packages/Orchestrator/main.ts:396,584-591,597,665-667,682`; `packages/Node/Node.vue:269,288` | `rpc.init`, `panic`, `sendMessage('url')` | grep + read |
| RT-43 | Editor's scheduler resolves nested meriyah 1.9.15 (root has 4.3.3); server resolves 1.9.15 | graph-editor, graph-server | `graph-editor/node_modules/@plastic-io/plastic-io/node_modules/meriyah`; `graph-editor/package.json:44` | — | `require.resolve`, package.json versions |

---

## Appendix 1. Experiment transcripts (verbatim, trimmed only of stack frames)

All scripts and fixtures are under `/private/tmp/claude-502/-Users-tonygermaneri-gh-graph-editor/f9d7c081-f2b8-4e70-9cb2-bf64f7c62f4c/scratchpad/`:
- `ts-experiments/exp.js` (A–F), `ts-experiments/exp2.js` (B2, B3, G) — run as `node exp.js <distDir>`; `<distDir>` = `repos/plastic-io/dist` (HEAD == 2.0.3) or `repos/plastic-io-v201/dist` (git worktree at `08c7b6a` == 2.0.1). Each script builds graphs inline, registers listeners for every event, records `<url() returned synchronously here>` right after the call and `<url() promise resolved here>` after `await`, then waits 50–200 ms for stragglers.
- `rust-experiments/*.json` — run as `repos/plastic-io-rust/target/release/plastic-io --path <file> --url index --value foo` (long flags only; see E.4). The CLI prints each node's `AfterSet.return` via `print!` with no separator.
- `distdiff/{s,e,h,g201}` — sourcemap-stripped copies of server 2.0.1, editor 2.0.3, HEAD build, and the `08c7b6a` worktree build used for the `diff -r` results in C.2.

### A1.1 TS experiment A — fan-out order and sibling isolation

Graph: `a(index) --out→ [c1→b.in, c2→c.in]`; `a`: `__log('a:set'); edges.out = value; __log('a:after-assign');`; `b`: `__log('b:set'); throw new Error('b boom');`; `c`: `__log('c:set'); return 'c-done';`.

2.0.3:
```
begin, beginedge(a), set, a:set, beginconnector(c1), beginedge(b), set, b:set,
beginconnector(c2), beginedge(c), set, c:set, a:after-assign,
<url() returned synchronously here>,
endedge(b), endedge(c), endedge(a), error(b):Error: b boom, endconnector(c1),
afterSet(c)="c-done", endconnector(c2), afterSet(a)=undefined, end,
<url() promise resolved here>
```
2.0.1:
```
begin, beginedge(a), set, a:set, beginconnector(c1), beginedge(b), set, b:set, a:after-assign,
<url() returned synchronously here>,
error(b):Error: b boom, afterSet(b)=undefined err=Error: b boom, endedge(b), afterSet(a)=undefined,
endedge(a), endconnector(c1), beginconnector(c2), beginedge(c), set, c:set, end, afterSet(c)="c-done",
<url() promise resolved here>, endedge(c), endconnector(c2)
```
Reading: in 2.0.3 both targets' synchronous prefixes run before control returns to `a`; in 2.0.1 `c` does not start until `b`'s chain (including its microtask continuations) has finished, because `edgeExecute` was awaited (C.3 #3). In 2.0.1 `afterSet(b)` carries `err`; in 2.0.3 there is no `afterSet(b)` at all (C.3 #2b).

### A1.2 TS experiment B2 — promise-returning entry node

Graph: `a(index) --out→ b`; `a`: `__log('a:sync-part'); return new Promise(r => setTimeout(() => { __log('a:timer-fired'); edges.out = value; r('a-done'); }, 20));`; `b`: `__log('b:set'); return 'b-done';`.

2.0.3:
```
begin, beginedge(a), a:sync-part, <url() returned synchronously here>, endedge(a), end,
<url() promise resolved here>,
a:timer-fired, beginconnector(c1), beginedge(b), b:set, endedge(b), afterSet(b)="b-done",
endconnector(c1), afterSet(a)="a-done"
```
2.0.1:
```
begin, beginedge(a), a:sync-part, <url() returned synchronously here>,
a:timer-fired, beginconnector(c1), beginedge(b), b:set, afterSet(b)="b-done", afterSet(a)="a-done",
endedge(b), endedge(a), endconnector(c1), end,
<url() promise resolved here>
```
Reading: on 2.0.1 `url()` (and therefore graph-server's `postGraph`, H) waits for the entry node's promise; on 2.0.3 it does not.

### A1.3 TS experiment B3 — nested async IIFE (the only way to `await` under meriyah 1.9.15)

`a`: `__log('a:sync'); (async () => { await new Promise(r => setTimeout(r, 20)); __log('a:after-inner-await'); edges.out = 1; })(); return 'a-sync-ret';`

2.0.3: `begin, beginedge(a), a:sync, <url() returned>, endedge(a), afterSet(a)="a-sync-ret", end, <url() resolved>, a:after-inner-await, beginconnector(c1), beginedge(b), b:set, endedge(b), afterSet(b)="b-done", endconnector(c1)`.
2.0.1: `begin, beginedge(a), a:sync, <url() returned>, afterSet(a)="a-sync-ret", endedge(a), end, <url() resolved>, a:after-inner-await, beginconnector(c1), beginedge(b), b:set, afterSet(b)="b-done", endedge(b), endconnector(c1)`.
Reading: identical completion semantics in both versions — neither can see work started by a detached async function; only the returned promise matters (A1.2).

### A1.4 TS experiment G — downstream error after `url()` resolved

`a`: `edges.out = value;`; `b`: `return new Promise((_, rej) => setTimeout(() => rej(new Error('late boom')), 20));`

2.0.3: `… end, <url() promise resolved here>, error(b):Error: late boom` — nothing else follows; `endconnector(c1)` and `endedge(b)` had already fired before the error.
2.0.1: `… end, <url() promise resolved here>, error(b):Error: late boom, afterSet(b)=undefined err=Error: late boom, endedge(b), endconnector(c1)`.
Reading: in both versions a host that resolved on `url()` has already answered before a downstream async failure is known.

### A1.5 TS experiment C — bindings / ambient authority (identical on both dists)

`this.ctxTag=undefined state.shared=S typeof fetch=function typeof process=object typeof require=function typeof scheduler.url=function cache={} graph.id=g node.id=a field=in data="" props={} edgesKeys=` and `afterSet(a)="string"` (from `return typeof require('os').platform()`). Scheduler constructed as `new Scheduler(graph, {ctxTag:"CTX"}, {shared:"S"})`.

### A1.6 TS experiments D/E — self-loops

D (`if (value < 3) edges.out = value + 1; return value;`, connector to itself): `a:v=0 … a:v=3` all before `<url() returned>`; then four `afterSet(a)` (3,2,1,0) and `end`. E (`__hop(); edges.out = value + 1;`): 2.0.3 → `E hops before unwinding: 153 (error events: 1)`, the single error is `error(a):RangeError: Maximum call stack size exceeded`; 2.0.1 → `170` hops, 1 error event, plus Node's stderr `Exception in PromiseRejectCallback: … RangeError: Maximum call stack size exceeded`.

### A1.7 TS experiment F — value identity

`a`: `const o = {n:1}; edges.out = o; __log('a sees o.n=' + o.n);`; `b`: `value.n = 2; __log('b mutated value.n=' + value.n);` → `b mutated value.n=2, a sees o.n=2`. Values are passed by reference.

### A1.8 Rust CLI experiments (release binary)

| Fixture | Node code (abridged) | Output | Reading |
|---|---|---|---|
| `fanout.json` | `a`: one edge `out` with connectors `c1→b.in`, `c2→c.in`; `edges.out = value + '-from-a'; 'A_RET '` | `"C_GOT:in:foo-from-a ""A_RET "` | only the last connector fires (E.2) |
| `twoedges.json` | `a`: edges `left→b`, `right→c`; `edges.left = 'L'; 'A_RET '` | `"C_GOT:in:L ""A_RET "` | assignment to `left` is delivered to `right`'s target |
| `console.json` | probes `typeof` of globals | `"typeof console=object typeof fetch=undefined typeof require=undefined typeof scheduler=undefined typeof state=undefined typeof data=undefined typeof node=undefined this===globalThis:true keys=schedulerId,nodeId,graphId,field,edges,value edgesRead={} "` (the `console.log('CONSOLE_OUT')` in the same script printed nothing) | E.2 item 4 |
| `timers.json` | `typeof setTimeout/queueMicrotask/Promise/v8` | `"setTimeout=undefined queueMicrotask=undefined Promise=function globalThis.v8=undefined "` | no event loop |
| `return.json` | `return 1;` | (no output, exit 0); with `--verbosity 1`: `Compile error` | E.2 item 6 |
| `await.json` | `const x = await Promise.resolve(1); x` | (no output); `--verbosity 1`: `Compile error` | E.2 item 6 |
| `objvalue.json` | `edges.out = {a:1,b:[1,2]}; edges.out = 42.5; edges.out = true; 'A_RET '` → `b`: `typeof value + ':' + JSON.stringify(value)` | `"B_GOT:object:null ""B_GOT:number:42.5 ""B_GOT:boolean:true ""A_RET "` | E.3 |
| `getter.json` | `'edges.out reads as ' + edges.out` | `"edges.out reads as 42 "` | E.3 |
| `promise.json` | `Promise.resolve().then(()=>{ edges.out = 'FROM_MICROTASK'; }); 'A_RET '` | `"B_GOT:FROM_MICROTASK ""A_RET "` | microtasks drain at end of `run()` |
| `selfloop.json` | `if (Number(value) < 3) { edges.out = Number(value) + 1; } 'hop' + value + ' '` | `"hop3 ""hop2 ""hop1 ""hop0 "` exit 0 | bounded recursion OK |
| `infloop.json` | `edges.out = Number(value) + 1; ''` self-connector | after ~20 s: `<--- Last few GCs ---><--- JS stacktrace --->## Fatal javascript OOM in GC during deserialization#`, exit 133 | E.5 |
| `tsstub.json` (= TS `tests/stubs/proxyToLog.json`) | — | `panicked at src/loader.rs:95:8: Error parsing JSON into Graph: Error("missing field \`external\`", line: 18, column: 17)`, exit 101 | D.1 |
| `tests/fixtures/graphs/graph_cycle_outer.json` | — | `"foxtrot foo bar""foo bar""foo bar"`; verbose trace enters node `86c4e1de…` (inner graph), then `e4431ec2…`, then `5b07b419…`; `edges.alpha` (outer node `1`) never appears | D.2 |
| `tests/fixtures/graphs/graph_three_cycle_step_one.json` | — | `"oscar foo baz bar zaz""foo baz bar zaz""foo baz bar""foo baz"` | D.2 |
| any fixture, `--url nope` | — | `Cannot find node URL nope`, exit 1 | E.4 |
| `target/debug/plastic-io --help` | — | `panicked at …/clap_builder-4.5.1/src/builder/debug_asserts.rs:112:17: Command plastic-io: Short option names must be unique for each argument, but '-v' is in use by both 'verbosity' and 'value'` | E.4 |

## Appendix 2. The three load-bearing 2.0.1 → 2.0.3 source hunks (`git diff 08c7b6a HEAD -- src`)

`src/Node.ts` — set-function invocation:
```diff
-        let er;
-        let setResult: any;
         log.debug(`Node: Parse and run template for node.id: ${node.id} template length ${vect.template.set.length}`);
-        try {
-            setResult = await parseAndRun(vect.template.set, nodeInterface);
-        } catch (err: any) {
-            er = err;
+        parseAndRun(vect.template.set, nodeInterface).then((setResult: any) => {
+            scheduler.dispatchEvent("afterSet", {
+                id: newId(),
+                return: setResult,
+                time: Date.now(),
+                nodeInterface,
+            } as NodeSetEvent);
+        }).catch((err) => {
+            const er = err;
             scheduler.logger.error(`Node: set function caused an error: ${err.stack}`);
             scheduler.dispatchEvent("error", { … });
-        }
-        scheduler.dispatchEvent("afterSet", {
-            id: newId(),
-            err: er,
-            return: setResult,
-            time: Date.now(),
-            nodeInterface,
-        } as NodeSetEvent);
+        });
```

`src/Node.ts` — connector loop:
```diff
-                        if (connector.graphId !== graph.id || connector.version !== graph.version) {
+                        if (connector.graphId !== graph.id) {
                             graph = await scheduler.graphLoader.load(scheduler.getGraphPath(connector.graphId, connector.version));
                         }
 …
-                            await edgeExecute(scheduler, graph, nodeNext, connector.field, val);
-                            const end = Date.now();
-                            scheduler.dispatchEvent("endconnector", { … });
+                            edgeExecute(scheduler, graph, nodeNext, connector.field, val).then(() => {
+                                const end = Date.now();
+                                scheduler.dispatchEvent("endconnector", { … });
+                            }).catch((err) => {
+                                log.error(err.stack);
+                                scheduler.dispatchEvent("error", { …, edgeField: edge.field, connectorId: connector.id, nodeId: vect.id, graphId: graph.id });
+                            });
```

`src/Edge.ts` — `execute` now rejects:
```diff
-export async function execute(scheduler: Scheduler, graph: Graph, node: Node, field: string, value: any): Promise<any> {
-    …
-    await nodeExecute(scheduler, graph, node, field, value)
-    .then(end)
-    .catch((err) => {
-        const er = new Error("Edge: Error occured during node.execute: " + err.stack);
-        …
-        end();
-    });
+export function execute(scheduler: Scheduler, graph: Graph, node: Node, field: string, value: any): Promise<void> {
+    return new Promise(async (resolve, reject) => {
+        …
+        function end(er: any): void {
+            if (er) {
+                reject(er);  // Reject the promise here
+            }
+            … dispatchEvent("endedge", …);
+            resolve();  // Resolve the promise here
+        }
+        nodeExecute(scheduler, graph, node, field, value).then(() => {
+            end(null);
+        }).catch((err: any) => {
+            const er = new Error("Edge: Error occurred during node.execute: " + err);
+            … dispatchEvent("error", …);
+            end(err);
+        });
+    });
 }
```
The corresponding compiled lines in the installed copies: server `dist/Node.js:224` (version check), `dist/Node.js:331-365` (awaited set + unconditional `afterSet` with `err`), `dist/Edge.js:73` (old message); editor `dist/Node.js:237`, `dist/Node.js:344-375`, `dist/Edge.js:76`, `dist/Scheduler.js:143` (the new `try` in `url`).

## Appendix 3. Things checked and found absent (so they are not silently missing from this record)

| Looked for | Where | Result |
|---|---|---|
| Vue/React template compilation | `plastic-io/src/*.ts` | absent (only `template.set` is read) |
| `edges.<field>(value)` call form | `plastic-io/src/Node.ts:241-243` | absent (setter only) |
| `sequence` counter increments | `plastic-io/src/*.ts` | absent (declared `:125`, set to 0 `:200`, never touched) |
| Any reader of constructor `context` | `plastic-io/src/*.ts` | absent beyond assignment (`src/Scheduler.ts:201`) |
| Rust HTTP/URL loader | `plastic-io-rust/src`, `Cargo.toml` | absent (filesystem only) |
| Rust `LinkedNode` handling | `plastic-io-rust/src` | absent (struct only) |
| Rust `EventType::Load` / `EventType::Warning` emission | `plastic-io-rust/src` | absent (enum members only) |
| Rust console delegate / stdout from JS | `plastic-io-rust/src` | absent |
| Rust `Isolate` reuse / snapshot / pool | `plastic-io-rust/src/scheduler.rs` | absent (one per node execution) |
| Rust `unsafe`, FFI, `libc` calls | `plastic-io-rust/src` | absent (`libc` is an unused declared dependency) |
| Rust `catch_unwind` / panic policy | `plastic-io-rust/src`, `Cargo.toml` | absent (default unwind, `expect` everywhere) |
| Rust integration tests dir | `plastic-io-rust/tests/` | only `fixtures/`; all tests are unit tests in `src/scheduler.rs:368-547` |
| Rust benchmarks / examples | repo root | absent |
| Any consumer of the Rust runtime | graph-server `src`, graph-editor `packages` | absent |
