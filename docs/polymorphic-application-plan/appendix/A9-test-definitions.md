# A9. Test definitions and spec files

## A9.1 `ComponentTest` — contract test for `RateLimiter@1` (`components/<id>/1/tests/basic-limit.json`)
```json
{
 "schemaVersion": 1,
 "id": "basic-limit",
 "kind": "contract",
 "description": "Six hits within one window: five allowed, the sixth refused with a positive retryAfterMs",
 "component": {
  "publishedId": "rl-4d3b6a1e-9f02-4c8e-b1a7-2e6f8c0d5a11",
  "version": 1
 },
 "mode": "integrated",
 "fixtures": {
  "kv": {
   "prefix": "sim/basic-limit/ratelimit/"
  },
  "clock": {
   "start": "2026-09-20T18:00:00Z",
   "frozen": true
  }
 },
 "inputs": [
  {
   "field": "key",
   "value": {
    "key": "u1",
    "cost": 1
   },
   "repeat": 6
  }
 ],
 "expect": {
  "outputs": [
   {
    "field": "allowed",
    "sequence": [
     true,
     true,
     true,
     true,
     true,
     false
    ]
   },
   {
    "field": "retryAfterMs",
    "schema": {
     "type": "integer",
     "minimum": 1
    },
    "onlyWhen": {
     "field": "allowed",
     "equals": false
    }
   }
  ],
  "effects": [
   {
    "kind": "storage:kv",
    "scope": "ratelimit/u1/*",
    "count": {
     "min": 6,
     "max": 6
    }
   }
  ],
  "observations": [
   {
    "kind": "effect.denied",
    "count": {
     "min": 0,
     "max": 0
    }
   },
   {
    "kind": "contract.violation",
    "count": {
     "min": 0,
     "max": 0
    }
   }
  ],
  "invariants": [
   "outputs.allowed === false implies outputs.retryAfterMs > 0"
  ]
 },
 "budget": {
  "wallMs": 2000,
  "hops": 50
 },
 "runtime": [
  "ts"
 ]
}
```

## A9.2 `ComponentTest` — property test with a generator and shrinking
```json
{
 "schemaVersion": 1,
 "id": "never-exceeds-limit",
 "kind": "property",
 "description": "For any key and any sequence of costs, the number of allowed decisions in a window never exceeds properties.limit",
 "component": {
  "publishedId": "rl-4d3b6a1e-9f02-4c8e-b1a7-2e6f8c0d5a11",
  "version": 1
 },
 "mode": "contract-stub",
 "fixtures": {
  "kv": {
   "prefix": "sim/never-exceeds-limit/ratelimit/"
  },
  "clock": {
   "start": "2026-09-20T18:00:00Z",
   "frozen": true
  }
 },
 "inputs": [
  {
   "field": "key",
   "generator": {
    "type": "object",
    "properties": {
     "key": {
      "type": "string",
      "pattern": "^[a-z]{1,8}$"
     },
     "cost": {
      "type": "integer",
      "minimum": 1,
      "maximum": 3
     }
    },
    "required": [
     "key"
    ]
   },
   "repeat": {
    "min": 1,
    "max": 40
   }
  }
 ],
 "expect": {
  "invariants": [
   "count(outputs.allowed === true) <= sum over allowed of inputs.cost <= properties.limit",
   "forall i: outputs[i].allowed === false implies outputs[i].retryAfterMs > 0"
  ],
  "effects": [
   {
    "kind": "net:https",
    "count": {
     "min": 0,
     "max": 0
    }
   }
  ]
 },
 "property": {
  "runs": 200,
  "seed": "1758400000",
  "shrink": true
 },
 "budget": {
  "wallMs": 10000,
  "hops": 2000
 },
 "runtime": [
  "ts",
  "rust"
 ]
}
```
`runtime:["ts","rust"]` means the runner executes it on both engines and reports per-runtime results; a divergence is a result of its own (`status:"fail"` with `message:"runtime disagreement"`), which is how the TS/Rust semantic table of A3 §G becomes a test rather than prose.

