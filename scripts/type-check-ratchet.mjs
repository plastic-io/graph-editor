#!/usr/bin/env node
// Type-check ratchet: the editor has a backlog of TypeScript errors in its SFCs
// (505 when this was introduced on 2026-09-20). CI fails only when the count grows.
// Lowering the count is welcome: update .type-check-baseline in the same change.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const baselineFile = new URL("../.type-check-baseline", import.meta.url);
const baseline = Number(readFileSync(baselineFile, "utf8").trim());
const run = spawnSync("npx", ["vue-tsc", "--noEmit", "-p", "tsconfig.vitest.json", "--composite", "false"], { encoding: "utf8", shell: process.platform === "win32" });
const output = (run.stdout || "") + (run.stderr || "");
const errors = output.split("\n").filter((l) => /error TS\d+:/.test(l));
const count = errors.length;
const byFile = {};
for (const l of errors) { const f = l.split("(")[0]; byFile[f] = (byFile[f] || 0) + 1; }
console.log(`vue-tsc reported ${count} error(s); baseline is ${baseline}.`);
if (count > baseline) {
  console.error(`Type errors increased by ${count - baseline}. New errors are probably in:`);
  for (const [f, n] of Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.error(`  ${n}\t${f}`);
  console.error(output.split("\n").filter((l) => /error TS\d+:/.test(l)).slice(0, 40).join("\n"));
  process.exit(1);
}
if (count < baseline && process.argv.includes("--update")) {
  writeFileSync(baselineFile, `${count}\n`);
  console.log(`Baseline lowered to ${count}.`);
} else if (count < baseline) {
  console.log(`Count is below the baseline; run "npm run type-check:ratchet -- --update" to lower it to ${count}.`);
}
process.exit(0);
