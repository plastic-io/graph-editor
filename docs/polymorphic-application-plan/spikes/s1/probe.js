const ivm = require('isolated-vm');
const t0 = Date.now(); const log = (...a) => console.error(`[${Date.now() - t0}ms]`, ...a);
const storm = `let n = 0; function spin(){ n++; Promise.resolve().then(spin); } spin(); while(true){}`;
const mode = process.argv[2] || 'timeout-only';
(async () => {
  const isolate = new ivm.Isolate({ memoryLimit: 128 });
  const context = await isolate.createContext();
  const script = await isolate.compileScript(storm);
  log('starting run, mode =', mode);
  if (mode === 'dispose') setTimeout(() => { log('watchdog: calling isolate.dispose()'); try { isolate.dispose(); log('dispose returned, isDisposed =', isolate.isDisposed); } catch (e) { log('dispose threw:', e.message); } }, 750);
  if (mode === 'cputime') { const iv = setInterval(() => { try { log('cpuTime ms', Number(isolate.cpuTime) / 1e6, 'wall', Number(isolate.wallTime) / 1e6, 'heap', isolate.getHeapStatisticsSync().used_heap_size); } catch (e) { log('stats threw', e.message); clearInterval(iv); } }, 500); iv.unref(); }
  const alive = setInterval(() => log('host loop alive'), 2000); alive.unref();
  try { const r = await script.run(context, { timeout: 500 }); log('run resolved:', r); }
  catch (e) { log('run rejected:', e.message); }
  log('after run; isDisposed =', isolate.isDisposed);
  try { isolate.dispose(); } catch (e) { log('final dispose threw', e.message); }
  log('exit');
})();
