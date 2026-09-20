import json, os
P=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))   # plan directory
S=f'{P}/schemas/mcp'; E=f'{P}/schemas/examples'
ID={"type":"string","pattern":"^[A-Za-z0-9_.-]{1,64}$"}
ULID={"type":"string","pattern":"^[0-9A-HJKMNP-TV-Z]{26}$"}
REV={"type":"string","pattern":"^rev_[0-9A-HJKMNP-TV-Z]{26}$"}
DIGEST={"type":"string","pattern":"^sha256:[0-9a-f]{64}$"}
def obj(props, req=None, **kw):
    d={"type":"object","additionalProperties":False,"properties":props}
    if req: d["required"]=req
    d.update(kw); return d
def ref(n): return {"$ref":f"#/$defs/{n}"}
def arr(items, mx): return {"type":"array","maxItems":mx,"items":items}
CAPKINDS=["net:https","storage:kv","storage:s3","secret","timer","browser:dom","browser:storage","aws:cfn","aws:codebuild","llm","graph:invoke"]
DEFS={}
DEFS["ulid"]=ULID; DEFS["id"]=ID; DEFS["revisionId"]=REV; DEFS["digest"]=DIGEST
DEFS["principal"]=obj({"sub":{"type":"string","maxLength":256},"kind":{"enum":["human","agent","system","synthetic"]},"tenant":{"type":"string","maxLength":128},"delegatedBy":{"type":"string","maxLength":256}},["sub","kind","tenant"])
DEFS["envelope"]=obj({"schemaVersion":{"const":"1"},"requestId":ref("ulid"),"principal":ref("principal"),"graphId":ref("id"),"baseRevision":ref("revisionId"),"resultRevision":ref("revisionId"),"correlationId":ref("ulid"),"policyVersion":{"type":"string","maxLength":32},"serverTime":{"type":"string","format":"date-time"},"truncated":{"type":"boolean"}},["schemaVersion","requestId","principal","correlationId","policyVersion","serverTime","truncated"])
DEFS["error"]=obj({"code":{"enum":["ADMISSION_DENIED","STALE_BASE","SCHEMA_INVALID","CAPABILITY_MISSING","NOT_FOUND","CONFLICT","BUDGET_EXCEEDED","APPROVAL_REQUIRED","UNSUPPORTED_FIELD","RATE_LIMITED","INTEGRITY_FAILURE","UNRESOLVED_COMPONENT"]},"message":{"type":"string","maxLength":2000},"retry":obj({"retryable":{"type":"boolean"},"afterMs":{"type":"integer","minimum":0,"maximum":3600000},"rebaseTo":ref("revisionId")},["retryable"]),"details":{"type":"object"}},["code","message","retry"])
DEFS["budget"]=obj({"wallMs":{"type":"integer","minimum":1,"maximum":900000},"cpuMs":{"type":"integer","minimum":1,"maximum":900000},"heapMb":{"type":"integer","minimum":8,"maximum":1024},"hops":{"type":"integer","minimum":1,"maximum":1000000},"fanOut":{"type":"integer","minimum":1,"maximum":100000},"depth":{"type":"integer","minimum":1,"maximum":256},"observations":{"type":"integer","minimum":1,"maximum":1000000},"observationBytes":{"type":"integer","minimum":1024,"maximum":268435456},"payloadBytes":{"type":"integer","minimum":1,"maximum":6291456},"concurrentChildren":{"type":"integer","minimum":1,"maximum":1024}})
DEFS["portContract"]=obj({"name":ref("id"),"schema":{"type":"object"},"required":{"type":"boolean"},"default":{},"redaction":{"enum":["none","hash","secret"]},"capture":{"enum":["none","meta","full"]}},["name","schema","required"])
DEFS["capabilityRequirement"]=obj({"kind":{"enum":CAPKINDS},"scope":arr({"type":"string","maxLength":256},64),"optional":{"type":"boolean"}},["kind","scope"])
DEFS["capabilityGrant"]=obj({"kind":{"enum":CAPKINDS},"scope":arr({"type":"string","maxLength":256},64),"operations":arr({"type":"string","maxLength":64},32),"lifetime":obj({"until":{"type":"string","format":"date-time"},"revisionBound":ref("revisionId")}),"delegable":{"type":"boolean"}},["kind","scope","operations"])
DEFS["componentPin"]=obj({"publishedId":ref("id"),"version":{"type":"integer","minimum":0},"digest":ref("digest")},["publishedId","version","digest"])
DEFS["placement"]={"enum":["browser","server","portable"]}
DEFS["health"]=obj({"lastRunAt":{"type":"string","format":"date-time"},"errorRate24h":{"type":"number","minimum":0,"maximum":1},"p95Ms":{"type":"integer","minimum":0},"lastFailure":obj({"observationId":ref("ulid"),"kind":{"type":"string"},"at":{"type":"string","format":"date-time"}})})
DEFS["componentSummary"]=obj({"id":ref("id"),"graphId":ref("id"),"revisionId":ref("revisionId"),"kind":{"enum":["graph","node","published-component"]},"name":{"type":"string","maxLength":128},"purpose":{"type":"string","maxLength":2000},"intentProvenance":{"enum":["authored","generated","derived"]},"freshness":obj({"computedAt":{"type":"string","format":"date-time"},"sourceRevision":ref("revisionId"),"stale":{"type":"boolean"}},["computedAt","sourceRevision","stale"]),"inputs":arr(ref("portContract"),64),"outputs":arr(ref("portContract"),64),"invariants":arr({"type":"string","maxLength":500},32),"dependencies":arr(ref("componentPin"),128),"effects":arr(ref("capabilityRequirement"),32),"placement":ref("placement"),"health":ref("health"),"pointers":obj({"node":{"type":"string"},"code":{"type":"string"},"observations":{"type":"string"},"tests":{"type":"string"}}),"degree":obj({"in":{"type":"integer","minimum":0},"out":{"type":"integer","minimum":0},"nestedNodes":{"type":"integer","minimum":0}},["in","out"]),"untrusted":arr({"enum":["purpose","invariants","name"]},3)},["id","graphId","revisionId","kind","name","purpose","intentProvenance","freshness","inputs","outputs","placement","degree"])
DEFS["observationKind"]={"enum":["edge.input","edge.output","route","exec.begin","exec.end","exec.error","effect","effect.denied","budget.exhausted","contract.violation","component.unresolved","deploy.status","test.result","summary.generated","custom"]}
DEFS["observation"]=obj({"id":ref("ulid"),"seq":{"type":"integer","minimum":0},"at":{"type":"string","format":"date-time"},"kind":ref("observationKind"),"graphId":ref("id"),"revisionId":ref("revisionId"),"instancePath":arr(ref("id"),64),"nodeId":ref("id"),"edgeField":ref("id"),"connectorId":ref("id"),"executionId":ref("ulid"),"spanId":ref("ulid"),"parentSpanId":ref("ulid"),"correlationId":ref("ulid"),"causationId":ref("ulid"),"domain":{"enum":["browser","server"]},"owner":ref("principal"),"actor":ref("principal"),"payload":{},"capability":obj({"kind":{"enum":CAPKINDS},"scope":arr({"type":"string"},64),"decision":{"enum":["allowed","denied"]}},["kind","scope","decision"]),"budget":obj({"dimension":{"type":"string"},"used":{"type":"number"},"limit":{"type":"number"}},["dimension","used","limit"])},["id","seq","at","kind","graphId","revisionId","instancePath","executionId","spanId","correlationId","domain","owner"])
DEFS["diffChange"]=obj({"kind":{"enum":["node.added","node.removed","node.renamed","port.added","port.removed","port.changed","edge.added","edge.removed","connector.added","connector.removed","code.changed","component.pin.changed","placement.changed","capability.added","capability.removed","budget.changed","test.changed","iac.desired.changed","layout.changed","graph.props.changed"]},"nodeId":ref("id"),"field":ref("id"),"connectorId":ref("id"),"before":{},"after":{},"hunks":arr(obj({"oldStart":{"type":"integer"},"oldLines":{"type":"integer"},"newStart":{"type":"integer"},"newLines":{"type":"integer"},"text":{"type":"string","maxLength":65536}},["oldStart","oldLines","newStart","newLines","text"]),200),"privilege":{"enum":["none","widens","narrows"]}},["kind"])
DEFS["diffSummary"]=obj({"fromRevision":ref("revisionId"),"toRevision":ref("revisionId"),"namespaces":arr({"enum":["definition","layout","code","capabilities","placement","budgets","tests","iac","policy"]},9),"changes":arr(ref("diffChange"),5000),"privilegeDelta":arr(ref("capabilityRequirement"),100),"layoutOnly":{"type":"boolean"}},["namespaces","changes","privilegeDelta","layoutOnly"])
DEFS["artifactRef"]=obj({"graphId":ref("id"),"nodeId":ref("id"),"revisionId":ref("revisionId"),"sha256":{"type":"string","pattern":"^[0-9a-f]{64}$"}},["graphId","nodeId","revisionId","sha256"])
DEFS["iacDesiredState"]=obj({"schemaVersion":{"const":1},"stack":obj({"name":{"type":"string","pattern":"^[A-Za-z][A-Za-z0-9-]{0,127}$"},"account":{"type":"string","pattern":"^[0-9]{12}$"},"region":{"type":"string","pattern":"^[a-z]{2}-[a-z]+-[0-9]$"},"environment":{"enum":["dev","staging","prod"]}},["name","account","region","environment"]),"template":obj({"artifactRef":ref("artifactRef"),"format":{"enum":["yaml","json"]}},["artifactRef","format"]),"parameters":{"type":"object","maxProperties":200,"additionalProperties":{"oneOf":[{"type":"string","maxLength":4096},obj({"secretRef":{"type":"string","maxLength":512}},["secretRef"])]}},"capabilities":arr({"enum":["CAPABILITY_IAM","CAPABILITY_NAMED_IAM","CAPABILITY_AUTO_EXPAND"]},3),"operation":{"enum":["plan","apply","destroy","cancel","detect-drift"]},"trigger":{"oneOf":[obj({"kind":{"const":"explicit"},"approvalRef":ref("ulid")},["kind"]),obj({"kind":{"const":"reconcile"},"sourceRevision":ref("revisionId")},["kind","sourceRevision"])]},"build":obj({"project":{"type":"string","maxLength":128},"sourceArtifactRef":ref("artifactRef"),"buildspecArtifactRef":ref("artifactRef")},["project","sourceArtifactRef","buildspecArtifactRef"]),"correlation":obj({"proposalId":ref("ulid"),"idempotencyKey":ref("ulid")},["idempotencyKey"])},["schemaVersion","stack","template","parameters","capabilities","operation","trigger","correlation"])
DEFS["task"]=obj({"taskId":ref("ulid"),"status":{"enum":["working","input_required","completed","failed","cancelled"]},"ttlMs":{"type":"integer"},"pollIntervalMs":{"type":"integer"},"statusMessage":{"type":"string","maxLength":500}},["taskId","status","ttlMs","pollIntervalMs"])
NODEINIT=obj({"id":ref("id"),"url":ref("id"),"name":{"type":"string","maxLength":128},"inputs":arr(ref("portContract"),64),"outputs":arr(ref("portContract"),64),"placement":ref("placement"),"template":obj({"set":{"type":"string","maxLength":262144},"vue":{"type":"string","maxLength":262144}}),"layout":obj({"x":{"type":"number"},"y":{"type":"number"},"z":{"type":"number"}})},["id","url"])
DEFS["mutationOp"]={"oneOf":[
 obj({"op":{"const":"add-node"},"node":NODEINIT},["op","node"]),
 obj({"op":{"const":"remove-node"},"nodeId":ref("id")},["op","nodeId"]),
 obj({"op":{"const":"set-node-code"},"nodeId":ref("id"),"template":{"enum":["set","vue"]},"text":{"type":"string","maxLength":262144}},["op","nodeId","template","text"]),
 obj({"op":{"const":"set-node-props"},"nodeId":ref("id"),"patch":{"type":"object","maxProperties":64}},["op","nodeId","patch"]),
 obj({"op":{"const":"set-graph-props"},"patch":{"type":"object","maxProperties":64}},["op","patch"]),
 obj({"op":{"const":"connect"},"from":obj({"nodeId":ref("id"),"field":ref("id")},["nodeId","field"]),"to":obj({"nodeId":ref("id"),"field":ref("id"),"graphId":ref("id")},["nodeId","field"])},["op","from","to"]),
 obj({"op":{"const":"disconnect"},"connectorId":ref("id")},["op","connectorId"]),
 obj({"op":{"const":"set-component-pin"},"nodeId":ref("id"),"pin":ref("componentPin")},["op","nodeId","pin"]),
 obj({"op":{"const":"set-capabilities"},"nodeId":ref("id"),"granted":arr(ref("capabilityGrant"),32)},["op","nodeId","granted"]),
 obj({"op":{"const":"set-placement"},"nodeId":ref("id"),"placement":ref("placement")},["op","nodeId","placement"]),
 obj({"op":{"const":"set-budget"},"nodeId":ref("id"),"budget":ref("budget")},["op","budget"]),
 obj({"op":{"const":"set-iac-desired"},"nodeId":ref("id"),"desired":ref("iacDesiredState")},["op","nodeId","desired"]),
]}
def OUT(result): return obj({"envelope":ref("envelope"),"result":result},["envelope","result"])
def schema(title, body):
    d={"$schema":"https://json-schema.org/draft/2020-12/schema","$id":f"https://plastic-io.github.io/schemas/mcp/{title}.json","title":title}
    d.update(body); d["$defs"]=DEFS; return d
