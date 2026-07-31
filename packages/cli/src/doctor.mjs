/**
 * ctrlc doctor - light environment / monorepo health check.
 *
 *   ctrlc doctor
 *   ctrlc doctor --json
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { flagBool, resolveCwd } from "./args.mjs";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = path.resolve(__dirname, "../../..");

/**
 * @typedef {{
 *   id: string,
 *   ok: boolean,
 *   level: "info" | "warn" | "error",
 *   detail: string,
 * }} DoctorCheck
 */

/**
 * @returns {Promise<{ ok: boolean, checks: DoctorCheck[] }>}
 */
async function runChecks() {
  /** @type {DoctorCheck[]} */
  const checks = [];

  // Node version
  const major = Number(process.versions.node.split(".")[0]);
  const nodeOk = Number.isFinite(major) && major >= 20;
  checks.push({
    id: "node",
    ok: nodeOk,
    level: nodeOk ? "info" : "error",
    detail: nodeOk
      ? `Node ${process.versions.node} (>=20 required)`
      : `Node ${process.versions.node} is below 20; upgrade to Node 20+`,
  });

  // @ctrlc/core
  let coreOk = false;
  let coreDetail = "";
  try {
    const core = await import("@ctrlc/core");
    coreOk = typeof core === "object" && core != null;
    coreDetail = "@ctrlc/core loaded";
  } catch {
    const siblingDist = path.join(MONOREPO_ROOT, "packages/core/dist/index.js");
    if (fs.existsSync(siblingDist)) {
      try {
        await import(pathToFileURL(siblingDist).href);
        coreOk = true;
        coreDetail = `@ctrlc/core via ${siblingDist}`;
      } catch (e) {
        coreDetail = `core dist present but failed to load: ${String(/** @type {Error} */ (e)?.message ?? e)}`;
      }
    } else {
      coreDetail =
        "@ctrlc/core not loadable (run npm install && npm run build)";
    }
  }
  checks.push({
    id: "core",
    ok: coreOk,
    level: coreOk ? "info" : "error",
    detail: coreDetail,
  });

  // @ctrlc/capture
  let captureOk = false;
  let captureDetail = "";
  try {
    await import("@ctrlc/capture");
    captureOk = true;
    captureDetail = "@ctrlc/capture loaded";
  } catch {
    const siblingDist = path.join(MONOREPO_ROOT, "packages/capture/dist/index.js");
    if (fs.existsSync(siblingDist)) {
      try {
        await import(pathToFileURL(siblingDist).href);
        captureOk = true;
        captureDetail = `@ctrlc/capture via ${siblingDist}`;
      } catch (e) {
        captureDetail = `capture dist present but failed to load: ${String(/** @type {Error} */ (e)?.message ?? e)}`;
      }
    } else {
      captureDetail =
        "@ctrlc/capture not loadable (run npm install && npm run build)";
    }
  }
  checks.push({
    id: "capture",
    ok: captureOk,
    level: captureOk ? "info" : "warn",
    detail: captureDetail,
  });

  // Playwright optional peer
  let playwrightOk = false;
  let playwrightDetail = "";
  try {
    require.resolve("playwright");
    playwrightOk = true;
    playwrightDetail = "playwright package resolved (live capture available)";
  } catch {
    try {
      require.resolve("playwright/package.json");
      playwrightOk = true;
      playwrightDetail = "playwright package resolved";
    } catch {
      playwrightOk = false;
      playwrightDetail =
        "playwright not installed (optional; needed for ctrlc capture --url)";
    }
  }
  checks.push({
    id: "playwright",
    ok: playwrightOk,
    level: "info",
    detail: playwrightDetail,
  });

  // Demo / template paths (monorepo layout)
  const demoPath = path.join(MONOREPO_ROOT, "examples/next-demo");
  const demoOk = fs.existsSync(demoPath);
  checks.push({
    id: "demo",
    ok: demoOk,
    level: demoOk ? "info" : "warn",
    detail: demoOk
      ? `examples/next-demo present`
      : `examples/next-demo missing under monorepo root`,
  });

  const cloneTpl = path.join(MONOREPO_ROOT, "examples/clone-template");
  const cloneOk = fs.existsSync(cloneTpl);
  checks.push({
    id: "clone-template",
    ok: cloneOk,
    level: cloneOk ? "info" : "warn",
    detail: cloneOk
      ? "examples/clone-template present"
      : "examples/clone-template missing",
  });

  const sampleIr = path.join(
    MONOREPO_ROOT,
    "packages/capture/fixtures/sample-ir.json",
  );
  const sampleOk = fs.existsSync(sampleIr);
  checks.push({
    id: "sample-ir",
    ok: sampleOk,
    level: sampleOk ? "info" : "warn",
    detail: sampleOk
      ? "packages/capture/fixtures/sample-ir.json present"
      : "sample-ir fixture missing",
  });

  // pipeline module present
  const pipelineMod = path.join(__dirname, "pipeline.mjs");
  const pipeOk = fs.existsSync(pipelineMod);
  checks.push({
    id: "pipeline",
    ok: pipeOk,
    level: pipeOk ? "info" : "warn",
    detail: pipeOk
      ? "pipeline command module present"
      : "pipeline.mjs missing",
  });

  const hardFail = checks.some((c) => !c.ok && c.level === "error");
  return { ok: !hardFail, checks };
}

/**
 * @param {import("./args.mjs").ParsedArgs} args
 * @returns {Promise<number>}
 */
export async function cmdDoctor(args) {
  if (args.help) {
    console.log(`ctrlc doctor - environment health check

Usage:
  ctrlc doctor [--json] [--cwd <dir>]

Checks:
  - Node.js >= 20
  - @ctrlc/core load
  - @ctrlc/capture load
  - playwright optional peer
  - monorepo demo / fixture paths

Options:
  --json     Machine-readable summary
  --cwd      Noted in output only (checks are monorepo-oriented)
`);
    return 0;
  }

  const cwd = resolveCwd(args.flags);
  const asJson = flagBool(args.flags, "json");
  const { ok, checks } = await runChecks();

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          ok,
          cwd,
          node: process.versions.node,
          monorepoRoot: MONOREPO_ROOT,
          checks,
        },
        null,
        2,
      ),
    );
    return ok ? 0 : 1;
  }

  console.log("ctrlc doctor");
  console.log(`  cwd:      ${cwd}`);
  console.log(`  monorepo: ${MONOREPO_ROOT}`);
  console.log("");
  for (const c of checks) {
    const mark = c.ok ? "ok  " : c.level === "error" ? "FAIL" : "warn";
    console.log(`  ${mark}  ${c.id.padEnd(16)} ${c.detail}`);
  }
  console.log("");
  console.log(ok ? "doctor: healthy" : "doctor: issues found (see FAIL above)");
  return ok ? 0 : 1;
}
