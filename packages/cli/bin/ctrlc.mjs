#!/usr/bin/env node
/**
 * CtrlC - SectionPack CLI entry
 *
 * Usage:
 *   ctrlc <command> [options]
 *   node packages/cli/bin/ctrlc.mjs <command>
 *   npm run ctrlc -- <command>
 *
 * Prefers the esbuild bundle (dist/cli.mjs) when present; falls back to
 * source (src/cli.mjs). Does not re-exec under a TypeScript loader: CLI sources
 * are plain ESM. TypeScript host configs still load via load-config.mjs
 * (tsx only when needed).
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distEntry = path.join(__dirname, "../dist/cli.mjs");
const srcEntry = path.join(__dirname, "../src/cli.mjs");

const cliEntry = fs.existsSync(distEntry) ? distEntry : srcEntry;

if (!fs.existsSync(cliEntry)) {
  console.error(
    "CtrlC: CLI entry not found. Expected dist/cli.mjs or src/cli.mjs under packages/cli.",
  );
  console.error("Run: npm run build -w @ctrlc/cli");
  process.exit(1);
}

const mod = await import(pathToFileURL(cliEntry).href);
if (typeof mod.run !== "function") {
  console.error(`CtrlC: ${cliEntry} has no run() export`);
  process.exit(1);
}

const code = await mod.run(process.argv.slice(2));
process.exit(typeof code === "number" ? code : 0);