SV={"const":1}
TOOLS={}
def tool(name, inp_props, inp_req, result, perm, idem, effects, cancel, mapping, valid, rejected, rejected_why, task=False):
    TOOLS[name]=dict(input=schema(f"{name}.input",obj(inp_props,inp_req)),output=schema(f"{name}.output",OUT(result)),perm=perm,idem=idem,effects=effects,cancel=cancel,mapping=mapping,valid=valid,rejected=rejected,rejected_why=rejected_why,task=task)
G="7ba47581-fb4e-4ee3-a200-80fcb6d83fe6"; R="rev_01J8ZK3Q4W5X6Y7Z8A9B0C1D2E"; PID="01J8ZK6M0N1P2Q3R4S5T6V7W8X"
tool("graph.summary",
  {"schemaVersion":SV,"graphId":ref("id"),"revisionId":ref("revisionId"),"nodeId":ref("id"),"include":arr({"enum":["contract","capabilities","health","deps"]},4)},
  ["schemaVersion","graphId"], ref("componentSummary"),
  "graph:read","idempotent read","none","n/a (fast)","src/mcp/tools/read/summary.ts -> summaryService.summarize(graphId, revisionId|HEAD, nodeId?)",
  {"schemaVersion":1,"graphId":G,"nodeId":"validate","include":["contract","health"]},
  {"schemaVersion":1,"graphId":G,"nodeId":"validate","code":True},
  "`code` is not a field -> -32602 (schema); use `plastic://.../node/{id}?expand=code` with graph:inspect-internals")
