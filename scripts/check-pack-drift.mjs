/**
 * CI: detect SectionPack contentHash drift vs committed baselines.
 *
 * For each section in the host config (default: examples/next-demo):
 *   1. buildSectionPack
 *   2. snapshotSectionPack
 *   3. if .ctrlc/snapshots/<id>.json exists, compare contentHash
 *   4. exit 1 when any hash differs or baseline is missing (unless --allow-missing)
 *
 * Usage:
 *   node scripts/check-pack-drift.mjs
 *   node scripts/check-pack-drift.mjs --cwd examples/next-demo
 *   node scripts/check-pack-drift.mjs --cwd examples/next-demo --allow-missing
 *
 * Generate / refresh baselines:
 *   npm run snapshot
 *   ctrlc snapshot --cwd examples/next-demo
 *
 * Exit 0 when all baselines match; 1 on drift or error.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const DEFAULT_CWD = path.join(ROOT, "examples", "next-demo");
const DEFAULT_SNAPSHOTS = ".ctrlc/snapshots";

/**
 * @param {string[]} argv
 */
function parseArgv(argv) {
  /** @type {Record<string, string | boolean>} */
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      flags.help = true;
      continue;
    }
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq > 2) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
        continue;
      }
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next != null && !next.startsWith("-")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  return flags;
}

async function loadCore() {
  try {
    return await import("@ctrlc/core");
  } catch {
    const dist = path.join(ROOT, "packages/core/dist/index.js");
    if (fs.existsSync(dist)) {
      return import(pathToFileURL(dist).href);
    }
    throw new Error(
      "Cannot load @ctrlc/core. Run npm install && npm run build from the monorepo root.",
    );
  }
}

async function ensureTsx() {
  try {
    const api = await import("tsx/esm/api");
    if (typeof api.register === "function") api.register();
  } catch {
    // optional until host config is .ts
  }
}

/**
 * Minimal config loader (mirrors CLI well-known paths for the demo).
 * @param {string} cwd
 * @param {string | null} configPath
 * @param {any} core
 */
async function loadConfig(cwd, configPath, core) {
  const candidates = configPath
    ? [configPath]
    : [
        "sectionpack.config.ts",
        "sectionpack.config.mjs",
        "sectionpack.config.js",
        "src/lib/section-pack-config.ts",
        "src/lib/section-pack-config.mjs",
      ];

  let abs = null;
  for (const rel of candidates) {
    const p = path.isAbsolute(rel) ? rel : path.join(cwd, rel);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      abs = p;
      break;
    }
  }

  if (!abs) {
    return {
      config: core.createDemoSectionPackConfig(),
      source: "createDemoSectionPackConfig()",
    };
  }

  if (/\.(mts|cts|ts)$/i.test(abs)) {
    await ensureTsx();
  }

  const mod = await import(pathToFileURL(abs).href);
  let config = null;
  if (typeof mod.createDemoSectionPackConfig === "function") {
    config = mod.createDemoSectionPackConfig();
  } else if (typeof mod.createSectionPackConfig === "function") {
    config = mod.createSectionPackConfig();
  } else if (mod.sectionPackConfig?.sections) {
    config = mod.sectionPackConfig;
  } else if (mod.config?.sections) {
    config = mod.config;
  } else if (typeof mod.default === "function") {
    config = mod.default();
  } else if (mod.default?.sections) {
    config = mod.default;
  }

  if (!config?.sections) {
    throw new Error(`Could not load SectionPackConfig from ${abs}`);
  }
  return { config, source: abs };
}

function printHelp() {
  console.log(`check-pack-drift - SectionPack contentHash baseline check

Usage:
  node scripts/check-pack-drift.mjs [options]

Options:
  --cwd <dir>           Project root (default: examples/next-demo)
  --config <file>       Config module path
  --snapshots-dir <dir> Baseline dir relative to cwd (default: .ctrlc/snapshots)
  --allow-missing       Do not fail when a baseline snapshot is absent
  --json                Machine-readable report
  --help                Show this help

Refresh baselines:
  npm run snapshot
  # or: node packages/cli/bin/ctrlc.mjs snapshot --cwd examples/next-demo
`);
}

