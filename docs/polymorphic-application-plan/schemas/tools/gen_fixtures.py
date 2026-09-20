import sys, json, hashlib, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_schemas import DEFS, obj, ref, arr, schema
P=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))   # plan directory
F=f'{P}/schemas/fixtures'; os.makedirs(F, exist_ok=True)
def canon(o): return json.dumps(o, sort_keys=True, separators=(',',':'), ensure_ascii=False)
def sha(o): return 'sha256:'+hashlib.sha256(canon(o).encode()).hexdigest()
# ---------- proposed Graph JSON schema (current editor shape [FACT: mutation.ts:724-771, connectors.ts:53-83, mouse.ts:233-257, mutation.ts:182-288] + additive proposed keys) ----------
PORT=obj({"name":{"type":"string","maxLength":64},"type":{"type":"string","maxLength":64},"external":{"type":"boolean"},"visible":{"type":"boolean"}},["name","type","external"])
CONNECTOR=obj({"id":{"type":"string"},"nodeId":{"type":"string"},"field":{"type":"string"},"graphId":{"type":"string"},"version":{"type":"integer"}},["id","nodeId","field","graphId","version"])
EDGE=obj({"field":{"type":"string"},"connectors":{"type":"array","items":CONNECTOR}},["field","connectors"])
FIELDMAP=obj({"id":{"type":"string"},"field":{"type":"string"},"type":{"type":"string"},"visible":{"type":"boolean"},"external":{"type":"boolean"}},["id","field","type","external"])
NODEPROPS=obj({"inputs":{"type":"array","items":PORT},"outputs":{"type":"array","items":PORT},"groups":{"type":"array","items":{"type":"string"}},"name":{"type":"string"},"description":{"type":"string"},"createdOn":{"type":"integer"},"lastUpdate":{"type":"integer"},"tags":{"type":"array","items":{"type":"string"}},"icon":{"type":"string"},"positionAbsolute":{"type":"boolean"},"appearsInPresentation":{"type":"boolean"},"appearsInExport":{"type":"boolean"},"x":{"type":"number"},"y":{"type":"number"},"z":{"type":"number"},"presentation":obj({"x":{"type":"number"},"y":{"type":"number"},"z":{"type":"number"},"order":{"type":"integer"}}),"scripts":{"type":"string"},
  # ---- proposed (schemaVersion 2) ----
  "placement":{"enum":["browser","server","portable"]},"component":ref("componentPin"),
  "capabilities":obj({"required":arr(ref("capabilityRequirement"),32),"granted":arr(ref("capabilityGrant"),32),"provides":arr({"type":"string","maxLength":128},16)}),
  "contract":obj({"inputs":arr(ref("portContract"),64),"outputs":arr(ref("portContract"),64)}),"budgets":ref("budget"),"builtin":{"type":"string","maxLength":64}},
  ["inputs","outputs","groups","name","description","tags","icon","x","y","z"])
NODEPROPS["additionalProperties"]=True   # node.properties is untyped today [FACT Node.d.ts: properties: any]; node-specific config (e.g. `limit`) lives here
NODE={"type":"object","additionalProperties":False,"required":["id","edges","version","graphId","url","properties","template"],"properties":{
  "id":{"type":"string"},"edges":{"type":"array","items":EDGE},"version":{"type":"integer"},"graphId":{"type":"string"},"artifact":{"type":["string","null"]},"url":{"type":"string"},"data":{},
  "linkedGraph":obj({"id":{"type":"string"},"version":{"type":"integer"},"data":{"type":"object"},"loaded":{"type":"boolean"},"graph":{"$ref":"#"},"properties":{"type":"object"},"fields":obj({"inputs":{"type":"object","additionalProperties":FIELDMAP},"outputs":{"type":"object","additionalProperties":FIELDMAP}},["inputs","outputs"])},["id","version","loaded","graph","fields"]),
  "linkedNode":obj({"id":{"type":"string"},"version":{"type":"integer"},"node":{"type":"object"},"loaded":{"type":"boolean"}},["id","version","loaded"]),
  "properties":NODEPROPS,"template":obj({"set":{"type":"string"},"vue":{"type":"string"}},["set","vue"])}}