tool("component.search",
  {"schemaVersion":SV,"query":{"type":"string","minLength":1,"maxLength":200},"tags":arr({"type":"string","maxLength":64},16),"capability":{"enum":CAPKINDS},"placement":ref("placement"),"limit":{"type":"integer","minimum":1,"maximum":50},"cursor":{"type":"string","maxLength":4096}},
  ["schemaVersion","query"],
  obj({"components":arr(obj({"publishedId":ref("id"),"version":{"type":"integer"},"digest":ref("digest"),"name":{"type":"string"},"purpose":{"type":"string","maxLength":2000},"placement":ref("placement"),"capabilities":arr(ref("capabilityRequirement"),32),"deprecated":{"type":"boolean"},"consumers":{"type":"integer"}},["publishedId","version","digest","name","placement","capabilities"]),50),"nextCursor":{"type":"string"}},["components"]),
  "registry:read","idempotent read","none","n/a","src/mcp/tools/read/search.ts -> componentIndex.search()",
  {"schemaVersion":1,"query":"rate limit","placement":"server","limit":10},
  {"schemaVersion":1,"query":"x"*201},
  "`query` exceeds maxLength 200 -> -32602")
tool("observations.query",
  {"schemaVersion":SV,"graphId":ref("id"),"filter":obj({"nodeId":ref("id"),"edgeField":ref("id"),"kind":ref("observationKind"),"executionId":ref("ulid"),"correlationId":ref("ulid"),"since":{"type":"string","format":"date-time"},"until":{"type":"string","format":"date-time"},"sinceId":ref("ulid")}),"limit":{"type":"integer","minimum":1,"maximum":500},"cursor":{"type":"string","maxLength":4096}},
  ["schemaVersion","graphId"],
  obj({"observations":arr(ref("observation"),500),"nextCursor":{"type":"string"},"redactedCount":{"type":"integer"}},["observations","redactedCount"]),
  "graph:observe (+graph:inspect-payloads for full payloads)","idempotent read","none","n/a","src/mcp/tools/read/observations.ts -> observationStore.query() + redact()",
  {"schemaVersion":1,"graphId":G,"filter":{"correlationId":"01J8ZK5A0B1C2D3E4F5G6H7J8K","kind":"exec.error"},"limit":20},
  {"schemaVersion":1,"graphId":G,"limit":5000},
  "`limit` above 500 -> -32602; large ranges must page with `cursor`")
