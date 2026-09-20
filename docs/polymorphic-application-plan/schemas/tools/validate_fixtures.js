const Ajv=require('ajv'); const fs=require('fs'); const path=require('path');
const P=path.join(__dirname,'..');
function load(f){ let t=fs.readFileSync(f,'utf8').replace(/"\$defs"/g,'"definitions"').replace(/#\/\$defs\//g,'#/definitions/'); const s=JSON.parse(t); delete s.$schema; delete s.$id; return s; }
const ajv=new Ajv({schemaId:'$id',unknownFormats:'ignore'});
const graphV=ajv.compile(load(`${P}/fixtures/graph.schema.json`));
const defs=load(`${P}/mcp/defs.json`); const diffV=ajv.compile({definitions:defs.definitions,$ref:'#/definitions/diffSummary'});
const obsV=ajv.compile({definitions:defs.definitions,$ref:'#/definitions/observation'});
let bad=[];
for (const f of ['rate-limiter.graph.json','api-graph.instance.json']) { const ok=graphV(JSON.parse(fs.readFileSync(`${P}/fixtures/${f}`))); console.log(f, ok?'valid':'INVALID'); if(!ok) bad.push(f+' '+JSON.stringify(graphV.errors)); }
for (const f of ['diff.rename.json','diff.upgrade.json']) { const ok=diffV(JSON.parse(fs.readFileSync(`${P}/fixtures/${f}`))); console.log(f, ok?'valid':'INVALID'); if(!ok) bad.push(f+' '+JSON.stringify(diffV.errors)); }
const calls=JSON.parse(fs.readFileSync(`${P}/fixtures/traversal.calls.json`)).calls;
for (const c of calls) {
  const p=c.request.params; if (c.request.method!=='tools/call') { console.log(c.title,'(resource/task call, framing only)'); continue; }
  const name=p.name; const inV=ajv.compile(load(`${P}/mcp/${name}.input.json`)); const outV=ajv.compile(load(`${P}/mcp/${name}.output.json`));
  const inOk=inV(p.arguments); let outOk='task';
  if (c.response.result.structuredContent) outOk=outV(c.response.result.structuredContent);
  console.log(`${c.title}: input ${inOk?'valid':'INVALID'}, output ${outOk===true?'valid':outOk===false?'INVALID':outOk}`);
  if(!inOk) bad.push(c.title+' in '+JSON.stringify(inV.errors)); if(outOk===false) bad.push(c.title+' out '+JSON.stringify(outV.errors));
  if (name==='observations.query') for (const o of c.response.result.structuredContent.result.observations) if(!obsV(o)) bad.push('observation '+o.id+' '+JSON.stringify(obsV.errors));
}
const tg=calls.find(c=>c.title==='tasks/get'); const sc=tg.response.result.result.structuredContent; const trV=ajv.compile(load(`${P}/mcp/tests.run.output.json`)); if(!trV(sc)) bad.push('tests.run terminal result '+JSON.stringify(trV.errors)); else console.log('tests.run terminal result: valid');
console.log('failures', bad.length); bad.forEach(b=>console.log('  ',b));
fs.writeFileSync(`${P}/fixtures/VALIDATION.md`,`# Fixture validation (ajv 6.12.6, 2026-09-20)\n\nGraph fixtures: rate-limiter.graph.json, api-graph.instance.json validated against graph.schema.json. Diffs validated against diffSummary. Traversal tool calls validated against A6 input/output schemas. Failures: ${bad.length}.\n`);
