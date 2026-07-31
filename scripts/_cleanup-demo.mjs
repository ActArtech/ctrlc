/**
 * Remove duplicate next-demo section files (pc-* era).
 * Prefer: npm run validate:demo  (includes --prune)
 *
 * Usage: node scripts/_cleanup-demo.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const r = spawnSync(
  process.execPath,
  [path.join(root, "scripts/validate-packs.mjs"), "--prune"],
  { stdio: "inherit", cwd: root },
);
process.exit(r.status ?? 1);