tool("proposal.validate",
  {"schemaVersion":SV,"proposalId":ref("ulid"),"rebase":{"type":"boolean","default":False}},
  ["schemaVersion","proposalId"],
  obj({"proposalId":ref("ulid"),"proposalDigest":ref("digest"),"baseRevision":ref("revisionId"),"state":{"enum":["validated","awaiting-review","stale","rejected"]},"validation":obj({"ok":{"type":"boolean"},"errors":arr(obj({"code":{"type":"string"},"message":{"type":"string","maxLength":1000},"nodeId":ref("id"),"field":ref("id")},["code","message"]),100)},["ok"]),"conflicts":arr(obj({"nodeId":ref("id"),"template":{"enum":["set","vue"]},"ours":{"type":"string","maxLength":65536},"theirs":{"type":"string","maxLength":65536}},["nodeId","template"]),100),"impact":ref("diffSummary")},["proposalId","proposalDigest","baseRevision","state","validation"]),
  "graph:propose (proposer) or graph:approve","idempotent; `rebase:true` rewrites the proposal (new digest)","proposal document updated; audit `proposal.validated`","n/a","src/mcp/tools/proposal.ts -> proposals.validate()",
  {"schemaVersion":1,"proposalId":PID,"rebase":True},
  {"schemaVersion":1,"proposalId":"p1"},
  "`proposalId` is not a ULID -> -32602; handles are opaque server-minted ids")