GRAPH_SCHEMA={"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"https://plastic-io.github.io/schemas/graph.json","title":"Graph (editor shape, schemaVersion 1 + additive 2)",
  "type":"object","additionalProperties":False,"required":["id","url","version","nodes","properties"],
  "properties":{"id":{"type":"string"},"url":{"type":"string"},"version":{"type":"integer"},"nodes":{"type":"array","items":NODE},
    "properties":obj({"name":{"type":"string"},"description":{"type":"string"},"exportable":{"type":"boolean"},"icon":{"type":"string"},"createdBy":{"type":"string"},"createdOn":{"type":"integer"},"lastUpdate":{"type":"integer"},"height":{"type":"number"},"width":{"type":"number"},"timeout":{"type":"integer"},"logLevel":{"type":"integer"},"template":{"type":"string"},"tags":{"type":"array","items":{"type":"string"}},"scripts":{"type":"string"},"startInPresentationMode":{"type":"boolean"},"lastUpdatedBy":{"type":"string"},"budgets":ref("budget")},["name","description","exportable","icon","createdBy","createdOn","lastUpdate","height","width"]),
    "meta":obj({"schemaVersion":{"type":"integer"}})},"$defs":DEFS}
json.dump(GRAPH_SCHEMA, open(f'{F}/graph.schema.json','w'), indent=1)
T0=1758400000000
def node(id_, url, name, gid, ver, inputs, outputs, edges, set_code, x, y, extra=None, vue=""):
    props={"inputs":[{"name":n,"type":t,"external":ext,"visible":True} for n,t,ext in inputs],
           "outputs":[{"name":n,"type":t,"external":ext,"visible":True} for n,t,ext in outputs],
           "groups":[],"name":name,"description":"","createdOn":T0,"lastUpdate":T0,"tags":[],"icon":"mdi-node-rectangle","positionAbsolute":False,"appearsInPresentation":False,"appearsInExport":False,"x":x,"y":y,"z":0,"presentation":{"x":0,"y":0,"z":0}}
    if extra: props.update(extra)
    return {"id":id_,"edges":edges,"version":ver,"graphId":gid,"artifact":None,"url":url,"data":None,"properties":props,"template":{"set":set_code,"vue":vue}}
# ---------- 1. RateLimiter source graph (published as RateLimiter@1) ----------
RL="rl-4d3b6a1e-9f02-4c8e-b1a7-2e6f8c0d5a11"
window_set = ("// counts hits in a 60 s window; host.kv is the storage:kv capability binding (proposed)\n"
 "var win = Math.floor(Date.now() / 60000);\n"
 "var k = 'ratelimit/' + value.key + '/' + win;\n"
 "return host.kv.incr(k, value.cost || 1, { ttlMs: 120000 }).then(function (count) {\n"
 "  edges.count = { key: value.key, count: count, windowEndsAt: (win + 1) * 60000 };\n"
 "});\n")
decide_set = ("var limit = properties.limit || 5;\n"
 "if (value.count <= limit) { edges.allowed = true; }\n"
 "else { edges.allowed = false; edges.retryAfterMs = Math.max(0, value.windowEndsAt - Date.now()); }\n")
rl_graph={"id":RL,"url":"rate-limiter","version":3,"nodes":[
  node("window","window","Window counter",RL,3,[("key","String",True),("cost","Number",True)],[("count","Object",False)],
       [{"field":"count","connectors":[{"id":"c-rl-1","nodeId":"decide","field":"count","graphId":RL,"version":3}]}],window_set,120,80,
       {"placement":"server","capabilities":{"required":[{"kind":"storage:kv","scope":["ratelimit/*"]}],"granted":[]},"contract":{"inputs":[{"name":"key","schema":{"type":"string","maxLength":256},"required":True},{"name":"cost","schema":{"type":"integer","minimum":1},"required":False,"default":1}],"outputs":[{"name":"count","schema":{"type":"object"},"required":True}]}}),
  node("decide","decide","Decide",RL,3,[("count","Object",False)],[("allowed","Boolean",True),("retryAfterMs","Number",True)],
       [{"field":"allowed","connectors":[]},{"field":"retryAfterMs","connectors":[]}],decide_set,420,80,
       {"placement":"portable","contract":{"inputs":[{"name":"count","schema":{"type":"object"},"required":True}],"outputs":[{"name":"allowed","schema":{"type":"boolean"},"required":True},{"name":"retryAfterMs","schema":{"type":"integer","minimum":0},"required":False}]},"limit":5})],
  "properties":{"name":"RateLimiter","description":"Sliding-window rate limiter keyed by caller","exportable":True,"icon":"mdi-speedometer","createdBy":"auth0|u1","createdOn":T0,"lastUpdate":T0,"height":150,"width":300,"timeout":30000,"logLevel":2,"template":"","tags":["server"]},
  "meta":{"schemaVersion":2}}
