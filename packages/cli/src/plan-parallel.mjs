/**
 * ctrlc plan-parallel - emit parallel section build plan from *.spec.md (C5).
 *
 *   ctrlc plan-parallel --cwd .
 *   ctrlc plan-parallel --cwd . --format json
 *   ctrlc plan-parallel --cwd . --format sh -o plan.sh
 *   ctrlc plan-parallel --cwd . --specs-dir docs/research/components --max-agents 4
 *
 * Does not run git worktree; sh format only documents optional worktree lines.
 */

import fs from "node:fs";
import path from "node:path";
import { flagString, flagBool, resolveCwd } from "./args.mjs";

const DEFAULT_SPECS_REL = "docs/research/components";

/**
 * @param {import("./args.mjs").ParsedArgs} args
 * @param {object} [core]
 * @returns {Promise<number>}
 */
export async function cmdPlanParallel(args, core) {
  if (args.help) {
    printPlanParallelHelp();
    return 0;
  }

  if (!core || typeof core.buildParallelPlan !== "function") {
    console.error(
      "plan-parallel: buildParallelPlan is not available from @ctrlc/core. Rebuild packages/core.",
    );
    return 1;
  }

  const cwd = resolveCwd(args.flags);
  const specsRel =
    flagString(args.flags, "specs-dir") ??
    flagString(args.flags, "specsDir") ??
    DEFAULT_SPECS_REL;
  const specsDir = path.isAbsolute(specsRel)
    ? specsRel
    : path.resolve(cwd, specsRel);

  const maxRaw =
    flagString(args.flags, "max-agents") ??
    flagString(args.flags, "maxAgents") ??
    flagString(args.flags, "max");
  let maxAgents = 4;
  if (maxRaw != null && maxRaw !== "") {
    const n = Number(maxRaw);
    if (!Number.isFinite(n) || n < 1) {
      console.error(`plan-parallel: invalid --max-agents "${maxRaw}" (use a positive integer)`);
      return 1;
    }
    maxAgents = Math.floor(n);
  }

  const formatRaw = (
    flagString(args.flags, "format") ??
    (flagBool(args.flags, "json") ? "json" : null) ??
    "md"
  )
    .toLowerCase()
    .trim();
  /** @type {"json" | "md" | "sh"} */
  let format = "md";
  if (formatRaw === "json" || formatRaw === "md" || formatRaw === "sh") {
    format = formatRaw;
  } else if (formatRaw === "markdown") {
    format = "md";
  } else if (formatRaw === "shell" || formatRaw === "bash") {
    format = "sh";
  } else {
    console.error(
      `plan-parallel: unknown --format "${formatRaw}". Use json | md | sh`,
    );
    return 1;
  }

  const outPath =
    flagString(args.flags, "out") ?? flagString(args.flags, "o") ?? null;

  if (!fs.existsSync(specsDir)) {
    console.error(
      `plan-parallel: specs directory not found: ${specsDir}\n` +
        `  Create docs/research/components/<id>.spec.md first (specs-from-ir or template).`,
    );
    return 1;
  }

  let plan;
  try {
    plan = core.buildParallelPlan({
      specsDir,
      cwd,
      maxAgents,
    });
  } catch (e) {
    console.error(`plan-parallel: ${String(/** @type {Error} */ (e)?.message ?? e)}`);
    return 1;
  }

  const text =
    typeof core.formatParallelPlan === "function"
      ? core.formatParallelPlan(plan, format)
      : format === "json"
        ? JSON.stringify(plan, null, 2)
        : format === "sh" && typeof core.formatParallelPlanShell === "function"
          ? core.formatParallelPlanShell(plan)
          : typeof core.formatParallelPlanMarkdown === "function"
            ? core.formatParallelPlanMarkdown(plan)
            : JSON.stringify(plan, null, 2);

  const body = text.endsWith("\n") ? text : text + "\n";

  if (outPath) {
    const abs = path.isAbsolute(outPath) ? outPath : path.resolve(cwd, outPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body, "utf8");
    console.error(
      `plan-parallel: wrote ${abs} (${plan.sections.length} section(s), ${plan.batches.length} batch(es), format=${format})`,
    );
  } else {
    process.stdout.write(body);
    if (format !== "json") {
      console.error(
        `plan-parallel: ${plan.sections.length} section(s), ${plan.batches.length} batch(es), maxAgents=${plan.maxAgents}`,
      );
    }
  }

  return 0;
}

function printPlanParallelHelp() {
  console.log(`ctrlc plan-parallel - parallel section build plan from *.spec.md (C5)

Usage:
  ctrlc plan-parallel --cwd . [--specs-dir docs/research/components]
  ctrlc plan-parallel --cwd . --format json|md|sh [--out file] [--max-agents 4]

Options:
  --cwd <dir>              Project root (default: process.cwd())
  --specs-dir <dir>        Specs directory (default: docs/research/components)
  --format, -f <name>      json | md | sh (default: md)
  --out, -o <file>         Write plan to file (default: stdout)
  --max-agents <n>         Concurrent builders per batch (default: 4)
  --json                   Shortcut for --format json
  --help, -h               This help

Formats:
  md    Checklist of sections + link to section-builder.prompt.md
  sh    Optional git worktree comments + echo per section (does not run worktrees)
  json  Machine-readable sections + batches

Examples:
  ctrlc plan-parallel --cwd .
  ctrlc plan-parallel --cwd . --format json -o .ctrlc/parallel-plan.json
  ctrlc plan-parallel --cwd . --format sh -o .ctrlc/parallel-plan.sh
  ctrlc plan-parallel --cwd . --max-agents 2

Product: dispatch plan for React section builders - never HTML dumps.
`);
}
