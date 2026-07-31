/**
 * ctrlc materialize-assets - download Page IR assets[] to a local dir.
 *
 *   ctrlc materialize-assets --ir runs/demo/ir.json
 *   ctrlc materialize-assets --ir ir.json --out public/ctrlc-assets
 *   ctrlc materialize-assets --ir ir.json --public public --dry-run
 *
 * Parent wires this into cli.mjs. Uses Node 20+ fetch via @ctrlc/capture.
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
export async function cmdMaterializeAssets(args) {
  if (args.help) {
    printHelp();
    return 0;
  }

  const irRaw =
    flagString(args.flags, "ir") ||
    flagString(args.flags, "input") ||
    args.positionals[0];

  if (!irRaw) {
    printHelp();
    return 1;
  }

  const irPath = path.isAbsolute(irRaw)
    ? irRaw
    : path.resolve(process.cwd(), irRaw);

  if (!fs.existsSync(irPath)) {
    console.error(`Page IR not found: ${irPath}`);
    return 1;
  }

  // --out or --public (dir); default <cwd>/public/ctrlc-assets
  const outFlag =
    flagString(args.flags, "out") ||
    flagString(args.flags, "out-dir") ||
    flagString(args.flags, "o");
  const publicFlag = flagString(args.flags, "public");

  let outDir;
  if (outFlag) {
    outDir = path.isAbsolute(outFlag)
      ? outFlag
      : path.resolve(process.cwd(), outFlag);
  } else if (publicFlag) {
    const pub = path.isAbsolute(publicFlag)
      ? publicFlag
      : path.resolve(process.cwd(), publicFlag);
    // If user passed project public/, nest ctrlc-assets; if already a leaf, use as-is
    outDir = path.basename(pub) === "public"
      ? path.join(pub, "ctrlc-assets")
      : pub;
  } else {
    outDir = path.resolve(process.cwd(), "public", "ctrlc-assets");
  }

  const dryRun = flagBool(args.flags, "dry-run") || flagBool(args.flags, "dryRun");
  const overwrite =
    flagBool(args.flags, "overwrite") || flagBool(args.flags, "in-place");
  const noFriendly = flagBool(args.flags, "no-friendly");

  // Friendly public copies: --public-dir or default project public/ next to IR / cwd
  const publicDirFlag =
    flagString(args.flags, "public-dir") ||
    flagString(args.flags, "publicDir");
  /** @type {string | undefined} */
  let publicDir;
  if (publicDirFlag) {
    publicDir = path.isAbsolute(publicDirFlag)
      ? publicDirFlag
      : path.resolve(process.cwd(), publicDirFlag);
  } else if (publicFlag) {
    // --public path/to/public already resolved partially above
    const pub = path.isAbsolute(publicFlag)
      ? publicFlag
      : path.resolve(process.cwd(), publicFlag);
    publicDir = path.basename(pub) === "public" ? pub : path.join(pub, "public");
  } else {
    // Default: <cwd>/public when materializing into a clone project
    const guess = path.resolve(process.cwd(), "public");
    if (fs.existsSync(guess) || !noFriendly) {
      publicDir = guess;
    }
  }

  const outIrFlag = flagString(args.flags, "out-ir") || flagString(args.flags, "outIr");
  /** @type {string | undefined} */
  let outIrPath;
  if (outIrFlag) {
    outIrPath = path.isAbsolute(outIrFlag)
      ? outIrFlag
      : path.resolve(process.cwd(), outIrFlag);
  } else if (overwrite) {
    outIrPath = irPath;
  }
  // else: materializeAssetsFromFile default -> ir.materialized.json

  const concurrencyRaw = flagString(args.flags, "concurrency");
  const concurrency = concurrencyRaw ? Number(concurrencyRaw) : undefined;
  if (concurrencyRaw && !Number.isFinite(concurrency)) {
    console.error("materialize-assets: --concurrency must be a number");
    return 1;
  }

  const timeoutRaw = flagString(args.flags, "timeout");
  const timeoutMs = timeoutRaw ? Number(timeoutRaw) : undefined;
  if (timeoutRaw && !Number.isFinite(timeoutMs)) {
    console.error("materialize-assets: --timeout must be a number (ms)");
    return 1;
  }

  console.log(`ctrlc materialize-assets`);
  console.log(`  ir:     ${irPath}`);
  console.log(`  out:    ${outDir}`);
  if (publicDir && !noFriendly) {
    console.log(`  public: ${publicDir} (logo/hero friendly copies)`);
  }
  console.log(`  dryRun: ${dryRun ? "yes" : "no"}`);
  console.log("");

  try {
    const capture = await loadCapture();
    if (typeof capture.materializeAssetsFromFile !== "function") {
      console.error(
        "materializeAssetsFromFile is not available from @ctrlc/capture. Rebuild packages/capture.",
      );
      return 1;
    }

    const result = await capture.materializeAssetsFromFile(irPath, {
      outDir,
      dryRun,
      rewriteIr: true,
      concurrency,
      timeoutMs,
      outIrPath,
      publicDir: noFriendly ? undefined : publicDir,
      friendlyPublic: !noFriendly && Boolean(publicDir),
    });

    const ok = result.written.filter((w) => w.ok).length;
    const failed = result.written.filter((w) => !w.ok).length;
    const rewritten = result.written.filter((w) => w.rewritten).length;

    console.log(
      `Assets: ${result.written.length} total, ${ok} ok, ${failed} failed` +
        (rewritten ? `, ${rewritten} Next image URLs rewritten` : ""),
    );
    for (const w of result.written) {
      const mark = w.ok ? "ok  " : "FAIL";
      const err = w.error ? ` (${w.error})` : "";
      const rew = w.rewritten ? " [next→src]" : "";
      const pub = w.publicPath ? ` → public/${w.publicPath}` : "";
      console.log(`  ${mark}  ${w.localPath}${rew}${pub}${err}`);
    }
    if (result.publicCopies?.length) {
      console.log("");
      console.log(`Friendly public copies: ${result.publicCopies.length}`);
      for (const c of result.publicCopies) {
        console.log(`  ${c.role.padEnd(8)} ${c.to}`);
      }
    }

    if (!dryRun) {
      const writtenIr =
        outIrPath ??
        path.join(
          path.dirname(irPath),
          `${path.basename(irPath, path.extname(irPath))}.materialized.json`,
        );
      console.log("");
      console.log(`IR written: ${writtenIr}`);
      console.log(`Files dir:  ${result.outDir}`);
    } else {
      console.log("");
      console.log("(dry-run: no files or IR written)");
    }

    // Non-zero only if all failed and there were assets
    if (result.written.length > 0 && ok === 0) {
      return 1;
    }
    return 0;
  } catch (e) {
    const err = /** @type {Error} */ (e);
    console.error(String(err?.message ?? err));
    if (process.env.CTRLC_DEBUG) console.error(err);
    return 1;
  }
}