tool("proposal.simulate",
  {"schemaVersion":SV,"proposalId":ref("ulid"),"mode":{"enum":["structural","shadow","replay"]},"executionSample":obj({"sinceMinutes":{"type":"integer","minimum":1,"maximum":1440},"max":{"type":"integer","minimum":1,"maximum":50}}),"budget":ref("budget")},
  ["schemaVersion","proposalId","mode"],
  obj({"proposalId":ref("ulid"),"mode":{"enum":["structural","shadow","replay"]},"comparisons":arr(obj({"executionId":ref("ulid"),"port":ref("id"),"verdict":{"enum":["equal","schema-equal","diff","unavailable"]},"detail":{"type":"string","maxLength":2000}},["executionId","port","verdict"]),500),"unsimulatedEffects":arr(ref("capabilityRequirement"),100),"coverage":obj({"executionsSampled":{"type":"integer"},"nodesExercised":{"type":"integer"},"nodesTotal":{"type":"integer"}},["executionsSampled","nodesExercised","nodesTotal"]),"safe":{"type":"boolean"}},["proposalId","mode","comparisons","unsimulatedEffects","coverage","safe"]),
  "graph:simulate","idempotent per (proposalDigest, mode, sample): cached result returned","sim-mode effects only (isolated prefixes, recorded responses); never aws:* apply","tasks/cancel -> cooperative token","src/mcp/tools/proposal.ts -> simulation.run() (task)",
  {"schemaVersion":1,"proposalId":PID,"mode":"shadow","executionSample":{"sinceMinutes":60,"max":10}},
  {"schemaVersion":1,"proposalId":PID,"mode":"live"},
  "`mode:'live'` is not allowed -> -32602; there is no way to request real effects from simulation", task=True)
tool("proposal.decide",
  {"schemaVersion":SV,"proposalId":ref("ulid"),"decision":{"enum":["approve","reject"]},"proposalDigest":ref("digest"),"rationale":{"type":"string","maxLength":2000}},
  ["schemaVersion","proposalId","decision","proposalDigest"],
  obj({"proposalId":ref("ulid"),"state":{"enum":["approved","rejected","awaiting-review"]},"decisions":arr(obj({"by":ref("principal"),"decision":{"enum":["approve","reject"]},"digest":ref("digest"),"policyVersion":{"type":"string"},"at":{"type":"string","format":"date-time"}},["by","decision","digest","policyVersion","at"]),16),"remainingDecisions":arr({"enum":["approve","iac-approve","privileged-connect"]},8)},["proposalId","state","decisions","remainingDecisions"]),
  "graph:approve (self-approval only if policy `selfApprove`)","idempotent per (proposalId, digest, decision, principal)","proposal document; audit `proposal.decided`","n/a","src/mcp/tools/proposal.ts -> proposals.decide()",
  {"schemaVersion":1,"proposalId":PID,"decision":"approve","proposalDigest":"sha256:"+"ab"*32,"rationale":"Diff limited to normalize; journey passes in shadow."},
  {"schemaVersion":1,"proposalId":PID,"decision":"approve","proposalDigest":"sha256:"+"cd"*32},
  "digest does not match the stored proposal -> isError APPROVAL_REQUIRED with details.expectedDigest (approval binds to exact content); also ADMISSION_DENIED when the caller is the proposer without selfApprove")
tool("revision.rollback",
  {"schemaVersion":SV,"graphId":ref("id"),"toRevision":ref("revisionId"),"scope":{"type":"array","minItems":1,"maxItems":3,"uniqueItems":True,"items":{"enum":["definition","activation","infra"]}},"compensation":{"enum":["none","run-compensators"],"default":"none"},"rationale":{"type":"string","maxLength":2000}},
  ["schemaVersion","graphId","toRevision","scope"],
  obj({"graphId":ref("id"),"toRevision":ref("revisionId"),"newRevision":ref("revisionId"),"activeRevision":ref("revisionId"),"residualDrift":arr(obj({"kind":{"enum":["storage:kv","storage:s3","aws:cfn","external"]},"scope":{"type":"string","maxLength":512},"detail":{"type":"string","maxLength":2000}},["kind","scope"]),500),"irreversibleEffects":arr(obj({"executionId":ref("ulid"),"nodeId":ref("id"),"capability":{"enum":CAPKINDS},"at":{"type":"string","format":"date-time"}},["executionId","nodeId","capability","at"]),500),"compensatorsRun":arr(obj({"componentId":ref("id"),"result":{"enum":["ok","failed","skipped"]}},["componentId","result"]),100),"manualReview":{"type":"boolean"}},["graphId","toRevision","residualDrift","irreversibleEffects","manualReview"]),
  "graph:rollback (+iac:approve when scope includes infra)","idempotent per (graphId,toRevision,scope)","new revision (definition), active pointer (activation), IaC plan/apply (infra); audit `revision.rolledBack`","tasks/cancel stops compensators between steps; an IaC apply already started follows iac.cancel semantics","src/mcp/tools/revision.ts -> revisions.rollback() (task)",
  {"schemaVersion":1,"graphId":G,"toRevision":R,"scope":["definition","activation"],"compensation":"none","rationale":"rev6 regressed journey rate-limit-basic"},
  {"schemaVersion":1,"graphId":G,"toRevision":R,"scope":[]},
  "empty `scope` -> -32602; a rollback must name the layers it touches so partial rollback is explicit", task=True)
