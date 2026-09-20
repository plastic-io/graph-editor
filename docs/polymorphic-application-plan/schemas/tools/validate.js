const Ajv=require('ajv'); const fs=require('fs'); const path=require('path');
const P=path.join(__dirname,'..');
function load(f){ let t=fs.readFileSync(f,'utf8').replace(/"\$defs"/g,'"definitions"').replace(/#\/\$defs\//g,'#/definitions/'); const s=JSON.parse(t); delete s.$schema; delete s.$id; return s; }
const ajv=new Ajv({schemaId:'$id',unknownFormats:'ignore'});
let n=0, bad=[]; const rows=[];
for (const f of fs.readdirSync(P+'/mcp').sort()) {
  if(!f.endsWith('.input.json')) continue; const name=f.replace('.input.json','');
  let v,o; try { v=ajv.compile(load(`${P}/mcp/${f}`)); o=ajv.compile(load(`${P}/mcp/${name}.output.json`)); } catch(e){ bad.push(name+': compile '+e.message); continue; }
  const valid=JSON.parse(fs.readFileSync(`${P}/examples/${name}.valid.json`)); const rej=JSON.parse(fs.readFileSync(`${P}/examples/${name}.rejected.json`));
  const vOk=v(valid); if(!vOk) bad.push(name+': VALID example failed '+JSON.stringify(v.errors));
  rows.push(`| ${name} | ${vOk?'pass':'FAIL'} | ${v(rej)?'passes schema (rejected by policy/validation)':'fails schema (-32602)'} |`); n++;
}
console.log(rows.join('\n')); console.log('compiled',n,'bad',bad.length); bad.forEach(b=>console.log('  ',b));
fs.writeFileSync(`${P}/examples/VALIDATION.md`, `# Example validation (ajv 6.12.6 from graph-editor/node_modules, run 2026-09-20; \`$defs\` renamed to \`definitions\` for the draft-07 validator)\n\n| tool | valid example | rejected example |\n|---|---|---|\n${rows.join('\n')}\n\nCompiled ${n} input+output schema pairs; failures: ${bad.length}.\n`);