rl_digest=sha(rl_graph)
manifest={"schemaVersion":1,"publishedId":RL,"version":1,"kind":"graph","digest":rl_digest,
  "contract":{"inputs":[{"name":"key","schema":{"type":"string","maxLength":256},"required":True},{"name":"cost","schema":{"type":"integer","minimum":1},"required":False,"default":1}],
              "outputs":[{"name":"allowed","schema":{"type":"boolean"},"required":True},{"name":"retryAfterMs","schema":{"type":"integer","minimum":0},"required":False}]},
  "capabilities":[{"kind":"storage:kv","scope":["ratelimit/*"]}],"placement":"server","dependencies":[],
  "summary":{"intent":"Sliding-window rate limiter keyed by caller","invariants":["allowed === false implies retryAfterMs > 0","count is monotonic within a window"],"provenance":"authored"},
  "tests":[{"kind":"contract","id":"basic-limit","artifactRef":{"graphId":RL,"nodeId":"tests","revisionId":"rev_01J8ZK3Q4W5X6Y7Z8A9B0C1D2E","sha256":hashlib.sha256(b"basic-limit").hexdigest()}}],
  "budgets":{"hops":50,"wallMs":2000},
  "provenance":{"publishedBy":{"sub":"auth0|u1","kind":"human","tenant":"t1"},"fromGraph":{"graphId":RL,"revisionId":"rev_01J8ZK3Q4W5X6Y7Z8A9B0C1D2E"},"at":"2026-09-20T18:20:00Z","mutationId":"01J8ZKAA0B1C2D3E4F5G6H7J8K"},
  "compat":{"runtime":{"ts":">=2.1.0"}}}
# ---------- 2. api-graph instance (what addGraphItem writes today + proposed pin) ----------
API="api-2b7c9d40-1e5f-4a6b-8c3d-7f9e0a1b2c33"
inner=json.loads(json.dumps(rl_graph))   # embedded frozen copy [FACT mutation.ts:226-237]
fields={"inputs":{"key":{"id":"window","field":"key","type":"String","visible":True,"external":False},"cost":{"id":"window","field":"cost","type":"Number","visible":True,"external":False}},
        "outputs":{"allowed":{"id":"decide","field":"allowed","type":"Boolean","visible":True,"external":False},"retryAfterMs":{"id":"decide","field":"retryAfterMs","type":"Number","visible":True,"external":False}}}
N=node("N","RateLimiter","RateLimiter",API,5,[("key","String",False),("cost","Number",False)],[("allowed","Boolean",False),("retryAfterMs","Number",False)],
       [{"field":"allowed","connectors":[{"id":"c-api-2","nodeId":"handler","field":"in","graphId":API,"version":5}]},{"field":"retryAfterMs","connectors":[{"id":"c-api-3","nodeId":"reject","field":"retryAfterMs","graphId":API,"version":5}]}],"",300,120,
       {"placement":"server","component":{"publishedId":RL,"version":1,"digest":rl_digest},"capabilities":{"required":[{"kind":"storage:kv","scope":["ratelimit/*"]}],"granted":[{"kind":"storage:kv","scope":["ratelimit/*"],"operations":["get","incr"]}]}})
N["artifact"]=f"artifacts/{RL}.1"; N["linkedGraph"]={"id":RL,"version":1,"data":{},"loaded":True,"graph":inner,"properties":{},"fields":fields}
http=node("http","api","HTTP entry",API,5,[("in","Object",True)],[("out","Object",False)],
  [{"field":"out","connectors":[{"id":"c-api-1","nodeId":"N","field":"key","graphId":API,"version":5}]}],"edges.out = value.key || value.headers['x-caller'];\n",40,120,{"placement":"server","capabilities":{"provides":["api.rate-limited-entry"]}})