tool("component.publish",
  {"schemaVersion":SV,"graphId":ref("id"),"revisionId":ref("revisionId"),"target":{"oneOf":[obj({"nodeId":ref("id")},["nodeId"]),obj({"graph":{"const":True}},["graph"])]},"version":{"oneOf":[{"const":"next"},{"type":"integer","minimum":0}]},"contract":obj({"inputs":arr(ref("portContract"),64),"outputs":arr(ref("portContract"),64),"errors":{"type":"object"}},["inputs","outputs"]),"summary":obj({"intent":{"type":"string","minLength":1,"maxLength":2000},"invariants":arr({"type":"string","maxLength":500},32)},["intent"]),"tests":arr(obj({"kind":{"enum":["contract","invariant","property","fixture"]},"id":ref("id"),"artifactRef":ref("artifactRef")},["kind","id","artifactRef"]),64),"capabilities":arr(ref("capabilityRequirement"),32),"placement":ref("placement"),"budgets":ref("budget")},
  ["schemaVersion","graphId","revisionId","target","version","contract","summary","capabilities","placement"],
  obj({"publishedId":ref("id"),"version":{"type":"integer"},"digest":ref("digest"),"manifestUri":{"type":"string"},"consumersAffected":{"type":"integer"},"warnings":arr({"type":"string","maxLength":500},50)},["publishedId","version","digest","manifestUri","consumersAffected"]),
  "component:publish","idempotent when the same content is republished at the same version (same digest -> same result); different content -> CONFLICT","immutable objects components/<id>/<version>/{artifact,manifest}.json, TOC entry; audit `component.published`","n/a","src/mcp/tools/component.ts -> components.publish() (replaces eventSourceService.ts:376-538 paths)",
  {"schemaVersion":1,"graphId":"rl-graph","revisionId":R,"target":{"graph":True},"version":"next","contract":{"inputs":[{"name":"key","schema":{"type":"string","maxLength":256},"required":True},{"name":"cost","schema":{"type":"integer","minimum":1},"required":False,"default":1}],"outputs":[{"name":"allowed","schema":{"type":"boolean"},"required":True},{"name":"retryAfterMs","schema":{"type":"integer","minimum":0},"required":False}]},"summary":{"intent":"Sliding-window rate limiter keyed by caller","invariants":["allowed === false implies retryAfterMs > 0"]},"capabilities":[{"kind":"storage:kv","scope":["ratelimit/*"]}],"placement":"server"},
  {"schemaVersion":1,"graphId":"rl-graph","revisionId":R,"target":{"graph":True},"version":1,"contract":{"inputs":[],"outputs":[]},"summary":{"intent":"x"},"capabilities":[{"kind":"storage:kv","scope":["ratelimit/*"]}],"placement":"server"},
  "schema-valid but rejected at the publication gate: version 1 already exists with a different digest -> isError CONFLICT; and the contract declares no ports while the source graph has external IO -> SCHEMA_INVALID details.contractMismatch")
tool("tests.run",
  {"schemaVersion":SV,"target":{"oneOf":[obj({"componentId":ref("id"),"version":{"type":"integer","minimum":0}},["componentId","version"]),obj({"graphId":ref("id"),"revisionId":ref("revisionId")},["graphId","revisionId"]),obj({"proposalId":ref("ulid")},["proposalId"])]},"selection":arr({"type":"string","pattern":"^(contract|invariant|property|fixture|journey:[A-Za-z0-9_.-]{1,64})$","maxLength":80},64),"mode":{"enum":["contract-stub","integrated"],"default":"integrated"},"budget":ref("budget")},
  ["schemaVersion","target"],
  obj({"results":arr(obj({"testId":{"type":"string","maxLength":128},"kind":{"type":"string"},"status":{"enum":["pass","fail","error","skipped","unresolvable"]},"durationMs":{"type":"integer"},"message":{"type":"string","maxLength":4000},"observationsUri":{"type":"string"},"seed":{"type":"string"}},["testId","kind","status","durationMs"]),500),"revisionBound":obj({"componentDigest":ref("digest"),"revisionId":ref("revisionId"),"runtime":{"type":"string"}}),"coverage":obj({"nodesExercised":{"type":"integer"},"nodesTotal":{"type":"integer"},"portsValidated":{"type":"integer"}},["nodesExercised","nodesTotal"]),"summary":obj({"pass":{"type":"integer"},"fail":{"type":"integer"},"error":{"type":"integer"},"skipped":{"type":"integer"}},["pass","fail","error","skipped"])},["results","coverage","summary"]),
  "graph:test","results cached per (componentDigest|revisionId|proposalDigest, testDigest, runtimeVersion)","sim-mode effects only; test results stored; audit `tests.run`","tasks/cancel -> token","src/mcp/tools/tests.ts -> testRunner.run() (task)",
  {"schemaVersion":1,"target":{"proposalId":PID},"selection":["journey:account-settings-change"]},
  {"schemaVersion":1,"target":{"proposalId":PID},"selection":["journey:*"]},
  "selection pattern rejects wildcards -> -32602; journeys are named so that a run is revision-bound and reproducible", task=True)
