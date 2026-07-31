/**
 * Thin wrapper: emit parallel section build plan via ctrlc plan-parallel (C5).
 *
 * Usage:
 *   node scripts/parallel-section-build.mjs --cwd <clone-host> [--format md|json|sh] [--out file]
 *   node scripts/parallel-section-build.mjs --help
 *
 * Does not run git worktree. Prefer `ctrlc plan-parallel` when the CLI is on PATH.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONO_ROOT = path.resolve(__dirname, "..");
const BIN = path.join(MONO_ROOT, "packages/cli/bin/ctrlc.mjs");

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  console.log(`parallel-section-build - thin wrapper for ctrlc plan-parallel

Usage:
  node scripts/parallel-section-build.mjs [plan-parallel args...]

Examples:
  node scripts/parallel-section-build.mjs --cwd ./my-clone
  node scripts/parallel-section-build.mjs --cwd . --format json -o plan.json
  node scripts/parallel-section-build.mjs --cwd . --format sh --max-agents 3

Equivalent to:
  ctrlc plan-parallel ...
`);
  process.exit(0);
}

const r = spawnSync(process.execPath, [BIN, "plan-parallel", ...argv], {
  stdio: "inherit",
  cwd: process.cwd(),
  env: process.env,
});

process.exit(r.status ?? 1);