handler=node("handler","handler","Handler",API,5,[("in","Boolean",False)],[("response","Object",False)],[{"field":"response","connectors":[]}],"edges.response = { status: 200, body: 'ok' };\n",580,60,{"placement":"portable"})
reject=node("reject","reject","Reject",API,5,[("retryAfterMs","Number",False)],[("response","Object",False)],[{"field":"response","connectors":[]}],"edges.response = { status: 429, headers: { 'retry-after': Math.ceil(value / 1000) } };\n",580,200,{"placement":"portable"})
api_graph={"id":API,"url":"api","version":5,"nodes":[http,N,handler,reject],
  "properties":{"name":"api-graph","description":"Rate-limited API entry","exportable":False,"icon":"mdi-graph","createdBy":"auth0|u1","createdOn":T0,"lastUpdate":T0+1000,"height":150,"width":300,"timeout":30000,"logLevel":2,"template":""},"meta":{"schemaVersion":2}}
# ---------- 3. semantic diff examples ----------
diff_rename={"fromRevision":"rev_01J8ZK3Q4W5X6Y7Z8A9B0C1D2E","toRevision":"rev_01J8ZK3Q4W5X6Y7Z8A9B0C1D2F","namespaces":["definition"],"layoutOnly":False,"privilegeDelta":[],
  "changes":[{"kind":"port.changed","nodeId":"validate","field":"ok","before":{"name":"out","type":"Object","external":False},"after":{"name":"ok","type":"Object","external":False},"privilege":"none"},
             {"kind":"edge.removed","nodeId":"validate","field":"out","before":{"field":"out","connectors":[{"id":"c-7","nodeId":"handler","field":"in","graphId":"7ba47581-fb4e-4ee3-a200-80fcb6d83fe6","version":11}]}},
             {"kind":"edge.added","nodeId":"validate","field":"ok","after":{"field":"ok","connectors":[{"id":"c-7","nodeId":"handler","field":"in","graphId":"7ba47581-fb4e-4ee3-a200-80fcb6d83fe6","version":11}]}}]}
diff_upgrade={"fromRevision":"rev_01J8ZK3Q4W5X6Y7Z8A9B0C1D2E","toRevision":"rev_01J8ZK3Q4W5X6Y7Z8A9B0C1D2G","namespaces":["definition","code"],"layoutOnly":False,"privilegeDelta":[],
  "changes":[{"kind":"component.pin.changed","nodeId":"N","before":{"publishedId":RL,"version":1,"digest":rl_digest},"after":{"publishedId":RL,"version":2,"digest":"sha256:"+"e"*64},"privilege":"none"},
             {"kind":"port.changed","nodeId":"N","field":"retryAfterMs","before":{"required":False},"after":{"required":True}},
             {"kind":"code.changed","nodeId":"N","hunks":[{"oldStart":2,"oldLines":1,"newStart":2,"newLines":2,"text":"-else { edges.allowed = false; edges.retryAfterMs = Math.max(0, value.windowEndsAt - Date.now()); }\n+else { edges.allowed = false; edges.retryAfterMs = Math.max(1, value.windowEndsAt - Date.now()); }\n+edges.retryAfterMs = edges.retryAfterMs;"}]}]}
# ---------- 4. exact traversal calls (JSON-RPC, MCP 2026-07-28 framing) with real byte sizes ----------
META={"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientInfo":{"name":"pio-agent","version":"0.3.0"},"io.modelcontextprotocol/clientCapabilities":{"extensions":{"io.modelcontextprotocol/tasks":{}}}}
G="7ba47581-fb4e-4ee3-a200-80fcb6d83fe6"; R12="rev_01J8ZK3Q4W5X6Y7Z8A9B0C1D2E"; R11="rev_01J8ZK3Q4W5X6Y7Z8A9B0C1D2D"; R13="rev_01J8ZK3Q4W5X6Y7Z8A9B0C1D2F"
PR={"sub":"agent:a1","kind":"agent","tenant":"t1","delegatedBy":"auth0|u1"}
def env(rid, corr, **kw):
    e={"schemaVersion":"1","requestId":rid,"principal":PR,"graphId":G,"correlationId":corr,"policyVersion":"p12","serverTime":"2026-09-20T18:31:00Z","truncated":False}; e.update(kw); return e
