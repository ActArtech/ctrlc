/**
 * ctrlc baseline - copy or capture full-page screenshot baselines for visual QA (F2).
 *
 *   ctrlc baseline --ir runs/example.com/ir.json
 *   ctrlc baseline --ir runs/demo/ir.json --out docs/research/baselines/demo-page.png
 *   ctrlc baseline --url https://example.com --cwd .
 *   ctrlc baseline --url https://example.com --out path/to.png --viewport 1440x900
 *
 * Capture writes screenshot.png under the capture outDir (see @ctrlc/capture).
 * Parent wires this module in cli.mjs; do not require Playwright for pure copy path.
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { flagString, resolveCwd, resolveInputPath } from "./args.mjs";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Candidate screenshot names under the IR directory (newest preference first). */
const SCREENSHOT_CANDIDATES = [
  "screenshot.png",
  path.join("screenshots", "full.png"),
  path.join("screenshots", "page.png"),
  "full.png",
];

/**
 * Load @ctrlc/capture (workspace name, sibling dist/src, or tsx).
 * Same resolution strategy as capture.mjs.
 */
async function loadCapture() {
  /** @type {Error[]} */
  const errors = [];

  try {
    return await import("@ctrlc/capture");
  } catch (e) {
    errors.push(/** @type {Error} */ (e));
  }

  const siblingRoot = path.resolve(__dirname, "../../capture");
  const siblingDist = path.join(siblingRoot, "dist/index.js");
  const siblingSrc = path.join(siblingRoot, "src/index.ts");

  if (fs.existsSync(siblingDist)) {
    return import(pathToFileURL(siblingDist).href);
  }

  try {
    const pkg = require.resolve("@ctrlc/capture/package.json");
    const root = path.dirname(pkg);
    const dist = path.join(root, "dist/index.js");
    if (fs.existsSync(dist)) {
      return import(pathToFileURL(dist).href);
    }
    const src = path.join(root, "src/index.ts");
    if (fs.existsSync(src)) {
      const api = await import("tsx/esm/api");
      api.register();
      return import(pathToFileURL(src).href);
    }
  } catch (e) {
    errors.push(/** @type {Error} */ (e));
  }

  if (fs.existsSync(siblingSrc)) {
    try {
      const api = await import("tsx/esm/api");
      api.register();
      return import(pathToFileURL(siblingSrc).href);
    } catch (e) {
      errors.push(/** @type {Error} */ (e));
    }
  }

  throw new Error(
    `Failed to load @ctrlc/capture. Run npm install && npm run build from the monorepo root.\n` +
      errors.map((e) => String(e?.message ?? e)).join("\n"),
  );
}

/**
 * @param {string} dir
 * @returns {string | null}
 */
function findScreenshotInDir(dir) {
  for (const rel of SCREENSHOT_CANDIDATES) {
    const abs = path.join(dir, rel);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      return abs;
    }
  }
  return null;
}

/**
 * Host segment for default baseline filename.
 * @param {string} sourceUrlOrHost
 * @param {(url: string) => string} [hostFromUrl]
 */
function baselineHostSlug(sourceUrlOrHost, hostFromUrl) {
  if (hostFromUrl) {
    try {
      return hostFromUrl(sourceUrlOrHost);
    } catch {
      // fall through
    }
  }
  try {
    const u = new URL(sourceUrlOrHost);
    return (
      u.hostname.replace(/^www\./, "").toLowerCase().replace(/[^a-z0-9._-]+/g, "-") ||
      "page"
    );
  } catch {
    return String(sourceUrlOrHost || "page")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "page";
  }
}

/**
 * Parse --viewport 1440x900 or width/height flags.
 * @param {import("./args.mjs").ParsedArgs} args
 * @returns {{ width: number, height: number } | undefined}
 */
function parseViewport(args) {
  const raw = flagString(args.flags, "viewport");
  if (raw) {
    const m = /^(\d+)\s*[xX,]\s*(\d+)$/.exec(raw.trim());
    if (!m) {
      return /** @type {any} */ ({ error: `Invalid --viewport "${raw}" (use WxH, e.g. 1440x900)` });
    }
    return { width: Number(m[1]), height: Number(m[2]) };
  }
  const vw = flagString(args.flags, "width");
  const vh = flagString(args.flags, "height");
  if (vw || vh) {
    const viewport = {
      width: vw ? Number(vw) : 1440,
      height: vh ? Number(vh) : 900,
    };
    if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)) {
      return /** @type {any} */ ({ error: "--width and --height must be numbers" });
    }
    return viewport;
  }
  return undefined;
}

/**
 * @param {string} src
 * @param {string} dest
 */