## A9.3 `IntentJourney` — continuous synthetic journey (`journeys/account-settings-change.json`)
```json
{
 "schemaVersion": 1,
 "id": "account-settings-change",
 "intent": "A signed-in user changes their account email and the change persists",
 "capability": "account.settings.update",
 "identity": {
  "syntheticPrincipal": "synthetic:journeys",
  "tenant": "synthetic"
 },
 "schedule": "*/5 * * * *",
 "effects": "isolated",
 "fixtures": {
  "account": {
   "create": {
    "capability": "account.create",
    "input": {
     "email": "j-${run}@synthetic.example"
    }
   },
   "cleanup": {
    "capability": "account.delete",
    "ttlMinutes": 30
   }
  }
 },
 "steps": [
  {
   "act": {
    "invoke": {
     "capability": "account.settings.update",
     "input": {
      "email": "a.b@example.com"
     }
    }
   },
   "expect": {
    "observation": {
     "kind": "exec.end",
     "where": {
      "state": "completed"
     }
    },
    "outputs": {
     "schema": {
      "type": "object",
      "properties": {
       "ok": {
        "const": true
       }
      },
      "required": [
       "ok"
      ]
     }
    }
   }
  },
  {
   "act": {
    "invoke": {
     "capability": "account.settings.read",
     "input": {}
    }
   },
   "expect": {
    "state": {
     "schema": {
      "type": "object",
      "properties": {
       "email": {
        "const": "a.b@example.com"
       }
      },
      "required": [
       "email"
      ]
     }
    }
   }
  }
 ],
 "budget": {
  "wallMs": 15000,
  "hops": 500
 },
 "flakiness": {
  "retries": 1,
  "quarantineAfter": 3
 },
 "alert": {
  "onFail": "page",
  "onUnresolvable": "ticket"
 }
}
```
Resolution rule: `capability` strings resolve to nodes whose `properties.capabilities.provides` contains them in the **active** revision (see the `http` node of A7.3 which provides `api.rate-limited-entry`); no node id or connector appears in the journey, so it survives re-wiring. If resolution yields zero or more than one entry the run reports `unresolvable` and the alert policy files a ticket instead of paging.