def req(i, method, params): p=dict(params); p["_meta"]=META; return {"jsonrpc":"2.0","id":i,"method":method,"params":p}
def tres(i, sc): return {"jsonrpc":"2.0","id":i,"result":{"resultType":"complete","content":[{"type":"text","text":json.dumps(sc,separators=(',',':'))}],"structuredContent":sc}}
def rres(i, uri, body): return {"jsonrpc":"2.0","id":i,"result":{"resultType":"complete","contents":[{"uri":uri,"mimeType":"application/json","text":json.dumps(body,separators=(',',':'))}],"ttlMs":5000,"cacheScope":"private"}}
def summary(nid, name, purpose, ins, outs, deg, health=None, extra=None):
    s={"id":nid,"graphId":G,"revisionId":R12,"kind":"node","name":name,"purpose":purpose,"intentProvenance":"authored","freshness":{"computedAt":"2026-09-20T18:30:00Z","sourceRevision":R12,"stale":False},
       "inputs":[{"name":n,"schema":sc,"required":True} for n,sc in ins],"outputs":[{"name":n,"schema":sc,"required":True} for n,sc in outs],"placement":"server","degree":deg,"pointers":{"node":f"plastic://graph/{G}/rev/{R12}/node/{nid}","code":f"plastic://graph/{G}/rev/{R12}/node/{nid}?expand=code","observations":f"plastic://graph/{G}/observations?nodeId={nid}","tests":f"plastic://graph/{G}/journeys"},"untrusted":["purpose"]}
    if health: s["health"]=health
    if extra: s.update(extra)
    return s
CORR="01J8ZK5A0B1C2D3E4F5G6H7J8K"
calls=[]
# 1 journeys resource
calls.append(("resources/read journeys", req(1,"resources/read",{"uri":f"plastic://graph/{G}/journeys"}),
  rres(1,f"plastic://graph/{G}/journeys",{"journeys":[{"id":"account-settings-change","intent":"A signed-in user changes their account email and the change persists","capability":"account.settings.update","schedule":"*/5 * * * *","lastResult":{"status":"failed","at":"2026-09-20T18:25:03Z","failingSince":R12,"correlationId":CORR,"lastFailure":{"observationId":"01J8ZK5B0B1C2D3E4F5G6H7J8K","step":2,"message":"assert persisted: expected email to equal 'a.b@example.com'"}},"quarantined":False}],"nextCursor":None})))
# 2 observations.query
obs=[{"id":"01J8ZK5B0B1C2D3E4F5G6H7J8K","seq":7,"at":"2026-09-20T18:25:02Z","kind":"contract.violation","graphId":G,"revisionId":R12,"instancePath":[],"nodeId":"validate","edgeField":"errors","executionId":"01J8ZK5C0B1C2D3E4F5G6H7J8K","spanId":"01J8ZK5D0B1C2D3E4F5G6H7J8K","parentSpanId":"01J8ZK5E0B1C2D3E4F5G6H7J8K","correlationId":CORR,"domain":"server","owner":{"sub":"synthetic:journeys","kind":"synthetic","tenant":"synthetic"},"payload":{"field":"email","reason":"pattern","value":{"redacted":"hash","hash":"sha256:9c1f…","bytes":16}}},
     {"id":"01J8ZK5F0B1C2D3E4F5G6H7J8K","seq":8,"at":"2026-09-20T18:25:02Z","kind":"exec.error","graphId":G,"revisionId":R12,"instancePath":[],"nodeId":"validate","executionId":"01J8ZK5C0B1C2D3E4F5G6H7J8K","spanId":"01J8ZK5D0B1C2D3E4F5G6H7J8K","correlationId":CORR,"domain":"server","owner":{"sub":"synthetic:journeys","kind":"synthetic","tenant":"synthetic"},"payload":{"message":"validation failed: email"}}]
calls.append(("observations.query", req(2,"tools/call",{"name":"observations.query","arguments":{"schemaVersion":1,"graphId":G,"filter":{"correlationId":CORR},"limit":20}}),
  tres(2,{"envelope":env("01J8ZK5G0B1C2D3E4F5G6H7J8K",CORR,resultRevision=R12),"result":{"observations":obs,"redactedCount":1}})))
# 3 graph.summary validate
calls.append(("graph.summary validate", req(3,"tools/call",{"name":"graph.summary","arguments":{"schemaVersion":1,"graphId":G,"revisionId":R12,"nodeId":"validate","include":["contract","health","deps"]}}),
  tres(3,{"envelope":env("01J8ZK5H0B1C2D3E4F5G6H7J8K",CORR,resultRevision=R12),"result":summary("validate","Validate settings","Validates the normalised settings object against the account schema and emits errors per field",[("value",{"type":"object","properties":{"email":{"type":"string","pattern":"^[^@]+@[^@]+$"}},"required":["email"]})],[("ok",{"type":"object"}),("errors",{"type":"array"})],{"in":2,"out":2},{"lastRunAt":"2026-09-20T18:25:02Z","errorRate24h":1.0,"p95Ms":4,"lastFailure":{"observationId":"01J8ZK5F0B1C2D3E4F5G6H7J8K","kind":"exec.error","at":"2026-09-20T18:25:02Z"}},{"dependencies":[{"publishedId":"EmailRules","version":7,"digest":"sha256:"+"a"*64}],"invariants":["errors is empty iff ok is emitted"]})})))
