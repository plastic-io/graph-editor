'use strict';
const ivm = require('isolated-vm');
const { performance } = require('node:perf_hooks');
const ms = (t) => Math.round((performance.now() - t) * 10) / 10;

async function runCase(name, code, { memoryLimit = 128, timeout = 500, grace = 250 } = {}) {
  const t0 = performance.now();
  const isolate = new ivm.Isolate({ memoryLimit });
  const tCreate = ms(t0);
  const context = await isolate.createContext();
  const jail = context.global;
  await jail.set('_log', new ivm.Callback((s) => {}));            // a host callback, like host.emit
  let outcome, error, tRun, watchdogFired = false, watchdogError = null;
  // Host-side watchdog: the script `timeout` covers the synchronous run, not a microtask storm,
  // so the owner thread disposes the isolate out-of-band if the run has not returned in time.
  const wd = process.env.NO_WATCHDOG ? null : setTimeout(() => { watchdogFired = true; console.error(`[watchdog] firing for ${name} at ${ms(t0)}ms; isolate.isDisposed=${isolate.isDisposed}`); try { isolate.dispose(); console.error('[watchdog] dispose() returned; isDisposed=' + isolate.isDisposed); } catch (e) { watchdogError = e.message; console.error('[watchdog] dispose threw: ' + e.message); } }, timeout + grace);
  try {
    const script = await isolate.compileScript(code);
    const t1 = performance.now();
    const r = await script.run(context, { timeout, copy: true });
    tRun = ms(t1);
    outcome = 'completed';
    error = r === undefined ? undefined : String(r).slice(0, 60);
  } catch (e) {
    outcome = 'threw'; error = String(e && e.message || e).slice(0, 120); tRun = ms(t0);
  }
  if (wd) clearTimeout(wd);
  let heapUsed = null, cpu = null, wall = null, disposed = false;
  try { heapUsed = (await isolate.getHeapStatistics()).used_heap_size; cpu = Number(isolate.cpuTime) / 1e6; wall = Number(isolate.wallTime) / 1e6; } catch (e) { /* isolate may be dead after OOM */ }
  try { isolate.dispose(); disposed = true; } catch (e) { error = (error || '') + ' | dispose: ' + e.message; }
  return { name, outcome, error, watchdogFired, watchdogError, createMs: tCreate, runMs: tRun, cpuMs: cpu && Math.round(cpu * 10) / 10, wallMs: wall && Math.round(wall * 10) / 10, heapUsed, disposed, isDisposed: isolate.isDisposed };
}

exports.handler = async (event) => {
  const which = (event && event.cases) || ['baseline', 'probe-globals', 'tight-loop', 'microtask-storm', 'heap-bomb', 'external-bomb', 'after-oom', 'promise-never', 'callback-ok'];
  const cases = {
    'baseline': `1 + 1`,
    'probe-globals': `JSON.stringify({ require: typeof require, process: typeof process, fetch: typeof fetch, AWS: typeof AWS, globalThis: typeof globalThis, _log: typeof _log })`,
    'tight-loop': `while (true) {}`,
    'microtask-storm': `let n = 0; function spin(){ n++; Promise.resolve().then(spin); } spin(); while(true){}`,
    'microtask-only': `let n = 0; function spin(){ n++; Promise.resolve().then(spin); } spin(); "returned; microtasks pending"`,
    'microtask-bounded': `let n = 0; function spin(){ if (++n < 1e6) Promise.resolve().then(spin); } spin(); "bounded"`,
    'heap-bomb': `const a = []; while (true) { a.push(new Array(1e6).fill(1)); }`,
    'external-bomb': `const a = []; while (true) { a.push(new ArrayBuffer(16 * 1024 * 1024)); }`,
    'after-oom': `"host still works: " + (2 * 21)`,
    'promise-never': `new Promise(() => {}); "returned before the promise settles"`,
    'callback-ok': `_log("hi"); "callback reachable"`,
  };
  const results = [];
  const tAll = performance.now();
  for (const c of which) {
    if (!cases[c]) continue;
    results.push(await runCase(c, cases[c], c === 'heap-bomb' || c === 'external-bomb' ? { memoryLimit: 128, timeout: 20000, grace: 5000 } : { memoryLimit: 128, timeout: 500, grace: 250 }));
  }
  return { node: process.version, arch: process.arch, rssBefore: undefined, ivm: require('isolated-vm/package.json').version, rss: process.memoryUsage().rss, totalMs: ms(tAll), results };
};
