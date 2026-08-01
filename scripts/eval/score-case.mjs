/**
 * Score one eval case against a host cwd using the CtrlC CLI.
 *
 * Usage:
 *   node scripts/eval/score-case.mjs \
 *     --case docs/eval/cases/northline-demo/case.json \
 *     --cwd examples/next-demo \
 *     --out docs/eval/results/northline-demo.json
 *
 * Exit 0 if qa ok; exit 1 if not (still writes results).
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONO_ROOT = path.resolve(__dirname, "../..");
const CLI_BIN = path.join(MONO_ROOT, "packages/cli/bin/ctrlc.mjs");

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--case" || a === "--cwd" || a === "--out") {
      const v = argv[++i];
      if (!v || v.startsWith("--")) {
        throw new Error(`Missing value for ${a}`);
      }
      flags[a.slice(2)] = v;
    } else if (a === "--help" || a === "-h") {
      flags.help = "1";
    } else {
      throw new Error(`Unknown arg: ${a}`);
    }
  }
  return flags;
}

function usage() {
  console.log(`score-case.mjs

  --case <path>   Case JSON (required)
  --cwd <path>    Host project root (required)
  --out <path>    Results JSON path (required)

Example:
  node scripts/eval/score-case.mjs \\
    --case docs/eval/cases/northline-demo/case.json \\
    --cwd examples/next-demo \\
    --out docs/eval/results/northline-demo.json
`);
}

/**
 * @param {string} p
 * @param {string} base
 */
function resolvePath(p, base = MONO_ROOT) {
  return path.isAbsolute(p) ? p : path.resolve(base, p);
}

/**
 * @param {string[]} args
 * @param {{ cwd?: string }} [opts]
 */
function runCtrlc(args, opts = {}) {
  if (!fs.existsSync(CLI_BIN)) {
    throw new Error(`CLI bin missing: ${CLI_BIN}`);
  }
  const r = spawnSync(process.execPath, [CLI_BIN, ...args], {
    encoding: "utf8",
    cwd: opts.cwd ?? MONO_ROOT,
    env: process.env,
    maxBuffer: 8 * 1024 * 1024,
  });
  return {
    status: r.status ?? 1,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    error: r.error,
  };
}

/**
 * @param {string} text
 */
function tryParseJson(text) {
  const t = text.trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    // CLI may print logs before JSON; take last {...} block
    const start = t.lastIndexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(t.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function gitSha() {
  const r = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    encoding: "utf8",
    cwd: MONO_ROOT,
    env: process.env,
  });
  if (r.status === 0 && r.stdout?.trim()) return r.stdout.trim();
  return null;
}

/**
 * @param {boolean} validateOk
 * @param {boolean} listOk
 * @param {number} total
 * @param {number} registered
 * @param {boolean} firstPassQaOk
 */
function structureScore(validateOk, listOk, total, registered, firstPassQaOk) {
  const v = validateOk ? 1 : 0;
  const l = listOk && total > 0 ? 1 : 0;
  const r = total > 0 && registered >= total ? 1 : 0;
  const q = firstPassQaOk ? 1 : 0;
  return round4((v + l + r + q) / 4);
}

/**
 * @param {number} dualExportOk
 * @param {number} dualExportSampled
 * @param {number} total
 */
function contentScore(dualExportOk, dualExportSampled, total) {
  if (total <= 0) return 0;
  const n = Math.max(dualExportSampled, 1);
  return round4(dualExportOk / n);
}

/** @param {number} n */
function round4(n) {
  return Math.round(n * 10000) / 10000;
}

/**
 * @param {string} hostCwd
 * @param {string} sectionId
 * @param {string} format
 */
function packOk(hostCwd, sectionId, format) {
  const r = runCtrlc(
    ["pack", sectionId, "--format", format, "--cwd", hostCwd],
    { cwd: MONO_ROOT },
  );
  // pack prints content to stdout; success is exit 0 and non-empty body
  return r.status === 0 && (r.stdout.trim().length > 0 || r.stderr.includes("Wrote"));
}

/**
 * @param {string} hostCwd
 */