function copyScreenshot(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

/**
 * @param {import("./args.mjs").ParsedArgs} args
 * @returns {Promise<number>}
 */
export async function cmdBaseline(args) {
  if (args.help) {
    printBaselineHelp();
    return 0;
  }

  const cwd = resolveCwd(args.flags);
  const url = flagString(args.flags, "url") ?? args.positionals[0] ?? null;
  const irRaw = flagString(args.flags, "ir");
  const outRaw = flagString(args.flags, "out") ?? flagString(args.flags, "o");

  if (!url && !irRaw) {
    printBaselineHelp();
    console.error("\nbaseline: provide --url and/or --ir");
    return 1;
  }

  const viewportParsed = parseViewport(args);
  if (viewportParsed && "error" in viewportParsed) {
    console.error(`baseline: ${viewportParsed.error}`);
    return 1;
  }
  /** @type {{ width: number, height: number } | undefined} */
  const viewport = viewportParsed;

  // --- Path A: --ir + existing screenshot (no Playwright) ---
  if (irRaw && !url) {
    const irPath = resolveInputPath(irRaw, cwd);
    if (!fs.existsSync(irPath)) {
      console.error(`baseline: IR not found: ${irPath}`);
      return 1;
    }

    const irDir = path.dirname(irPath);
    const shot = findScreenshotInDir(irDir);
    if (!shot) {
      console.error(
        `baseline: no screenshot next to IR.\n` +
          `  Looked under: ${irDir}\n` +
          `  Expected one of: ${SCREENSHOT_CANDIDATES.join(", ")}\n` +
          `  Re-run capture, or: ctrlc baseline --url <url> --out ...`,
      );
      return 1;
    }

    let host = "page";
    try {
      const ir = JSON.parse(fs.readFileSync(irPath, "utf8"));
      if (ir?.sourceUrl) {
        host = baselineHostSlug(String(ir.sourceUrl));
      } else {
        host = path.basename(irDir) || "page";
      }
    } catch {
      host = path.basename(irDir) || "page";
    }

    const dest = resolveBaselineOut(outRaw, cwd, host);
    copyScreenshot(shot, dest);
    console.log(`ctrlc baseline`);
    console.log(`  ir:         ${irPath}`);
    console.log(`  screenshot: ${shot}`);
    console.log(`  wrote:      ${dest}`);
    return 0;
  }

  // --- Path B: --url (live capture via @ctrlc/capture) ---
  if (url) {
    let capture;
    try {
      capture = await loadCapture();
    } catch (e) {
      console.error(String(/** @type {Error} */ (e)?.message ?? e));
      return 1;
    }

    const outDir = outRaw && !looksLikePngPath(outRaw)
      ? path.isAbsolute(outRaw)
        ? outRaw
        : path.resolve(cwd, outRaw)
      : capture.defaultRunOutDir(url, cwd);

    console.log(`ctrlc baseline`);
    console.log(`  url:  ${url}`);
    console.log(`  out:  ${outDir}`);
    if (viewport) {
      console.log(`  viewport: ${viewport.width}x${viewport.height}`);
    }
    console.log("");

    try {
      const result = await capture.capturePage(url, { outDir, viewport });
      const shot =
        result.screenshotPath && fs.existsSync(result.screenshotPath)
          ? result.screenshotPath
          : findScreenshotInDir(outDir);

      if (!shot) {
        console.error(
          "baseline: capture finished but no screenshot.png was written (Playwright issue?).",
        );
        if (result.irPath) console.error(`  ir: ${result.irPath}`);
        return 1;
      }

      // If --out is a .png path, also copy into the baselines tree / explicit file.
      if (outRaw && looksLikePngPath(outRaw)) {
        const host = baselineHostSlug(url, capture.hostFromUrl);
        const dest = resolveBaselineOut(outRaw, cwd, host);
        copyScreenshot(shot, dest);
        console.log(`  capture shot: ${shot}`);
        console.log(`  baseline:     ${dest}`);
      } else {
        // Default research baseline when --cwd project layout exists
        const host = baselineHostSlug(url, capture.hostFromUrl);
        const researchBaseline = path.join(
          cwd,
          "docs",
          "research",
          "baselines",
          `${host}-page.png`,
        );
        copyScreenshot(shot, researchBaseline);
        console.log(`  capture shot: ${shot}`);
        console.log(`  baseline:     ${researchBaseline}`);
      }

      if (result.irPath) {
        console.log(`  ir:           ${result.irPath}`);
      }
      return 0;
    } catch (e) {
      const err = /** @type {Error & { code?: string, irPath?: string }} */ (e);
      console.error(String(err?.message ?? err));
      if (err?.code === "PLAYWRIGHT_MISSING") {
        console.error(
          "\nbaseline --url needs Playwright. Or use --ir with an existing screenshot.png.",
        );
      }
      if (process.env.CTRLC_DEBUG) console.error(err);
      return 1;
    }
  }

  printBaselineHelp();
  return 1;
}

/**
 * @param {string | null} outRaw
 * @param {string} cwd
 * @param {string} host
 */
function resolveBaselineOut(outRaw, cwd, host) {
  if (outRaw) {
    const abs = path.isAbsolute(outRaw) ? outRaw : path.resolve(cwd, outRaw);
    if (looksLikePngPath(abs) || path.extname(abs)) {
      return abs;
    }
    // Directory: place <host>-page.png inside
    return path.join(abs, `${host}-page.png`);
  }
  return path.join(cwd, "docs", "research", "baselines", `${host}-page.png`);
}

/** @param {string} p */
function looksLikePngPath(p) {
  return /\.png$/i.test(p);
}

function printBaselineHelp() {
  console.log(`ctrlc baseline - screenshot baselines for visual QA (F2)

Usage:
  ctrlc baseline --ir <path-to-ir.json> [--out <file-or-dir>] [--cwd <dir>]
  ctrlc baseline --url <url> [--out <dir-or-png>] [--cwd <dir>] [--viewport WxH]

Options:
  --ir <path>         Use existing capture dir (screenshot next to ir.json)
  --url <url>         Live capture via @ctrlc/capture (needs Playwright)
  --out, -o <path>    Baseline PNG path, or directory (default under --cwd:
                      docs/research/baselines/<host>-page.png)
  --cwd <dir>         Project root for default baseline path (default: cwd)
  --viewport WxH      Capture viewport (e.g. 1440x900); or --width / --height

Screenshot locations (capture outDir):
  screenshot.png              Canonical full-page PNG (F2)
  screenshots/full.png        Legacy / secondary path (still detected)

Examples:
  ctrlc baseline --ir runs/example.com/ir.json
  ctrlc baseline --ir runs/demo/ir.json --out docs/research/baselines/demo-page.png
  ctrlc baseline --url https://example.com --cwd ./my-clone

Product: baselines for QA compare - not an HTML dump.
`);
}