function printHelp() {
  console.log(`ctrlc materialize-assets - download Page IR assets to disk

Usage:
  ctrlc materialize-assets --ir <path> [--out <dir>] [--out-ir <path>]
  ctrlc materialize-assets --ir <path> --public public
  ctrlc materialize-assets --ir <path> --public-dir ./public
  ctrlc materialize-assets --ir <path> --dry-run

Options:
  --ir <file>           Page IR JSON (required)
  --out, -o <dir>       Hashed assets dir (default: <cwd>/public/ctrlc-assets)
  --public <dir>        Project public/ dir; hashed files under <dir>/ctrlc-assets
                        when basename is "public"; also enables friendly copies
  --public-dir <dir>    Copy logo/hero/favicon/og into this public root with
                        friendly names (logos/logo.png, images/hero.webp)
  --no-friendly         Skip friendly public copies
  --out-ir <file>       Write updated IR here (default: <ir>.materialized.json)
  --overwrite           Overwrite original IR (writes .bak first)
  --dry-run             Compute localPath names only; no download / no IR write
  --concurrency <n>     Parallel downloads (default 4)
  --timeout <ms>        Per-request timeout (default 30000)

Also:
  - Unwraps Next.js /_next/image?url=… to the real source when possible
  - Prefers real extensions (path, Content-Type, magic bytes) over .bin

Examples:
  ctrlc materialize-assets --ir runs/demo/ir.json --public-dir ./public
  ctrlc materialize-assets --ir runs/demo/ir.json --out runs/demo/assets
  ctrlc materialize-assets --ir ir.json --public ./public --overwrite

Product: local assets for React rebuild - not an HTML dump.
`);
}