## A9.4 Admission adversarial spec (graph-server, jest 26 style with the existing doubles)
```js
// src/admission/__tests__/adversarial.spec.js  (uses FakeS3Service and the inline FakeBroadcastService pattern from src/__tests__/crdtService.js:36-74)
const { FakeS3Service } = require("../../__testHelpers__/fakeS3");
const { CrdtStore } = require("../../crdtStore");
const { AdmissionService } = require("../admit");
const { PolicyStore } = require("../../policy/acl");
const Y = require("yjs");
const { fromJSON, encodeState } = require("@plastic-io/graph-crdt");

function seededStore(graphId, graph) {
  const s3 = new FakeS3Service(); const store = new CrdtStore(s3);
  const doc = new Y.Doc(); fromJSON(doc, graph);
  return store.appendUpdate(graphId, encodeState(doc), "seed", "system").then(() => ({ s3, store }));
}
const u1 = { sub: "auth0|u1", kind: "human", tenant: "t1" };
const stranger = { sub: "auth0|u9", kind: "human", tenant: "t2" };
const envelope = (over) => Object.assign({ action: "yjs", schemaVersion: 2, mutationId: "01J8ZK5K0B1C2D3E4F5G6H7J8K", graphId: "g1", kind: "update", description: "edit", format: 2 }, over);

describe("admission", () => {
  let s3, store, admission, broadcast;
  beforeEach(async () => {
    ({ s3, store } = await seededStore("g1", require("../../__tests__/__data__/graph_two_nodes.json")));
    broadcast = { channel: [], direct: [], _sendToChannel: (id, v, cb) => { broadcast.channel.push([id, v]); cb(); }, post: (c, v) => broadcast.direct.push([c, v]) };
    const policy = new PolicyStore(s3); await policy.putAcl("g1", { tenant: "t1", grants: { "auth0|u1": ["graph:read", "graph:commit"] } });
    admission = new AdmissionService({ store, broadcast, policy, limits: { maxUpdateBytes: 1 << 20, maxStructs: 50000 } });
  });

  test("the poisoning frame is rejected before storage (reproduces A2 §D.2)", async () => {
    const before = s3.objects.size;
    const res = await admission.admit(envelope({ update: Buffer.from([2, 3, 1, 2, 3]).toString("base64") }), u1, "conn-1");
    expect(res.decision).toBe("rejected"); expect(res.code).toBe("SCHEMA_INVALID");
    expect(s3.objects.size).toBe(before);            // nothing appended
    expect(broadcast.channel).toHaveLength(0);       // nothing fanned out
    expect(broadcast.direct[0][1].response.decision).toBe("rejected");   // reject frame to the sender
    const state = await store.loadMerged("g1"); expect(state).toBeTruthy();   // graph still readable
  });

  test("a principal without a grant on the graph is denied and existence is not disclosed", async () => {
    const res = await admission.admit(envelope({ update: await validUpdate(store, "g1", (g) => { g.properties.name = "x"; }) }), stranger, "conn-2");
    expect(res).toMatchObject({ decision: "rejected", code: "NOT_FOUND" });
  });

  test("a structurally valid update that touches the policy namespace is rejected even for the owner", async () => {
    const upd = await validUpdate(store, "g1", (g) => { g.properties.__acl = { "auth0|u1": ["policy:admin"] }; });
    const res = await admission.admit(envelope({ update: upd }), u1, "conn-1");
    expect(res.code).toBe("ADMISSION_DENIED"); expect(res.reason).toMatch(/policy namespace/);
  });

  test("adding a capability grant needs graph:connect-privileged", async () => {
    const upd = await validUpdate(store, "g1", (g) => { g.nodes[0].properties.capabilities = { granted: [{ kind: "aws:cfn", scope: ["*"], operations: ["apply"] }] }; });
    const res = await admission.admit(envelope({ update: upd }), u1, "conn-1");
    expect(res.code).toBe("CAPABILITY_MISSING"); expect(res.diffSummary.privilegeDelta[0].kind).toBe("aws:cfn");
  });

  test("duplicate mutationId returns the original ack and appends once", async () => {
    const upd = await validUpdate(store, "g1", (g) => { g.properties.name = "renamed"; });
    const a = await admission.admit(envelope({ update: upd }), u1, "conn-1");
    const n = s3.objects.size;
    const b = await admission.admit(envelope({ update: upd }), u1, "conn-1");
    expect(b).toEqual(a); expect(s3.objects.size).toBe(n);
  });

  test("oversize update is refused without decoding", async () => {
    const res = await admission.admit(envelope({ update: Buffer.alloc(2 << 20).toString("base64") }), u1, "conn-1");
    expect(res.code).toBe("SCHEMA_INVALID"); expect(res.reason).toMatch(/maxUpdateBytes/);
  });

  test("two concurrent admitted updates converge and both are audited", async () => {
    const [ua, ub] = await Promise.all([validUpdate(store, "g1", (g) => { g.nodes[0].properties.x = 10; }), validUpdate(store, "g1", (g) => { g.nodes[1].properties.x = 20; })]);
    await Promise.all([admission.admit(envelope({ mutationId: "01J8ZK5K0B1C2D3E4F5G6H7J8A", update: ua }), u1, "c1"), admission.admit(envelope({ mutationId: "01J8ZK5K0B1C2D3E4F5G6H7J8B", update: ub }), u1, "c2")]);
    const g = await store.projectGraph("g1"); expect(g.nodes[0].properties.x).toBe(10); expect(g.nodes[1].properties.x).toBe(20);
    expect([...s3.objects.keys()].filter((k) => k.startsWith("audit/g1/"))).toHaveLength(3);   // seed + 2
  });
});

// helper: produce a V2 update by applying a mutation to a clone of the current head through reconcile()
async function validUpdate(store, graphId, mutate) {
  const { reconcile, toJSON } = require("@plastic-io/graph-crdt");
  const head = await store.loadMerged(graphId); const doc = new Y.Doc(); Y.applyUpdateV2(doc, head);
  const snapshot = toJSON(doc); mutate(snapshot);
  let out; doc.on("updateV2", (u) => (out = u)); reconcile(doc, snapshot, { source: "test" });
  return Buffer.from(out).toString("base64");
}
```

