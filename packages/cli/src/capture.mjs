/**
 * ctrlc capture - single-page recon into Page IR (React rebuild, not HTML dump).
 *
 *   ctrlc capture <url> --out runs/demo
 *   ctrlc capture https://example.com --out runs/example.com
 *
 * Scope: page only (Sprint 2). Requires optional peer playwright for live browser.
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { flagString, flagBool } from "./args.mjs";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Load @ctrlc/capture (workspace name, sibling dist/src, or tsx).
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
 * @param {import("./args.mjs").ParsedArgs} args
 * @returns {Promise<number>}
 */
export async function cmdCapture(args) {
  const url = args.positionals[0];
  if (!url || args.help) {
    printCaptureHelp();
    return url ? 0 : 1;
  }

  const outRaw =
    flagString(args.flags, "out") ??
    flagString(args.flags, "out-dir") ??
    flagString(args.flags, "o");

  const capture = await loadCapture();

  const outDir = outRaw
    ? path.isAbsolute(outRaw)
      ? outRaw
      : path.resolve(process.cwd(), outRaw)
    : capture.defaultRunOutDir(url, process.cwd());

  /** @type {{ width: number, height: number } | undefined} */
  let viewport;
  const vw = flagString(args.flags, "width");
  const vh = flagString(args.flags, "height");
  if (vw || vh) {
    viewport = {
      width: vw ? Number(vw) : 1440,
      height: vh ? Number(vh) : 900,
    };
    if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)) {
      console.error("capture: --width and --height must be numbers");
      return 1;
    }
  }

  const scope =
    flagString(args.flags, "scope") ??
    (flagBool(args.flags, "site") ? "site" : "page");
  if (scope !== "page") {
    console.error(
      `capture: scope "${scope}" is not supported yet (Sprint 2 is page-only). Use --scope page or omit.`,
    );
    return 1;
  }

  console.log(`ctrlc capture`);
  console.log(`  url:    ${url}`);
  console.log(`  out:    ${outDir}`);
  console.log(`  scope:  page`);
  if (viewport) {
    console.log(`  viewport: ${viewport.width}x${viewport.height}`);
  }
  console.log("");

  try {
    const result = await capture.capturePage(url, { outDir, viewport });
    console.log(`Wrote Page IR`);
    console.log(`  ir:         ${result.irPath}`);
    console.log(`  readme:     ${result.readmePath}`);
    if (result.screenshotPath) {
      console.log(`  screenshot: ${result.screenshotPath}`);
    }
    console.log(`  sections:   ${result.ir.sections?.length ?? 0}`);
    console.log(`  fonts:      ${result.ir.tokens?.fonts?.length ?? 0}`);
    console.log(`  colors:     ${result.ir.tokens?.colors?.length ?? 0}`);
    console.log(`  assets:     ${result.ir.assets?.length ?? 0}`);
    console.log("");
    console.log(
      "Next: specs from IR, React sections, ctrlc register / validate (not an HTML dump).",
    );
    return 0;
  } catch (e) {
    const err = /** @type {Error & { code?: string, irPath?: string, readmePath?: string }} */ (
      e
    );
    console.error(String(err?.message ?? err));
    if (err?.irPath) {
      console.error(`\nStub IR written: ${err.irPath}`);
    }
    if (err?.readmePath) {
      console.error(`README: ${err.readmePath}`);
    }
    if (process.env.CTRLC_DEBUG) console.error(err);
    return 1;
  }
}

function printCaptureHelp() {
  console.log(`ctrlc capture - page recon to Page IR (React rebuild)

Usage:
  ctrlc capture <url> [--out <dir>] [--width n] [--height n]

Options:
  --out, -o <dir>   Output directory (default: runs/<host>)
  --width <n>       Viewport width (default 1440)
  --height <n>      Viewport height (default 900)
  --scope page      Only page is supported in Sprint 2 (default)

Examples:
  ctrlc capture https://example.com --out runs/demo
  ctrlc capture https://example.com
  ctrlc capture https://example.com/pricing --out runs/example-pricing

Output (under --out):
  ir.json              Page IR (sections, tokens, assets)
  screenshot.png       Full-page PNG (when Playwright runs; F2 baselines)
  screenshots/full.png Secondary copy of the same screenshot
  README.md            How to use IR for React rebuild

Requires optional peer:
  npm install -D playwright && npx playwright install chromium

Product: SectionPack React rebuild - never an HTML dump.
`);
}
