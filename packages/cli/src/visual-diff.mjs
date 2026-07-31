/**
 * ctrlc visual-diff - compare two PNG screenshots for clone QA (F3).
 *
 *   ctrlc visual-diff --baseline a.png --candidate b.png
 *   ctrlc visual-diff --baseline a.png --candidate b.png --out diff.png
 *   ctrlc visual-diff --baseline a.png --candidate b.png --threshold 0.1 --max-ratio 0.01
 *   ctrlc visual-diff --baseline a.png --candidate b.png --json
 *
 * Requires optional peers on @ctrlc/core: pngjs + pixelmatch.
 * Exit 1 when missing deps, file errors, or diff ratio exceeds --max-ratio.
 */

import fs from "node:fs";
import path from "node:path";
import { flagString, flagBool, resolveCwd, resolveInputPath } from "./args.mjs";

/**
 * @param {import("./args.mjs").ParsedArgs} args
 * @param {Record<string, unknown> | null} core
 * @returns {Promise<number>}
 */
export async function cmdVisualDiff(args, core) {
  const cwd = resolveCwd(args.flags);
  const baselineRaw =
    flagString(args.flags, "baseline") ||
    flagString(args.flags, "a") ||
    args.positionals[0];
  const candidateRaw =
    flagString(args.flags, "candidate") ||
    flagString(args.flags, "b") ||
    args.positionals[1];
  const asJson = flagBool(args.flags, "json");
  const outRaw = flagString(args.flags, "out") || flagString(args.flags, "diff");
  const thresholdRaw = flagString(args.flags, "threshold");
  const maxRatioRaw =
    flagString(args.flags, "max-ratio") || flagString(args.flags, "maxRatio");

  if (!baselineRaw || !candidateRaw) {
    printUsage();
    return 1;
  }

  if (!core || typeof core.comparePngFiles !== "function") {
    const msg =
      "comparePngFiles is not available from @ctrlc/core. Rebuild packages/core.";
    if (asJson) {
      console.log(JSON.stringify({ ok: false, message: msg }));
    } else {
      console.error(msg);
    }
    return 1;
  }

  const baselinePath = resolveInputPath(baselineRaw, cwd);
  const candidatePath = resolveInputPath(candidateRaw, cwd);

  /** @type {{ threshold?: number; maxDiffRatio?: number; outDiffPath?: string }} */
  const options = {};

  if (thresholdRaw != null) {
    const t = Number(thresholdRaw);
    if (!Number.isFinite(t) || t < 0 || t > 1) {
      console.error("visual-diff: --threshold must be a number between 0 and 1");
      return 1;
    }
    options.threshold = t;
  }

  if (maxRatioRaw != null) {
    const r = Number(maxRatioRaw);
    if (!Number.isFinite(r) || r < 0 || r > 1) {
      console.error("visual-diff: --max-ratio must be a number between 0 and 1");
      return 1;
    }
    options.maxDiffRatio = r;
  }

  if (outRaw) {
    options.outDiffPath = path.isAbsolute(outRaw)
      ? outRaw
      : path.resolve(cwd, outRaw);
  }

  if (!asJson) {
    console.log(`ctrlc visual-diff`);
    console.log(`  baseline:  ${baselinePath}`);
    console.log(`  candidate: ${candidatePath}`);
    if (options.outDiffPath) console.log(`  out:       ${options.outDiffPath}`);
    if (options.threshold != null) console.log(`  threshold: ${options.threshold}`);
    if (options.maxDiffRatio != null) {
      console.log(`  max-ratio: ${options.maxDiffRatio}`);
    }
  }

  /** @type {import("@ctrlc/core").VisualDiffResult} */
  const result = await core.comparePngFiles(
    baselinePath,
    candidatePath,
    options,
  );

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          ok: result.ok,
          width: result.width,
          height: result.height,
          diffPixels: result.diffPixels,
          totalPixels: result.totalPixels,
          diffRatio: result.diffRatio,
          message: result.message,
          diffPath: result.diffPath ?? null,
          missingDeps: result.missingDeps === true,
          baseline: baselinePath,
          candidate: candidatePath,
        },
        null,
        2,
      ),
    );
  } else {
    if (result.ok) {
      console.log(result.message);
      if (result.diffPath) console.log(`  diff: ${result.diffPath}`);
    } else {
      console.error(result.message);
      if (result.missingDeps) {
        console.error(
          `  Install optional peers (from monorepo root or your app):`,
        );
        console.error(
          `    ${core.VISUAL_DIFF_INSTALL_HINT || "npm i -D pngjs pixelmatch"}`,
        );
      }
      if (result.diffPath) console.error(`  diff: ${result.diffPath}`);
    }
  }

  return result.ok ? 0 : 1;
}

function printUsage() {
  console.error(`ctrlc visual-diff - compare two PNG screenshots (pixel match)

Usage:
  ctrlc visual-diff --baseline <path.png> --candidate <path.png> [options]

Options:
  --baseline <file>     Baseline (expected) PNG (required)
  --candidate <file>    Candidate (actual) PNG (required)
  --out <file>          Write pixel-diff highlight PNG
  --threshold <0-1>     pixelmatch color threshold (default 0.1)
  --max-ratio <0-1>     Fail when diff ratio exceeds this (default 0.01)
  --json                Machine-readable result
  --cwd <dir>           Resolve relative paths (default: process.cwd())

Optional peers (install once for visual QA):
  npm i -D pngjs pixelmatch

Examples:
  ctrlc visual-diff --baseline docs/research/baselines/example-page.png \\
    --candidate runs/rebuild/screenshot.png
  ctrlc visual-diff --baseline a.png --candidate b.png --out diff.png --json
`);
}

export default cmdVisualDiff;
