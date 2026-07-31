/**
 * Write committed baselines for examples/next-demo.
 * Prefer: npm run snapshot
 *
 * Self-contained (imports @ctrlc/core + host config via tsx).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEMO = path.join(ROOT, "examples", "next-demo");
const OUT = path.join(DEMO, ".ctrlc", "snapshots");
const CONFIG = path.join(DEMO, "src/lib/section-pack-config.ts");

async function loadCore() {
  try {
    return await import("@ctrlc/core");
  } catch {
    const dist = path.join(ROOT, "packages/core/dist/index.js");
    return import(pathToFileURL(dist).href);
  }
}

async function main() {
  try {
    const api = await import("tsx/esm/api");
    if (typeof api.register === "function") api.register();
  } catch {
    console.error("tsx required to load demo TypeScript config");
    process.exit(1);
  }

  const core = await loadCore();
  const mod = await import(pathToFileURL(CONFIG).href);
  const config = mod.sectionPackConfig ?? mod.default;
  if (!config?.sections?.length) {
    console.error("Could not load sectionPackConfig from demo");
    process.exit(1);
  }

  fs.mkdirSync(OUT, { recursive: true });
  const entries = core.listSectionEntries(config);
  for (const entry of entries) {
    const pack = core.buildSectionPack(entry, config, { cwd: DEMO });
    const snap = core.snapshotSectionPack(pack);
    const abs = path.join(OUT, `${entry.id}.json`);
    fs.writeFileSync(abs, JSON.stringify(snap, null, 2) + "\n", "utf8");
    console.log(
      `  ${entry.id.padEnd(16)} ${snap.contentHash}  -> ${path.relative(ROOT, abs)}`,
    );
  }
  console.log(`\nwrote ${entries.length} snapshot(s) to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
