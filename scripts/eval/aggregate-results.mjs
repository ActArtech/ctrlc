/**
 * Aggregate docs/eval/results/*.json into a markdown summary table.
 *
 * Usage:
 *   node scripts/eval/aggregate-results.mjs
 *   node scripts/eval/aggregate-results.mjs --out docs/eval/results/SUMMARY.md
 *   node scripts/eval/aggregate-results.mjs --dir docs/eval/results
 *
 * Prints markdown to stdout. Writes SUMMARY.md by default (unless --no-write).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONO_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_DIR = path.join(MONO_ROOT, "docs/eval/results");
const DEFAULT_OUT = path.join(DEFAULT_DIR, "SUMMARY.md");

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const flags = { write: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dir" || a === "--out") {
      const v = argv[++i];
      if (!v || v.startsWith("--")) throw new Error(`Missing value for ${a}`);
      flags[a.slice(2)] = v;
    } else if (a === "--no-write") {
      flags.write = false;
    } else if (a === "--help" || a === "-h") {
      flags.help = true;
    } else {
      throw new Error(`Unknown arg: ${a}`);
    }
  }
  return flags;
}

/**
 * @param {string} p
 */
function resolvePath(p) {
  return path.isAbsolute(p) ? p : path.resolve(MONO_ROOT, p);
}

/**
 * @param {unknown} n
 */
function fmtScore(n) {
  if (typeof n !== "number" || Number.isNaN(n)) return "-";
  return n.toFixed(2);
}

/**
 * @param {unknown} b
 */
function fmtBool(b) {
  if (b === true) return "yes";
  if (b === false) return "no";
  return "-";
}

function main() {
  let flags;
  try {
    flags = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(String(/** @type {Error} */ (e).message || e));
    process.exit(2);
  }

  if (flags.help) {
    console.log(`aggregate-results.mjs

  --dir <path>   Results directory (default: docs/eval/results)
  --out <path>   Write SUMMARY.md (default: docs/eval/results/SUMMARY.md)
  --no-write     Print only; do not write file
`);
    process.exit(0);
  }

  const dir = resolvePath(
    typeof flags.dir === "string" ? flags.dir : DEFAULT_DIR,
  );
  const outPath = resolvePath(
    typeof flags.out === "string" ? flags.out : DEFAULT_OUT,
  );

  if (!fs.existsSync(dir)) {
    console.error(`Results dir not found: ${dir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !f.endsWith(".tmp"))
    .sort();

  /** @type {Record<string, any>[]} */
  const rows = [];
  for (const f of files) {
    const full = path.join(dir, f);
    try {
      const data = JSON.parse(fs.readFileSync(full, "utf8"));
      rows.push({ file: f, ...data });
    } catch (e) {
      console.error(`Skip ${f}: ${/** @type {Error} */ (e).message}`);
    }
  }

  const lines = [];
  lines.push("# Eval results summary");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Cases: ${rows.length}`);
  lines.push("");

  if (rows.length === 0) {
    lines.push("_No result JSON files found. Run `npm run eval:northline` first._");
    lines.push("");
  } else {
    lines.push(
      "| caseId | date | sections | dualExport | QA | structure | content | overall | fixUp min |",
    );
    lines.push(
      "|--------|------|----------|------------|----|-----------|---------|---------|-----------|",
    );

    let sumOverall = 0;
    let nOverall = 0;

    for (const r of rows) {
      const total = r.sections?.total ?? "-";
      const deOk = r.sections?.dualExportOk;
      const deN = r.sections?.dualExportSampled;
      const dual =
        typeof deOk === "number" && typeof deN === "number"
          ? `${deOk}/${deN}`
          : "-";
      const qa = fmtBool(r.compile?.firstPassQaOk);
      const st = fmtScore(r.scores?.structureScore);
      const ct = fmtScore(r.scores?.contentScore);
      const ov = fmtScore(r.scores?.overall);
      if (typeof r.scores?.overall === "number") {
        sumOverall += r.scores.overall;
        nOverall += 1;
      }
      const fix =
        r.human?.fixUpMinutes === null || r.human?.fixUpMinutes === undefined
          ? "-"
          : String(r.human.fixUpMinutes);

      lines.push(
        `| ${r.caseId ?? r.file} | ${r.date ?? "-"} | ${total} | ${dual} | ${qa} | ${st} | ${ct} | ${ov} | ${fix} |`,
      );
    }

    lines.push("");
    if (nOverall > 0) {
      const mean = Math.round((sumOverall / nOverall) * 10000) / 10000;
      lines.push(`**Mean overall:** ${mean.toFixed(2)} (n=${nOverall})`);
      lines.push("");
    }

    lines.push("## Notes");
    lines.push("");
    for (const r of rows) {
      const note = (r.human?.notes || "").trim();
      if (note) {
        lines.push(`- **${r.caseId ?? r.file}:** ${note}`);
      }
    }
    if (!rows.some((r) => (r.human?.notes || "").trim())) {
      lines.push("_No human notes._");
    }
    lines.push("");
    lines.push("See [METRICS.md](../METRICS.md) for field definitions.");
    lines.push("");
  }

  const md = lines.join("\n");
  process.stdout.write(md);

  if (flags.write !== false) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, md, "utf8");
    console.error(`\nwrote ${outPath}`);
  }
}

main();