# 4 graph.expand in
n_form=summary("form","Settings form","Collects the settings form values from the browser UI",[("submit",{"type":"object"})],[("value",{"type":"object"})],{"in":0,"out":1},extra={"placement":"browser"})
n_norm=summary("normalize","Normalize","Lowercases and trims the email before validation",[("value",{"type":"object"})],[("out",{"type":"object"})],{"in":1,"out":1},{"lastRunAt":"2026-09-20T18:25:02Z","errorRate24h":0.0,"p95Ms":1},{"placement":"portable"})
calls.append(("graph.expand in", req(4,"tools/call",{"name":"graph.expand","arguments":{"schemaVersion":1,"graphId":G,"revisionId":R12,"root":{"nodeId":"validate"},"direction":"in","depth":1,"maxNodes":20,"maxBytes":65536}}),
  tres(4,{"envelope":env("01J8ZK5J0B1C2D3E4F5G6H7J8K",CORR,resultRevision=R12),"result":{"nodes":[n_form,n_norm],"edges":[{"connectorId":"c-3","from":{"nodeId":"form","field":"value"},"to":{"nodeId":"normalize","field":"value"}},{"connectorId":"c-4","from":{"nodeId":"normalize","field":"out"},"to":{"nodeId":"validate","field":"value"}}],"truncated":{"byDepth":False,"byCount":False,"byBytes":False},"cost":{"nodes":2,"bytes":2210,"ms":12}}})))
# 5 diff resource
calls.append(("resources/read diff rev11..rev12", req(5,"resources/read",{"uri":f"plastic://graph/{G}/diff/{R11}/{R12}"}),
  rres(5,f"plastic://graph/{G}/diff/{R11}/{R12}",{"fromRevision":R11,"toRevision":R12,"namespaces":["code"],"layoutOnly":False,"privilegeDelta":[],"changes":[{"kind":"code.changed","nodeId":"normalize","hunks":[{"oldStart":1,"oldLines":1,"newStart":1,"newLines":2,"text":"-edges.out = { ...value, email: String(value.email).trim().toLowerCase() };\n+var e = String(value.email).trim().toLowerCase();\n+edges.out = { ...value, email: e.replace(/\\.$/, '') };"}]}]})))
# 6 proposal.create
calls.append(("proposal.create", req(6,"tools/call",{"name":"proposal.create","arguments":{"schemaVersion":1,"graphId":G,"baseRevision":R12,"ops":[{"op":"set-node-code","nodeId":"normalize","template":"set","text":"edges.out = { ...value, email: String(value.email).trim().toLowerCase() };\n"}],"description":"Stop stripping a trailing dot from emails","rationale":"rev12 (diff rev11..rev12) added e.replace(/\\.$/, ''), which turns 'a.b@example.com.' style inputs AND valid addresses ending in a dot-domain into values that fail validate's pattern; the journey account-settings-change has failed on every run since rev12.","idempotencyKey":"01J8ZK5K0B1C2D3E4F5G6H7J8K"}}),
  tres(6,{"envelope":env("01J8ZK5M0B1C2D3E4F5G6H7J8K",CORR,baseRevision=R12,resultRevision=R12),"result":{"proposalId":"01J8ZK5N0B1C2D3E4F5G6H7J8K","proposalDigest":"sha256:"+"b"*64,"state":"validated","validation":{"ok":True,"errors":[]},"impact":{"consumers":[],"downstream":["validate"],"privilegeDelta":[],"testsToRun":["contract:validate","journey:account-settings-change"],"oracleChanged":False},"requiredDecisions":["approve"],"diffSummary":{"fromRevision":R12,"toRevision":R12,"namespaces":["code"],"layoutOnly":False,"privilegeDelta":[],"changes":[{"kind":"code.changed","nodeId":"normalize","hunks":[{"oldStart":1,"oldLines":2,"newStart":1,"newLines":1,"text":"-var e = String(value.email).trim().toLowerCase();\n-edges.out = { ...value, email: e.replace(/\\.$/, '') };\n+edges.out = { ...value, email: String(value.email).trim().toLowerCase() };"}]}]}}})))