tool("iac.plan",
  {"schemaVersion":SV,"graphId":ref("id"),"instanceId":ref("id"),"desired":ref("iacDesiredState"),"idempotencyKey":ref("ulid")},
  ["schemaVersion","graphId","instanceId"],
  obj({"planRef":{"type":"string","maxLength":256},"changeSetId":{"type":"string","maxLength":512},"desiredRevision":ref("revisionId"),"validation":obj({"ok":{"type":"boolean"},"errors":arr(obj({"code":{"type":"string"},"message":{"type":"string","maxLength":2000},"path":{"type":"string","maxLength":512}},["code","message"]),100)},["ok"]),"changes":arr(obj({"logicalId":{"type":"string"},"type":{"type":"string"},"action":{"enum":["Add","Modify","Remove","Import","Dynamic"]},"replacement":{"enum":["True","False","Conditional"]},"scope":arr({"type":"string"},8)},["logicalId","type","action"]),1000),"destructive":{"type":"boolean"},"requiresApproval":{"type":"boolean"},"estimatedCostDelta":{"type":"number"}},["planRef","desiredRevision","validation","changes","destructive","requiresApproval"]),
  "iac:propose","idempotent per idempotencyKey (same change set reused while it exists)","CreateChangeSet in AWS (no execution); status document `planning`; audit `iac.plan`","tasks/cancel deletes the change set","src/mcp/tools/iac.ts -> iacService.plan() (task -> Step Functions)",
  {"schemaVersion":1,"graphId":"infra","instanceId":"stack-api","idempotencyKey":"01J8ZK7Q0R1S2T3V4W5X6Y7Z8A"},
  {"schemaVersion":1,"graphId":"infra","instanceId":"stack-api","desired":{"schemaVersion":1,"stack":{"name":"prod-core","account":"695527765921","region":"us-west-1","environment":"dev"},"template":{"artifactRef":{"graphId":"infra","nodeId":"tpl","revisionId":R,"sha256":"0"*64},"format":"yaml"},"parameters":{},"capabilities":["CAPABILITY_NAMED_IAM"],"operation":"apply","trigger":{"kind":"explicit"},"correlation":{"idempotencyKey":"01J8ZK7Q0R1S2T3V4W5X6Y7Z8A"}}},
  "schema-valid but rejected by the validator: stack name `prod-core` does not start with the dev environment's allowed prefix `pio-dev-` -> isError SCHEMA_INVALID details.path=stack.name; `operation:'apply'` on a plan call is ignored (plan never executes)", task=True)
tool("iac.cancel",
  {"schemaVersion":SV,"graphId":ref("id"),"instanceId":ref("id"),"operationId":ref("ulid"),"reason":{"type":"string","maxLength":1000}},
  ["schemaVersion","graphId","instanceId","operationId"],
  obj({"operationId":ref("ulid"),"accepted":{"type":"boolean"},"phase":{"enum":["planning","awaiting-review","building","executing","observing","terminal"]},"awsAction":{"enum":["DeleteChangeSet","StopBuild","CancelUpdateStack","none"]},"note":{"type":"string","maxLength":500}},["operationId","accepted","phase","awsAction","note"]),
  "iac:propose (own operation) or iac:approve","idempotent","may call DeleteChangeSet/StopBuild/CancelUpdateStack; audit `iac.cancelRequested`","n/a","src/mcp/tools/iac.ts -> iacService.cancel()",
  {"schemaVersion":1,"graphId":"infra","instanceId":"stack-api","operationId":"01J8ZK8A0B1C2D3E4F5G6H7J8K","reason":"wrong parameter value"},
  {"schemaVersion":1,"graphId":"infra","instanceId":"stack-api","operationId":"01J8ZK8A0B1C2D3E4F5G6H7J8K","force":True},
  "`force` is not a field -> -32602; there is no forced stop: the response `note` always states that AWS may still complete the operation")
