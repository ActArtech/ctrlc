/**
 * Minimal pure-function tests for section id normalization.
 * Usage: npm run test -w @ctrlc/capture
 */

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "..");
const distIndex = path.join(pkgRoot, "dist/index.js");
const srcIndex = path.join(pkgRoot, "src/index.ts");

async function loadCapture() {
  if (fs.existsSync(distIndex)) {
    return import(pathToFileURL(distIndex).href);
  }
  // Source via tsx when dist not built
  const api = await import("tsx/esm/api");
  api.register();
  return import(pathToFileURL(srcIndex).href);
}

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error(`  FAIL  ${msg}`);
    failed++;
  } else {
    console.log(`  ok    ${msg}`);
  }
}

const mod = await loadCapture();
const { normalizeSectionId, uniqueSectionIds } = mod;

console.log("@ctrlc/capture section id tests\n");

assert(normalizeSectionId("Hero Banner") === "hero-banner", "Hero Banner -> hero-banner");
assert(normalizeSectionId("  Site Header  ") === "site-header", "trim spaces");
assert(normalizeSectionId("CTA") === "cta", "CTA -> cta");
assert(normalizeSectionId("Foo___Bar") === "foo-bar", "underscores collapse");
assert(normalizeSectionId("") === "section", "empty -> section");
assert(normalizeSectionId("!!!") === "section", "symbols only -> section");
assert(normalizeSectionId("Pricing & Plans") === "pricing-plans", "ampersand stripped");

const ids = uniqueSectionIds(["Hero", "Hero", "Features", ""]);
assert(ids[0] === "hero", "unique first hero");
assert(ids[1] === "hero-2", "duplicate hero -> hero-2");
assert(ids[2] === "features", "features");
assert(ids[3] === "section-4", "empty label falls back to section-N");

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall ok");
