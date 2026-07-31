/**
 * Validate a SectionPackConfig (demo by default, or a host config module).
 *
 * Usage:
 *   npm run validate -w @ctrlc/core
 *   tsx scripts/validate-config.mjs
 *   tsx scripts/validate-config.mjs --cwd ../../examples/next-demo
 *   tsx scripts/validate-config.mjs --json
 *   tsx scripts/validate-config.mjs --structure-only
 *   tsx scripts/validate-config.mjs --config ./path/to/config.mjs
 *
 * Exit 0 when ok (warnings allowed), 1 on errors.
 */

import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const out = {
    json: false,
    structureOnly: false,
    cwd: null,
    config: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json" || a === "-j") out.json = true;
    else if (a === "--structure-only" || a === "--no-paths") out.structureOnly = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--cwd" && argv[i + 1]) {
      out.cwd = path.resolve(argv[++i]);
    } else if ((a === "--config" || a === "-c") && argv[i + 1]) {
      out.config = path.resolve(argv[++i]);
    } else if (!a.startsWith("-") && !out.config && !out.cwd) {
      // Positional: module path if extension looks like JS/TS, else project cwd
      const abs = path.resolve(a);
      if (/\.(m?js|cjs|ts|mts|cts)$/i.test(a)) {
        out.config = abs;
      } else {
        out.cwd = abs;
      }
    }
  }
  return out;
}

function printHelp() {
  console.log(`validate-config - SectionPackConfig checker for @ctrlc/core

Usage:
  tsx scripts/validate-config.mjs [options] [configPath|cwd]

Options:
  --cwd <dir>           Project root for path checks (default: process.cwd())
  --config, -c <file>   Load config from module (default export or createDemoSectionPackConfig)
  --structure-only      Skip filesystem path checks
  --json, -j            Print machine-readable JSON report
  --help, -h            Show this help

Exit codes:
  0  no errors (warnings may still print)
  1  validation errors or load failure
`);
}

async function loadCore() {
  const abs = path.join(PKG_ROOT, "src/index.ts");
  return import(pathToFileURL(abs).href);
}

async function loadConfig(core, configPath) {
  if (!configPath) {
    return core.createDemoSectionPackConfig();
  }
  const mod = await import(pathToFileURL(configPath).href);
  if (typeof mod.createDemoSectionPackConfig === "function") {
    return mod.createDemoSectionPackConfig();
  }
  if (typeof mod.default === "function") {
    return mod.default();
  }
  if (mod.default && typeof mod.default === "object" && Array.isArray(mod.default.sections)) {
    return mod.default;
  }
  if (mod.config && Array.isArray(mod.config.sections)) {
    return mod.config;
  }
  if (typeof mod.createSectionPackConfig === "function") {
    return mod.createSectionPackConfig();
  }
  throw new Error(
    `Could not load SectionPackConfig from ${configPath}. Export default config object, default factory, or createDemoSectionPackConfig.`,
  );
}

function formatHuman(result, meta) {
  const lines = [];
  lines.push(`Section pack config validation`);
  lines.push(`  sections: ${meta.sectionCount}`);
  lines.push(`  recipes:  ${meta.recipeCount}`);
  lines.push(`  cwd:      ${meta.cwd}`);
  lines.push(`  paths:    ${meta.checkPaths ? "checked" : "skipped"}`);
  lines.push(`  ok:       ${result.ok ? "yes" : "no"}`);
  lines.push("");

  if (result.errors.length) {
    lines.push(`Errors (${result.errors.length}):`);
    for (const e of result.errors) {
      const where = e.sectionId ? ` [${e.sectionId}]` : "";
      lines.push(`  x  ${e.code}${where}: ${e.message}`);
    }
    lines.push("");
  }

  if (result.warnings.length) {
    lines.push(`Warnings (${result.warnings.length}):`);
    for (const w of result.warnings) {
      const where = w.sectionId ? ` [${w.sectionId}]` : "";
      lines.push(`  !  ${w.code}${where}: ${w.message}`);
    }
    lines.push("");
  }

  if (result.ok && !result.warnings.length) {
    lines.push("All checks passed.");
  } else if (result.ok) {
    lines.push("Passed with warnings.");
  } else {
    lines.push("Failed.");
  }

  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  let core;
  try {
    core = await loadCore();
  } catch (e) {
    console.error("Failed to load @ctrlc/core sources.");
    console.error(e);
    process.exit(1);
  }

  let config;
  try {
    config = await loadConfig(core, args.config);
  } catch (e) {
    console.error(String(e?.message ?? e));
    process.exit(1);
  }

  const cwd = args.cwd ?? process.cwd();
  const checkPaths = !args.structureOnly;

  const result = core.validateSectionPackConfig(config, {
    cwd,
    checkPaths,
    requireBehaviorBrief: true,
  });

  const meta = {
    sectionCount: config.sections?.length ?? 0,
    recipeCount: config.recipes?.length ?? 0,
    cwd,
    checkPaths,
    configSource: args.config ?? "createDemoSectionPackConfig()",
  };

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          ok: result.ok,
          errors: result.errors,
          warnings: result.warnings,
          meta,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(formatHuman(result, meta));
  }

  process.exit(result.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
