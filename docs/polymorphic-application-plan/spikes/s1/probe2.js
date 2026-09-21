const ivm = require('isolated-vm');
const t0 = Date.now(); const log = (...a) => console.error(`[${Date.now() - t0}ms]`, ...a);
const storm = `let n = 0; function spin(){ n++; Promise.resolve().then(spin); } spin(); while(true){}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function cpuOver(ms) { const a = process.cpuUsage(); await sleep(ms); const b = process.cpuUsage(a); return Math.round((b.user + b.system) / 1000) + 'ms cpu in ' + ms + 'ms wall'; }
async function responsive(isolate) { return Promise.race([isolate.getHeapStatistics().then(() => 'responsive'), sleep(1500).then(() => 'UNRESPONSIVE (1.5 s)')]); }
(async () => {
  const isolate = new ivm.Isolate({ memoryLimit: 128 });
  const context = await isolate.createContext();
  const script = await isolate.compileScript(storm);
  log('baseline host cpu:', await cpuOver(1000));
  log('starting storm with timeout 500');
  try { await script.run(context, { timeout: 500 }); log('run resolved'); } catch (e) { log('run rejected:', e.message); }
  log('after timeout: host cpu over 2 s =', await cpuOver(2000), '(a spinning isolate thread shows as ~2000ms)');
  log('after timeout: isolate', await responsive(isolate));
  log('calling isolate.dispose()'); const d0 = Date.now();
  try { isolate.dispose(); log('dispose returned in', Date.now() - d0, 'ms; isDisposed =', isolate.isDisposed); } catch (e) { log('dispose threw:', e.message); }
  log('after dispose: host cpu over 2 s =', await cpuOver(2000));
  log('exit');
})();