tool("iac.status",
  {"schemaVersion":SV,"graphId":ref("id"),"instanceId":ref("id")},
  ["schemaVersion","graphId","instanceId"],
  obj({"instanceId":ref("id"),"stack":obj({"name":{"type":"string"},"account":{"type":"string"},"region":{"type":"string"},"environment":{"enum":["dev","staging","prod"]}},["name","account","region","environment"]),"requestedRevision":ref("revisionId"),"effectiveRevision":ref("revisionId"),"lifecycle":{"enum":["idle","requested","validating","planning","awaiting-review","building","executing","observing","succeeded","failed","rolled-back","rollback-failed","cancelled","superseded"]},"operation":obj({"operationId":ref("ulid"),"startedAt":{"type":"string","format":"date-time"},"stackStatus":{"type":"string"},"buildStatus":{"type":"string"},"stale":{"type":"boolean"}}),"outputs":{"type":"object","additionalProperties":{"type":"string"}},"drift":obj({"status":{"enum":["IN_SYNC","DRIFTED","UNKNOWN"]},"resources":arr({"type":"string"},500)}),"manualRecoveryRequired":{"type":"boolean"},"lock":obj({"held":{"type":"boolean"},"until":{"type":"string","format":"date-time"}}),"queued":arr(obj({"desiredRevision":ref("revisionId"),"state":{"enum":["superseded-pending","superseded"]}},["desiredRevision","state"]),20)},["instanceId","stack","lifecycle","manualRecoveryRequired"]),
  "iac:read-status","idempotent read","none","n/a","src/mcp/tools/iac.ts -> statusStore.read()",
  {"schemaVersion":1,"graphId":"infra","instanceId":"stack-api"},
  {"schemaVersion":1,"graphId":"infra","instanceId":"stack-api","includeLogs":True},
  "`includeLogs` is not a field -> -32602; logs are exposed only as `logRef` references, never bodies")
tool("execution.cancel",
  {"schemaVersion":SV,"executionId":ref("ulid"),"reason":{"type":"string","maxLength":1000}},
  ["schemaVersion","executionId"],
  obj({"executionId":ref("ulid"),"state":{"enum":["cancelling","cancelled","completed","failed","abandoned"]},"cooperativeStopMs":{"type":"integer"},"terminated":{"type":"boolean"}},["executionId","state","terminated"]),
  "graph:execute on the execution's graph","idempotent","cancellation token set; watchdog escalation; audit `execution.cancelled`","n/a","src/mcp/tools/execution.ts -> executions.cancel() (ExecutionHandle.cancel)",
  {"schemaVersion":1,"executionId":"01J8ZK9B0C1D2E3F4G5H6J7K8M","reason":"runaway fan-out"},
  {"schemaVersion":1,"executionId":"01J8ZK9B0C1D2E3F4G5H6J7K8M","kill":True},
  "`kill` is not a field -> -32602; escalation from cooperative to out-of-band termination is automatic and reported in `terminated`")
if os.environ.get("GEN_WRITE")=="1":
    for name,t in TOOLS.items():
        for k in ("input","output"):
            json.dump(t[k],open(f"{S}/{name}.{k}.json","w"),indent=1)
        json.dump(t["valid"],open(f"{E}/{name}.valid.json","w"),indent=1)
        json.dump(t["rejected"],open(f"{E}/{name}.rejected.json","w"),indent=1)
    json.dump({"$defs":DEFS},open(f"{S}/defs.json","w"),indent=1)
    md=["\n## Remaining tools: full schemas (machine-readable copies in `schemas/mcp/*.json`, examples in `schemas/examples/`)\n",
    "Each schema file embeds the shared `$defs` so it validates standalone. The six core tools above are unchanged. Task-returning tools (`proposal.simulate`, `revision.rollback`, `tests.run`, `iac.plan`) return `resultType:\"task\"` and the output schema below describes the terminal `tasks/get` result. Every valid example below was validated against its input schema with ajv; every rejected example either fails the schema (JSON-RPC -32602) or passes the schema and is refused by policy/validation (tool error with `isError:true`), as stated in each \"why rejected\" line.\n"]
    for name,t in TOOLS.items():
        md.append(f"\n### `{name}`{' (task)' if t['task'] else ''}\n")
        md.append(f"- **Permissions:** {t['perm']}\n- **Idempotency:** {t['idem']}\n- **Side effects:** {t['effects']}\n- **Cancellation:** {t['cancel']}\n- **Mapping:** {t['mapping']}\n\n")
        inp=dict(t["input"]); inp.pop("$defs",None); out=dict(t["output"]); out.pop("$defs",None)
        md.append("Input schema (`$defs` omitted, see `schemas/mcp/defs.json`):\n```json\n"+json.dumps(inp,indent=1)+"\n```\n")
        md.append("Output schema (`structuredContent`):\n```json\n"+json.dumps(out,indent=1)+"\n```\n")
        md.append("Valid example:\n```json\n"+json.dumps(t["valid"],indent=1)+"\n```\n")
        md.append("Rejected example:\n```json\n"+json.dumps(t["rejected"],indent=1)+"\n```\n"+f"Why rejected: {t['rejected_why']}\n")
    open(f"{P}/appendix/A6-mcp-tool-schemas.md","a").write("".join(md))
    print("tools:",len(TOOLS)); print("files:",len(os.listdir(S)),len(os.listdir(E)))
