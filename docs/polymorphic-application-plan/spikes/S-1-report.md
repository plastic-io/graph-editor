# Spike S-1 — isolated-vm inside a Lambda container (result: viable; decision D-4 confirmed with two wrapper rules)

**Question.** Does isolated-vm build and run inside the AWS Lambda Node container, terminate runaway code within its budget, survive an isolate OOM, and leave the host healthy afterwards? What runtime version does it require, and what does it cost?

**Facts established first (npm registry, ECR, 2026-09-20).** isolated-vm 5.0.4 is the last line supporting Node 18; 6.x requires Node ≥ 22; 7.x requires Node ≥ 24. Lambda base images exist for nodejs 18, 20, 22 and 24. The server today runs nodejs18.x, so adopting isolated-vm implies the runtime upgrade of open question Q-5.

**Method.** `spikes/s1/` holds a two-stage Dockerfile (build stage installs `gcc-c++ make python3` on the Lambda image and runs `npm install`; final stage copies `node_modules` onto the clean image), a Lambda handler with adversarial cases, and three direct probes run with `node` inside the same image (the Runtime Interface Emulator panics when an invocation wedges, so the direct runs are the reliable evidence). Images: Node 22.23.2 + isolated-vm 6.2.0 (arm64 and amd64), Node 24.21.0 + isolated-vm 7.0.1 (arm64). amd64 ran under emulation on this Mac: outcomes are valid, timings are not.

**Results.**

| Check | Node 22 / ivm 6.2.0 | Node 24 / ivm 7.0.1 |
|---|---|---|
| Native build inside the Lambda image | ~30 s on arm64, ~40 s on amd64; no patches needed | same |
| Addon footprint | 21 MB in `node_modules/isolated-vm` | similar |
| Isolate creation | 1.0–2.4 ms; baseline script run 0.1–0.4 ms | same |
| Realm contents (`probe-globals`) | `require`, `process`, `fetch`, `AWS` all `undefined`; only injected callbacks reachable | same |
| `while(true){}` with `timeout: 500` | rejected "Script execution timed out." at 505–509 ms (≤ 9 ms overshoot) | same |
| Infinite microtask chain, script returns (`microtask-only`) | stopped by the script timeout at 505 ms | same |
| Microtask chain + sync loop (`microtask-storm`) | timeout rejects at 509 ms; afterwards the isolate is **idle but wedged**: host CPU 0, any further call into it (`getHeapStatistics()`) never returns; `dispose()` returns in 0 ms and frees it | identical |
| Heap bomb with `memoryLimit: 128` | "Isolate was disposed during execution due to memory limit" after 72–91 ms; host process survives; RSS peaks ~230 MB and returns to baseline | 220 ms to the limit; same outcome |
| 16 MB ArrayBuffer loop | "Array buffer allocation failed" at 6.6 ms; isolate still usable | same |
| Pending promise never settled | run returns normally ("returned before the promise settles") | same |
| Host callback (`ivm.Callback`) | reachable, as `host.*` will be | same |
| 20× storm, 20× loop, 20× heap bomb, then fresh isolates | every case contained; ~306 ms per 300 ms budget; fresh isolate OK after each batch; RSS 49 → 63 MB (arm64), 94 → 113 MB (amd64 emulated) | RSS 51 → 66 MB |

**The one trap, and the rules it implies.** The handler version that awaited `isolate.getHeapStatistics()` after a timeout hung forever on the microtask-storm case, which then wedged the single-concurrency runtime emulator. Rule 1: **after any timeout or memory-limit rejection, dispose the isolate immediately and never call into it again** (statistics must be read *before* running, or from `isolate.cpuTime`/`wallTime` which are plain properties). Rule 2: **isolates are per execution and never reused**, which the plan already states (§4.6.3). With those two rules the script `timeout` plus `memoryLimit` were sufficient in every case tried; the host-side watchdog (`setTimeout → isolate.dispose()`) is kept as the escalation for host-binding calls that block outside the isolate, not as the primary stop.

**Cost.** Cold-start delta from the 21 MB addon was not measured on real Lambda (no deploy in this spike); the plan's ±300 ms assumption stands as an assumption. Bundle: the addon must be shipped as a Lambda layer or container image built on the Lambda image (webpack cannot bundle a `.node` binary), which changes the packaging step of the server (PB-062).

**Decisions enabled.** D-4 confirmed: server containment = isolated-vm. Q-5 decided: move the server runtime to **nodejs22.x with isolated-vm 6.2.0** now (nodejs18.x is deprecated by Lambda anyway); nodejs24.x + 7.0.1 behaves identically and can be adopted later without design change. Acceptance thresholds in §4.6.6 are now measured on this hardware: termination overshoot ≤ 10 ms, OOM containment at 128 MB with host survival, no leak over 60 adversarial runs.

**Not covered.** Fairness between two executions on one Lambda (single-concurrency Lambda makes it moot until per-tenant concurrency), CPU-time budgets beyond wall (`isolate.cpuTime` exists and is readable before/after), real cold-start numbers, and the RIE panic (an emulator bug, not a Lambda behaviour).
