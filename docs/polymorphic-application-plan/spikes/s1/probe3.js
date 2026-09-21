const ivm = require('isolated-vm');
const t0 = Date.now(); const log = (...a) => console.error(`[${Date.now() - t0}ms]`, ...a);
const cases = { storm: `let n=0; function spin(){ n++; Promise.resolve().then(spin);} spin(); while(true){}`, loop: `while(true){}`, bomb: `const a=[]; while(true){ a.push(new Array(1e6).fill(1)); }`, ok: `1+1` };
const rss = () => Math.round(process.memoryUsage().rss / 1e6);
async function once(code, timeout) {
  const isolate = new ivm.Isolate({ memoryLimit: 128 }); const ctx = await isolate.createContext(); const s = await isolate.compileScript(code);
  let outcome; try { await s.run(ctx, { timeout }); outcome = 'ok'; } catch (e) { outcome = e.message.slice(0, 40); }
  // rule: after any failure, dispose immediately and never touch the isolate again
  try { isolate.dispose(); } catch (e) { outcome += ' | dispose: ' + e.message.slice(0, 30); }
  return outcome;
}
(async () => {
  log('start rss', rss(), 'MB');
  for (const [name, code] of Object.entries(cases)) {
    const t = Date.now(); const outcomes = new Set();
    for (let i = 0; i < 20; i++) outcomes.add(await once(code, name === 'bomb' ? 20000 : 300));
    log(`${name} x20: ${Math.round((Date.now() - t) / 20)} ms each, outcomes = ${[...outcomes].join(' / ')}, rss ${rss()} MB`);
    const probe = await once(cases.ok, 300); log(`  fresh isolate after ${name}: ${probe}`);
  }
  if (global.gc) global.gc(); await new Promise((r) => setTimeout(r, 500)); log('end rss', rss(), 'MB'); log('exit');
})();