function baselineExists(hostCwd) {
  const candidates = [
    path.join(hostCwd, ".ctrlc", "baseline"),
    path.join(hostCwd, ".ctrlc", "baselines"),
    path.join(hostCwd, "docs", "research", "baseline"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return true;
  }
  // any screenshot-ish under .ctrlc
  const ctrlcDir = path.join(hostCwd, ".ctrlc");
  if (fs.existsSync(ctrlcDir)) {
    try {
      const names = fs.readdirSync(ctrlcDir);
      if (names.some((n) => /baseline|visual/i.test(n))) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

async function main() {
  let flags;
  try {
    flags = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(String(/** @type {Error} */ (e).message || e));
    usage();
    process.exit(2);
  }

  if (flags.help) {
    usage();
    process.exit(0);
  }

  if (!flags.case || !flags.cwd || !flags.out) {
    console.error("Required: --case, --cwd, --out");
    usage();
    process.exit(2);
  }

  const casePath = resolvePath(flags.case);
  const hostCwd = resolvePath(flags.cwd);
  const outPath = resolvePath(flags.out);

  if (!fs.existsSync(casePath)) {
    console.error(`Case not found: ${casePath}`);
    process.exit(2);
  }
  if (!fs.existsSync(hostCwd)) {
    console.error(`Host cwd not found: ${hostCwd}`);
    process.exit(2);
  }

  /** @type {Record<string, any>} */
  const caseData = JSON.parse(fs.readFileSync(casePath, "utf8"));
  const scoredAt = new Date().toISOString();
  const date = scoredAt.slice(0, 10);
  const sha = gitSha();

  console.error(`score-case: case=${caseData.caseId ?? path.basename(path.dirname(casePath))}`);
  console.error(`  host=${hostCwd}`);
  console.error(`  cli=${CLI_BIN}`);

  // --- list ---
  const listRun = runCtrlc(["list", "--cwd", hostCwd, "--json"], { cwd: MONO_ROOT });
  const listJson = tryParseJson(listRun.stdout);
  const ids = Array.isArray(listJson?.ids)
    ? listJson.ids
    : Array.isArray(listJson?.sections)
      ? listJson.sections.map((/** @type {{ id: string }} */ s) => s.id)
      : [];
  const listOk = listRun.status === 0 && ids.length > 0;
  if (!listOk) {
    console.error(`  list: FAIL status=${listRun.status}`);
    if (listRun.stderr) console.error(listRun.stderr.slice(0, 500));
  } else {
    console.error(`  list: ok (${ids.length}) ${ids.join(", ")}`);
  }

  // --- validate ---
  const valRun = runCtrlc(["validate", "--cwd", hostCwd, "--json"], { cwd: MONO_ROOT });
  const valJson = tryParseJson(valRun.stdout);
  const validateOk = valRun.status === 0 && (valJson?.ok !== false);
  if (!validateOk) {
    console.error(`  validate: FAIL status=${valRun.status}`);
    if (valJson?.errors) console.error(JSON.stringify(valJson.errors, null, 2).slice(0, 800));
    else if (valRun.stderr) console.error(valRun.stderr.slice(0, 500));
  } else {
    console.error(`  validate: ok`);
  }

  // --- qa --skip-build ---
  const qaRun = runCtrlc(["qa", "--cwd", hostCwd, "--skip-build", "--json"], {
    cwd: MONO_ROOT,
  });
  const qaJson = tryParseJson(qaRun.stdout);
  const firstPassQaOk = qaRun.status === 0 && (qaJson?.ok !== false);
  if (!firstPassQaOk) {
    console.error(`  qa: FAIL status=${qaRun.status}`);
    if (qaRun.stdout) console.error(qaRun.stdout.slice(0, 600));
    if (qaRun.stderr) console.error(qaRun.stderr.slice(0, 400));
  } else {
    console.error(`  qa: ok (skip-build)`);
  }

  // --- dual export sample (first 3) ---
  const sampleIds = ids.slice(0, 3);
  /** @type {{ id: string, describe: boolean, promptShort: boolean }[]} */
  const dualExportDetails = [];
  let dualExportOk = 0;
  for (const id of sampleIds) {
    const describe = packOk(hostCwd, id, "describe");
    const promptShort = packOk(hostCwd, id, "prompt-short");
    const both = describe && promptShort;
    if (both) dualExportOk += 1;
    dualExportDetails.push({ id, describe, promptShort });
    console.error(
      `  dual-export ${id}: describe=${describe} prompt-short=${promptShort}`,
    );
  }

  const total = ids.length;
  const registered = total; // list entries are registered pack sections
  const dualExportSampled = sampleIds.length;

  const sScore = structureScore(
    validateOk,
    listOk,
    total,
    registered,
    firstPassQaOk,
  );
  const cScore = contentScore(dualExportOk, dualExportSampled, total);
  const overall = round4((sScore + cScore) / 2);

  /** @type {Record<string, any>} */
  const pipeline = {
    ...(caseData.pipeline || {}),
    register: {
      attempted: caseData.pipeline?.register?.attempted ?? true,
      ok: listOk && total > 0,
    },
    qa: {
      attempted: true,
      ok: firstPassQaOk,
    },
  };

  const result = {
    caseId: caseData.caseId,
    sourceUrl: caseData.sourceUrl,
    rightsNote: caseData.rightsNote,
    date,
    gitSha: sha,
    scoredAt,
    hostCwd: path.relative(MONO_ROOT, hostCwd).replace(/\\/g, "/") || ".",
    pipelineMode: caseData.pipelineMode ?? null,
    pipeline,
    sections: {
      total,
      registered,
      dualExportOk,
      dualExportSampled,
      ids,
      dualExportDetails,
    },
    compile: {
      firstPassQaOk,
      buildSkipped: true,
      validateOk,
      listOk,
    },
    visual: {
      baselineExists:
        typeof caseData.visual?.baselineExists === "boolean"
          ? caseData.visual.baselineExists || baselineExists(hostCwd)
          : baselineExists(hostCwd),
      visualDiffScore:
        caseData.visual?.visualDiffScore === undefined
          ? null
          : caseData.visual.visualDiffScore,
    },
    human: {
      fixUpMinutes:
        caseData.human?.fixUpMinutes === undefined
          ? null
          : caseData.human.fixUpMinutes,
      notes: caseData.human?.notes ?? "",
    },
    scores: {
      structureScore: sScore,
      contentScore: cScore,
      overall,
    },
    probes: {
      listStatus: listRun.status,
      validateStatus: valRun.status,
      qaStatus: qaRun.status,
    },
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n", "utf8");
  console.error(`  wrote ${outPath}`);
  console.error(
    `  scores structure=${sScore} content=${cScore} overall=${overall}`,
  );

  // Always write results; exit 1 if qa failed
  process.exit(firstPassQaOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
