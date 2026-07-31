#!/usr/bin/env node
/**
 * CtrlC - SectionPack CLI entry
 *
 * Usage:
 *   ctrlc <command> [options]
 *   node packages/cli/bin/ctrlc.mjs <command>
 *   npm run ctrlc -- <command>
 *
 * Re-execs with `node --import tsx` so host TypeScript configs
 * (src/lib/section-pack-config.ts) load under Node 20+.
 */

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliEntry = path.join(__dirname, "../src/cli.mjs");

function hasTsxImport() {
  const args = process.execArgv || [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--import" && args[i + 1] && String(args[i + 1]).includes("tsx")) {
      return true;
    }
    if (a.startsWith("--import=") && a.includes("tsx")) return true;
    if (a.includes("tsx")) return true;
  }
  return false;
}

if (!hasTsxImport()) {
  // Prefer workspace/local tsx; fall back to bare specifier.
  const r = spawnSync(
    process.execPath,
    ["--import", "tsx", process.argv[1], ...process.argv.slice(2)],
    {
      stdio: "inherit",
      env: process.env,
      windowsHide: true,
    },
  );
  if (r.error && r.error.code === "ENOENT") {
    console.error("CtrlC: failed to spawn node with --import tsx");
    console.error(String(r.error.message || r.error));
    process.exit(1);
  }
  // If tsx missing, Node may still exit non-zero; surface status.
  process.exit(typeof r.status === "number" ? r.status : 1);
}

const mod = await import(pathToFileURL(cliEntry).href);
const code = await mod.run(process.argv.slice(2));
process.exit(typeof code === "number" ? code : 0);
