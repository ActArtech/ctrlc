/**
 * ctrlc qa — validate + list + optional build gate for clone projects.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { flagString, flagBool, resolveCwd, resolveConfigPath } from "./args.mjs";
import { loadSectionPackConfig } from "./load-config.mjs";

/**
 * @param {import("./args.mjs").ParsedArgs} args
 * @param {object} core
 */
export async function cmdQa(args, core) {
  const cwd = resolveCwd(args.flags);
  const skipBuild = flagBool(args.flags, "no-build");
  const asJson = flagBool(args.flags, "json");
  /** @type {{ step: string, ok: boolean, detail?: string }[]} */
  const steps = [];

  // 1) config load
  let config;
  try {
    const loaded = await loadSectionPackConfig({
      cwd,
      configPath: resolveConfigPath(args.flags),
    });
    config = loaded.config;
    steps.push({
      step: "load-config",
      ok: true,
      detail: loaded.source || "ok",
    });
  } catch (e) {
    steps.push({
      step: "load-config",
      ok: false,
      detail: String(/** @type {Error} */ (e).message || e),
    });
    fail(steps, asJson);
    return;
  }

  // 2) merge registry if present
  const regPath = path.join(cwd, ".ctrlc", "registry.json");
  if (fs.existsSync(regPath) && core.mergeSectionRegistry) {
    try {
      const reg = JSON.parse(fs.readFileSync(regPath, "utf8"));
      config = core.mergeSectionRegistry(config, reg);
      steps.push({
        step: "merge-registry",
        ok: true,
        detail: `${reg.sections?.length ?? 0} registry sections`,
      });
    } catch (e) {
      steps.push({
        step: "merge-registry",
        ok: false,
        detail: String(/** @type {Error} */ (e).message || e),
      });
    }
  }

  // 3) validate
  if (core.validateSectionPackConfig) {
    const result = core.validateSectionPackConfig(config, { cwd });
    steps.push({
      step: "validate",
      ok: !!result.ok,
      detail: result.ok
        ? `${config.sections?.length ?? 0} sections`
        : (result.errors || []).join("; "),
    });
    if (!result.ok) {
      fail(steps, asJson);
      return;
    }
  }

  // 4) list pack-able
  const ids = (config.sections || []).map((s) => s.id);
  steps.push({
    step: "list",
    ok: ids.length > 0,
    detail: ids.join(", ") || "(no sections)",
  });

  // 5) optional build
  if (!skipBuild) {
    const pkg = path.join(cwd, "package.json");
    if (fs.existsSync(pkg)) {
      const r = spawnSync(
        process.platform === "win32" ? "npm.cmd" : "npm",
        ["run", "build"],
        { cwd, stdio: "pipe", encoding: "utf8", env: process.env },
      );
      steps.push({
        step: "npm-run-build",
        ok: r.status === 0,
        detail:
          r.status === 0
            ? "build ok"
            : (r.stderr || r.stdout || "").slice(-500),
      });
      if (r.status !== 0) {
        fail(steps, asJson);
        return;
      }
    } else {
      steps.push({
        step: "npm-run-build",
        ok: true,
        detail: "skipped (no package.json)",
      });
    }
  } else {
    steps.push({ step: "npm-run-build", ok: true, detail: "skipped (--no-build)" });
  }

  // 6) F4 light check: existing specs should mention breakpoint matrix (warn only)
  const specsDir = path.join(cwd, "docs", "research", "components");
  if (fs.existsSync(specsDir)) {
    /** @type {string[]} */
    const missing = [];
    let checked = 0;
    for (const name of fs.readdirSync(specsDir)) {
      if (!name.endsWith(".spec.md")) continue;
      checked += 1;
      const text = fs.readFileSync(path.join(specsDir, name), "utf8");
      const hasMatrix =
        /\b390\b/.test(text) && /\b768\b/.test(text) && /\b1440\b/.test(text);
      if (!hasMatrix) missing.push(name);
    }
    if (checked === 0) {
      steps.push({
        step: "breakpoint-matrix",
        ok: true,
        detail: "no .spec.md files",
      });
    } else if (missing.length) {
      steps.push({
        step: "breakpoint-matrix",
        ok: true,
        detail: `warn: ${missing.length}/${checked} spec(s) missing 390/768/1440: ${missing.slice(0, 5).join(", ")}`,
      });
      if (!asJson) {
        console.warn(
          `qa: warn  breakpoint-matrix  ${missing.length} spec(s) lack 390/768/1440 rows`,
        );
      }
    } else {
      steps.push({
        step: "breakpoint-matrix",
        ok: true,
        detail: `${checked} spec(s) mention 390 / 768 / 1440`,
      });
    }
  }

  if (asJson) {
    console.log(JSON.stringify({ ok: true, cwd, ids, steps }, null, 2));
  } else {
    console.log(`qa: PASS (${cwd})`);
    for (const s of steps) {
      console.log(`  ${s.ok ? "ok" : "FAIL"}  ${s.step}${s.detail ? `  ${s.detail}` : ""}`);
    }
    console.log(`\nSections (${ids.length}): ${ids.join(", ")}`);
    console.log(`Dual export smoke:
  ctrlc pack ${ids[0] || "hero"} --format describe --cwd ${cwd}
  ctrlc pack ${ids[0] || "hero"} --format prompt-short --cwd ${cwd}
`);
  }
}

/**
 * @param {{ step: string, ok: boolean, detail?: string }[]} steps
 * @param {boolean} asJson
 */
function fail(steps, asJson) {
  if (asJson) {
    console.log(JSON.stringify({ ok: false, steps }, null, 2));
  } else {
    console.error("qa: FAIL");
    for (const s of steps) {
      console.error(
        `  ${s.ok ? "ok" : "FAIL"}  ${s.step}${s.detail ? `  ${s.detail}` : ""}`,
      );
    }
  }
  process.exit(1);
}