async function main() {
  const flags = parseArgv(process.argv.slice(2));
  if (flags.help) {
    printHelp();
    process.exit(0);
  }

  const cwd = flags.cwd
    ? path.resolve(String(flags.cwd))
    : DEFAULT_CWD;
  const configPath = flags.config ? path.resolve(String(flags.config)) : null;
  const allowMissing = flags["allow-missing"] === true || flags["allow-missing"] === "true";
  const asJson = flags.json === true || flags.json === "true";
  const snapshotsRel =
    typeof flags["snapshots-dir"] === "string"
      ? flags["snapshots-dir"]
      : typeof flags["out-dir"] === "string"
        ? flags["out-dir"]
        : DEFAULT_SNAPSHOTS;
  const snapshotsDir = path.isAbsolute(snapshotsRel)
    ? snapshotsRel
    : path.join(cwd, snapshotsRel);

  if (!fs.existsSync(cwd)) {
    console.error(`check-pack-drift: cwd not found: ${cwd}`);
    process.exit(1);
  }

  const core = await loadCore();
  const loaded = await loadConfig(cwd, configPath, core);
  const entries = core.listSectionEntries(loaded.config);

  /** @type {Array<object>} */
  const report = [];
  let driftCount = 0;
  let missingCount = 0;
  let okCount = 0;

  if (!asJson) {
    console.log("SectionPack drift check");
    console.log(`  cwd:       ${cwd}`);
    console.log(`  config:    ${loaded.source}`);
    console.log(`  snapshots: ${snapshotsDir}`);
    console.log(`  sections:  ${entries.length}`);
    console.log("");
  }

  for (const entry of entries) {
    const pack = core.buildSectionPack(entry, loaded.config, { cwd });
    const snap = core.snapshotSectionPack(pack);
    const baselinePath = path.join(snapshotsDir, `${entry.id}.json`);
    let baseline = null;
    let status = "ok";
    let message = "match";

    if (!fs.existsSync(baselinePath)) {
      missingCount++;
      status = allowMissing ? "missing-ok" : "missing";
      message = `no baseline at ${path.relative(cwd, baselinePath) || baselinePath}`;
      if (status === "missing") driftCount++;
    } else {
      try {
        baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
      } catch (e) {
        status = "error";
        message = `unreadable baseline: ${e?.message ?? e}`;
        driftCount++;
      }
      if (baseline && typeof baseline.contentHash === "string") {
        if (baseline.contentHash === snap.contentHash) {
          okCount++;
          status = "ok";
          message = "contentHash match";
        } else {
          driftCount++;
          status = "drift";
          message = `contentHash ${baseline.contentHash.slice(0, 12)}... -> ${snap.contentHash.slice(0, 12)}...`;
        }
      } else if (baseline) {
        driftCount++;
        status = "error";
        message = "baseline missing contentHash field";
      }
    }

    report.push({
      id: entry.id,
      status,
      contentHash: snap.contentHash,
      baselineHash: baseline?.contentHash ?? null,
      baselinePath,
      message,
    });

    if (!asJson) {
      const mark =
        status === "ok" || status === "missing-ok"
          ? "ok"
          : status === "drift"
            ? "DRIFT"
            : status === "missing"
              ? "MISS"
              : "ERR";
      console.log(
        `  ${mark.padEnd(5)} ${entry.id.padEnd(14)} ${snap.contentHash.slice(0, 12)}...  ${message}`,
      );
    }
  }

  const ok = driftCount === 0;

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          ok,
          cwd,
          configSource: loaded.source,
          snapshotsDir,
          okCount,
          missingCount,
          driftCount,
          sections: report,
        },
        null,
        2,
      ),
    );
  } else {
    console.log("");
    if (ok) {
      console.log(
        `check-pack-drift: passed (${okCount} match${missingCount ? `, ${missingCount} missing allowed` : ""})`,
      );
    } else {
      console.error(
        `check-pack-drift: FAILED (${driftCount} problem(s), ${okCount} match, ${missingCount} missing)`,
      );
      console.error("");
      console.error("To refresh baselines after intentional pack changes:");
      console.error("  npm run snapshot");
      console.error(
        "  # or: npm run ctrlc -- snapshot --cwd examples/next-demo",
      );
    }
  }

  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(String(e?.message ?? e));
  if (process.env.CTRLC_DEBUG) console.error(e);
  process.exit(1);
});