# 7 tests.run -> task -> tasks/get
calls.append(("tests.run (task)", req(7,"tools/call",{"name":"tests.run","arguments":{"schemaVersion":1,"target":{"proposalId":"01J8ZK5N0B1C2D3E4F5G6H7J8K"},"selection":["journey:account-settings-change","contract"]}}),
  {"jsonrpc":"2.0","id":7,"result":{"resultType":"task","task":{"taskId":"01J8ZK5P0B1C2D3E4F5G6H7J8K","status":"working","ttlMs":86400000,"pollIntervalMs":2000}}}))
calls.append(("tasks/get", req(8,"tasks/get",{"taskId":"01J8ZK5P0B1C2D3E4F5G6H7J8K"}),
  {"jsonrpc":"2.0","id":8,"result":{"resultType":"complete","task":{"taskId":"01J8ZK5P0B1C2D3E4F5G6H7J8K","status":"completed","ttlMs":86400000,"pollIntervalMs":2000},"result":{"resultType":"complete","content":[{"type":"text","text":"2 passed"}],"structuredContent":{"envelope":env("01J8ZK5Q0B1C2D3E4F5G6H7J8K",CORR),"result":{"results":[{"testId":"journey:account-settings-change","kind":"journey","status":"pass","durationMs":840,"observationsUri":f"plastic://graph/{G}/observations?correlationId=01J8ZK5R0B1C2D3E4F5G6H7J8K"},{"testId":"contract:validate","kind":"contract","status":"pass","durationMs":35,"seed":"1758400000"}],"revisionBound":{"revisionId":R12,"runtime":"ts-2.1.0"},"coverage":{"nodesExercised":4,"nodesTotal":14,"portsValidated":6},"summary":{"pass":2,"fail":0,"error":0,"skipped":0}}}}}}))
# 8 human approves in the editor (not an MCP call) then agent commits + activates
calls.append(("proposal.commit", req(9,"tools/call",{"name":"proposal.commit","arguments":{"schemaVersion":1,"proposalId":"01J8ZK5N0B1C2D3E4F5G6H7J8K","proposalDigest":"sha256:"+"b"*64,"baseRevision":R12}}),
  tres(9,{"envelope":env("01J8ZK5S0B1C2D3E4F5G6H7J8K",CORR,baseRevision=R12,resultRevision=R13),"result":{"resultRevision":R13,"mutationId":"01J8ZK5T0B1C2D3E4F5G6H7J8K","state":"committed"}})))
calls.append(("revision.activate (task)", req(10,"tools/call",{"name":"revision.activate","arguments":{"schemaVersion":1,"graphId":G,"revisionId":R13,"strategy":"switch-new-work"}}),
  {"jsonrpc":"2.0","id":10,"result":{"resultType":"task","task":{"taskId":"01J8ZK5V0B1C2D3E4F5G6H7J8K","status":"working","ttlMs":86400000,"pollIntervalMs":2000}}}))
# ---------- write fixtures + markdown ----------
for name,o in [("rate-limiter.graph.json",rl_graph),("rate-limiter.manifest.json",manifest),("api-graph.instance.json",api_graph),("diff.rename.json",diff_rename),("diff.upgrade.json",diff_upgrade)]:
    json.dump(o,open(f"{F}/{name}","w"),indent=1)
json.dump({"calls":[{"title":t,"request":r,"response":s} for t,r,s in calls]},open(f"{F}/traversal.calls.json","w"),indent=1)
def size(o): return len(json.dumps(o,separators=(',',':')).encode())
rows=[]; total=0
for t,r,s in calls:
    b=size(s); total+=b; rows.append(f"| {t} | {size(r)} | {b} | ~{round(b/4)} |")
