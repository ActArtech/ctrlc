/**
 * Remove empty legacy Slice / non-canonical stub modules (idempotent).
 * Also run automatically at the start of scripts/test-pack.mjs.
 *
 *   npm run clean:stubs -w @ctrlc/core
 *   node scripts/_cleanup-stubs.mjs
 */
import { unlinkSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const stubs = [
  "build-slice-pack.ts",
  "multi-slice-pack.ts",
  "slice-manifest.ts",
  "build-slice-zip.ts",
  "build-pack.ts",
  "multi-pack.ts",
  "multi.ts",
  "behavior.ts",
  "config.ts",
  "extract.ts",
  "format.ts",
  "build-pack-zip.ts",
  "extract.test.ts",
];

let n = 0;
for (const name of stubs) {
  const p = path.join(root, name);
  if (existsSync(p)) {
    unlinkSync(p);
    console.log("deleted", name);
    n++;
  } else {
    console.log("skip (missing)", name);
  }
}
console.log(`removed ${n} stub file(s)`);