## A9.5 Scheduler ordering/completion spec (plastic-io 2.1, jest) — the assertions the current suite lacks (A3 §C.1)
```js
// tests/unit/Execution.spec.js
const Scheduler = require("../../dist/index.js").default;
const graph = require("../stubs/fanoutAsync.json");   // a --out→ [b (async 20 ms), c (sync)]

test("end fires only after all in-flight work settles, and fan-out order is connector order", async () => {
  const events = []; const s = new Scheduler(graph, {}, {});
  ["begin", "beginedge", "endedge", "beginconnector", "endconnector", "afterSet", "error", "end"].forEach((n) => s.addEventListener(n, (e) => events.push(n + ":" + (e.nodeId || e.connector?.nodeId || e.url || ""))));
  const handle = s.url("a", 1, "in", null);
  expect(handle.executionId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  const result = await handle.done;                 // resolves after b's timer fired
  expect(events.indexOf("beginconnector:b")).toBeLessThan(events.indexOf("beginconnector:c"));
  expect(events[events.length - 1]).toBe("end:a");
  expect(events.filter((e) => e === "afterSet:b")).toHaveLength(1);
  expect(result.state).toBe("completed");
});

test("cancellation stops at the next hop and marks the execution cancelled", async () => {
  const s = new Scheduler(require("../stubs/selfLoopAsync.json"), {}, {}, undefined, { budget: { hops: 1000, wallMs: 5000 } });
  const handle = s.url("a", 0, "in", null);
  setTimeout(() => handle.cancel("test"), 30);
  const result = await handle.done;
  expect(result.state).toBe("cancelled"); expect(result.budgetUsed.hops).toBeLessThan(1000);
});

test("hop budget ends an unbounded synchronous loop with budget.exhausted instead of a stack overflow", async () => {
  const s = new Scheduler(require("../stubs/selfLoopSync.json"), {}, {}, undefined, { budget: { hops: 100 } });
  const kinds = []; s.addEventListener("budget", (e) => kinds.push(e.dimension));
  const result = await s.url("a", 0, "in", null).done;
  expect(kinds).toEqual(["hops"]); expect(result.state).toBe("failed"); expect(result.errors[0].message).toMatch(/BudgetExceeded/);
});

test("a set function cannot reach host globals when run through the isolate executor", async () => {
  const { execute } = require("../../../graph-server/src/runtime/executor");   // server-side wrapper (isolated-vm)
  const result = await execute({ graph: require("../stubs/probeGlobals.json"), entry: "probe", field: "in", value: null, grants: [] });
  expect(result.outputs.report).toEqual({ require: "undefined", process: "undefined", fetch: "undefined", AWS: "undefined", host: "object" });
});
```

## A9.6 Hybrid Playwright spec (outline; two browser contexts + dev server + a fake `graph-notify` feed)
```ts
// e2e/hybrid/dedup.spec.ts
test("N viewers render, one effect on the server", async ({ browser }) => {
  const [a, b] = await Promise.all([browser.newContext(), browser.newContext()]);
  const [pa, pb] = await Promise.all([a.newPage(), b.newPage()]);
  await Promise.all([pa.goto(`/${GRAPH}`), pb.goto(`/${GRAPH}`)]);                  // both subscribe to graph-notify-<id>
  const res = await request.post(`${HTTP}/viz.in`, { data: { seed: 7 } });         // server-owned execution (trace §6.3)
  const { executionId } = await res.json();
  await expect(pa.locator('[data-test="shader-frame"]')).toHaveCount(1);
  await expect(pb.locator('[data-test="shader-frame"]')).toHaveCount(1);
  const obs = await request.get(`${HTTP}/observations?executionId=${executionId}&kind=effect`).then((r) => r.json());
  expect(obs.observations.filter((o) => o.capability?.kind === "net:https")).toHaveLength(1);   // effect executed once
  expect(obs.observations.filter((o) => o.kind === "edge.input" && o.domain === "browser")).toHaveLength(2);   // one per viewer, deduped per (executionId, connectorId, seq)
});
```