md=[]
md.append("# A7. Component fixtures, semantic diffs and the exact agent traversal\n")
md.append("All JSON in this appendix is generated by a script and validated: the graph fixtures against `schemas/fixtures/graph.schema.json` (the editor's current node/graph shape as written by `packages/Graph/mutation.ts:724-771`, `connectors.ts:53-83`, `Input/mouse.ts:233-257`, `mutation.ts:182-288`, plus the proposed additive keys `placement`, `component`, `capabilities`, `contract`, `budgets`, `meta.schemaVersion`), the diffs against `diffSummary`, and every traversal call against the tool input/output schemas of appendix A6. Machine-readable copies are in `schemas/fixtures/`.\n")
md.append("## A7.1 Published definition: `RateLimiter` source graph (schemaVersion 2)\n")
md.append("Two nodes. `window` is server-placed and declares the `storage:kv` requirement; its code uses the proposed `host.kv` binding and returns a promise (no top-level `await`, which meriyah 1.9.15 rejects, RT-05). `decide` is portable. The inner `count` edge has one connector (`c-rl-1`); the external outputs have empty connector lists that the consumer's host connectors are spliced into at flatten time (`linkInnerNodeEdges`, RT-12 / `loadAndIntegrateLinkedGraphsWithFields`, GE-47).\n")
md.append("```json\n"+json.dumps(rl_graph,indent=1)+"\n```\n")
md.append(f"## A7.2 `ComponentManifest` for `RateLimiter@1`\n\n`digest` = `{rl_digest}` = sha256 over the canonical JSON of the graph above (sorted keys, no whitespace; production uses RFC 8785 JCS, which agrees with this for these values).\n")
md.append("```json\n"+json.dumps(manifest,indent=1)+"\n```\n")
md.append("## A7.3 Instance: `api-graph` embedding `RateLimiter@1`\n")
md.append("Node `N` is exactly what `addGraphItem` writes today (`artifact` string, whole graph embedded under `linkedGraph.graph`, `fields.inputs/outputs` maps, mirrored host ports) plus the proposed `properties.component` pin and the instance grant. Connectors: `c-api-1` (`http.out → N.key`), `c-api-2` (`N.allowed → handler.in`), `c-api-3` (`N.retryAfterMs → reject.retryAfterMs`). At admission the server checks `sha256(canonical(N.linkedGraph.graph)) === N.properties.component.digest`.\n")
md.append("```json\n"+json.dumps(api_graph,indent=1)+"\n```\n")
md.append("Lifecycle on this fixture (all via the tools of A6): publish `RateLimiter@1` (`component.publish` valid example) → import into `api-graph` → `proposal.commit` → `revision.activate` → `graph.invoke {entry:{nodeUrl:'api'}, field:'in', value:{key:'u1'}}` ×6 → observations show five `allowed:true` deliveries on `c-api-2` and one `retryAfterMs` delivery on `c-api-3`, each with `instancePath:['N']` for the nested spans → upgrade proposal = `diff.upgrade.json` below → rollback = `revision.rollback` valid example, whose residual-drift report lists the `ratelimit/u1/*` keys written under the rolled-back revision.\n")
md.append("## A7.4 Semantic diff examples (`diffSummary`)\n\nRename `validate.out → ok` (trace §6.1):\n```json\n"+json.dumps(diff_rename,indent=1)+"\n```\n\nUpgrade `N` from `RateLimiter@1` to `@2` where `retryAfterMs` becomes required (trace §6.5 step 4; `port.changed` on a nested output is what the validator checks against downstream contracts):\n```json\n"+json.dumps(diff_upgrade,indent=1)+"\n```\n")
md.append("## A7.5 Exact agent traversal (§6.7) as JSON-RPC over Streamable HTTP\n\nEvery request is one `POST /mcp` with headers `MCP-Protocol-Version: 2026-07-28`, `Mcp-Method: <method>`, `Mcp-Name: <tool or uri>` and `Authorization: Bearer <agent token>`; `_meta` is shown once per request as the spec requires. Byte sizes are measured on the compact JSON of these exact documents; tokens assume 4 bytes/token.\n\n| call | request bytes | response bytes | ≈ tokens |\n|---|---|---|---|\n"+"\n".join(rows)+f"\n| **total** | | **{total}** | **~{round(total/4)}** |\n\nDeferred on purpose: the full graph projection (14 nodes, ~80 KB), code of the 12 untouched nodes, full observation payloads (the email value is hash-redacted even for this agent), the browser-side spans. Between calls 8 and 9 a human approved the proposal in the editor (`proposal.decide` is not available to this agent on this graph: `requiredDecisions:[\"approve\"]`).\n")
for t,r,s in calls:
    md.append(f"### {t}\nRequest:\n```json\n{json.dumps(r,indent=1)}\n```\nResponse:\n```json\n{json.dumps(s,indent=1)}\n```\n")
open(f"{P}/appendix/A7-component-fixtures-and-traversal.md","w").write("\n".join(md))
print("fixtures written; total response bytes", total)
