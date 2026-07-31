/**
 * @ctrlc/cli - SectionPack advanced CLI
 *
 * Commands: see help-commands.mjs (COMMAND_HELP_LINES) and printHelp().
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  parseArgs,
  flagString,
  flagBool,
  resolveCwd,
  resolveConfigPath,
} from "./args.mjs";
import { loadSectionPackConfig } from "./load-config.mjs";
import { scanSections } from "./scan.mjs";
import { cmdInitClone } from "./init-clone.mjs";
import { cmdRegister } from "./register.mjs";
import { cmdSpecsFromIr } from "./specs-from-ir.mjs";
import { cmdRegisterFromSpec } from "./register-from-spec.mjs";
import { cmdQa } from "./qa.mjs";
import { cmdCapture } from "./capture.mjs";
import { cmdPipeline } from "./pipeline.mjs";
import { cmdDoctor } from "./doctor.mjs";
import {
  COMMAND_HELP_LINES,
  PIPELINE_COMMANDS,
  EXPERIMENTAL_COMMANDS,
} from "./help-commands.mjs";
import {
  getCommandModule,
  resolveCommandFn,
} from "./command-modules.mjs";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadCore() {
  /** @type {Error[]} */
  const errors = [];

  // 1) Workspace package name (after npm install)
  try {
    return await import("@ctrlc/core");
  } catch (e) {
    errors.push(/** @type {Error} */ (e));
  }

  // 2) Sibling package dist / src (monorepo checkout)
  const siblingRoot = path.resolve(__dirname, "../../core");
  const siblingDist = path.join(siblingRoot, "dist/index.js");
  const siblingSrc = path.join(siblingRoot, "src/index.ts");
  if (fs.existsSync(siblingDist)) {
    return import(pathToFileURL(siblingDist).href);
  }

  // 3) require.resolve + tsx source fallback
  try {
    const corePkg = require.resolve("@ctrlc/core/package.json");
    const coreRoot = path.dirname(corePkg);
    const dist = path.join(coreRoot, "dist/index.js");
    if (fs.existsSync(dist)) {
      return import(pathToFileURL(dist).href);
    }
    const src = path.join(coreRoot, "src/index.ts");
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
    `Failed to load @ctrlc/core. Run npm install && npm run build from the monorepo root.\n` +
      errors.map((e) => String(e?.message ?? e)).join("\n"),
  );
}

/** Default relative dir for pack fingerprints under project cwd. */
const DEFAULT_SNAPSHOTS_DIR = ".ctrlc/snapshots";

/** Default relative dir for section library export under project cwd. */
const DEFAULT_LIBRARY_DIR = ".ctrlc/library";

/**
 * @param {Record<string, string | boolean>} flags
 * @param {string} cwd
 * @returns {string}
 */
function resolveSnapshotsDir(flags, cwd) {
  const raw =
    flagString(flags, "out-dir") ??
    flagString(flags, "snapshots-dir") ??
    flagString(flags, "snapshot-dir");
  if (raw) {
    return path.isAbsolute(raw) ? raw : path.resolve(cwd, raw);
  }
  return path.join(cwd, DEFAULT_SNAPSHOTS_DIR);
}

/**
 * Resolve --out / --out-dir for library export (default: .ctrlc/library).
 * @param {Record<string, string | boolean>} flags
 * @param {string} cwd
 * @returns {string}
 */
function resolveLibraryDir(flags, cwd) {
  const raw =
    flagString(flags, "out") ??
    flagString(flags, "out-dir") ??
    flagString(flags, "library-dir");
  if (raw) {
    return path.isAbsolute(raw) ? raw : path.resolve(cwd, raw);
  }
  return path.join(cwd, DEFAULT_LIBRARY_DIR);
}

/**
 * @param {string} snapshotsDir
 * @param {string} sectionId
 * @param {object} snapshot
 */
function writeSnapshotFile(snapshotsDir, sectionId, snapshot) {
  fs.mkdirSync(snapshotsDir, { recursive: true });
  const abs = path.join(snapshotsDir, `${sectionId}.json`);
  fs.writeFileSync(abs, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  return abs;
}

function printHelp() {
  const commandBlock = COMMAND_HELP_LINES.join("\n");
  console.log(`CtrlC - SectionPack CLI

Usage:
  ctrlc <command> [options]

Commands:
${commandBlock}

Options (most commands):
  --cwd <dir>           Project root (default: process.cwd())
  --config, -c <file>   Config module path (else auto-discover or demo config)
  --format, -f <name>   pack / pack-multi format (describe|prompt|zip|...)
  --recipe <id>         pack-multi: use named recipe section ids (e.g. landing-core)
  --out, -o <file|dir>  pack/graph: output file; library/capture: output dir
  --out-dir <dir>       snapshot / watch: snapshots directory (default: .ctrlc/snapshots)
  --ir <file>           specs-from-ir / experimental IR commands: Page IR JSON path
  --spec <file>         register-from-spec: section.spec.md path
  --snapshot            watch: also write snapshots on rebuild
  --interval <ms>       watch: poll interval for fs.watchFile (default: 400)
  --structure-only      validate: skip filesystem path checks
  --json, -j            Machine-readable JSON (validate, list, snapshot, library, graph)
  --md                  graph: print agent markdown (nodes, edges, mermaid fence)
  --help, -h            Show this help

Examples:
  ctrlc validate --cwd examples/next-demo
  ctrlc list --cwd examples/next-demo --json
  ctrlc pack hero --format describe --cwd examples/next-demo -o hero.md
  ctrlc pack-multi hero,features,cta --format prompt --cwd examples/next-demo
  ctrlc pack-multi --recipe landing-core --format describe --cwd examples/next-demo
  ctrlc graph --cwd examples/next-demo
  ctrlc graph --cwd examples/next-demo --md -o graph.md
  ctrlc graph --cwd examples/next-demo --json
  ctrlc scan --cwd examples/next-demo
  ctrlc snapshot --cwd examples/next-demo
  ctrlc watch --cwd examples/next-demo --snapshot
  ctrlc library --cwd examples/next-demo --out .ctrlc/library
  ctrlc schema > section-pack-config.schema.json
  ctrlc init-clone ../my-clone --url https://example.com
  ctrlc specs-from-ir --ir path/to/ir.json --cwd ../my-clone
  ctrlc register-from-spec --cwd . --spec docs/research/components/hero.spec.md
  ctrlc register hero --cwd . --component src/components/sections/Hero.tsx --export Hero \\
    --content-module src/content/home.ts --content-key hero --css src/styles/demo.css --selector .hero \\
    --interaction scroll --from-spec docs/research/components/hero.spec.md
  ctrlc qa --cwd .
  ctrlc qa --cwd . --skip-build
  ctrlc capture https://example.com --out runs/demo
  ctrlc pipeline --ir runs/demo/ir.json --cwd .
  ctrlc pipeline --url https://example.com --cwd ./my-clone --dry-run
  ctrlc doctor

Notes:
  - Pack formats are React multi-file + natural language (never HTML dumps).
  - init-clone pre-wires SectionPack so every clone can dual-export from day one.
  - register updates .ctrlc/registry.json (merged automatically when loading config).
  - specs-from-ir fills id, label, interaction model, text sample, rebuild guidance from IR.
  - register-from-spec infers id from filename and component path src/components/sections/<Pascal>.tsx.
  - scan is for cloner Phase 3 bootstrap: edit the draft before shipping.
  - snapshot / watch write fingerprints for CI pack drift checks.
  - library writes SectionPack exports under sections/<id>/ (regenerate on demand).
  - graph edges: import, shared-content, shared-css, recipe membership.
  - capture writes runs/<host>/ir.json recon for React rebuild (needs playwright peer).
  - Capture pipeline: materialize-assets, tokens-from-ir, register-from-ir, baseline, plan-parallel, visual-diff.
  - pipeline runs the capture post-process chain (use --dry-run to preview).
  - plan-parallel: emit md/json/sh plan from docs/research/components/*.spec.md (worktrees optional).
  - visual-diff: pixel compare two PNGs (optional peers pngjs + pixelmatch).
  - doctor checks Node, core, capture, optional playwright, demo paths.
  - --ir paths resolve from shell cwd first, then --cwd project root.
`);
}

/**
 * Run a pipeline command from the static command-modules registry.
 * Modules export cmdX (camelCase) or default/run.
 * @param {string} command
 * @param {import("./args.mjs").ParsedArgs} args
 * @param {Awaited<ReturnType<typeof loadCore>> | null} core
 * @returns {Promise<number>}
 */
async function runPipelineCommand(command, args, core) {
  const mod = getCommandModule(command);
  if (!mod) {
    console.error(
      `Command "${command}" is not installed in this CLI build.\n` +
        `See help for capture pipeline commands.`,
    );
    return 1;
  }
  const fn = resolveCommandFn(mod, command);
  if (typeof fn !== "function") {
    console.error(
      `Pipeline module ${command} has no cmd export (cmdX/default/run)`,
    );
    return 1;
  }
  const result = await fn(args, core);
  return typeof result === "number" ? result : 0;
}
/**
 * @param {string} outPath
 * @param {string | Uint8Array | Buffer} data
 * @param {{ binary?: boolean }} [opts]
 */
function writeOut(outPath, data, opts = {}) {
  const abs = path.resolve(outPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  if (opts.binary || Buffer.isBuffer(data) || data instanceof Uint8Array) {
    fs.writeFileSync(abs, data);
  } else {
    fs.writeFileSync(abs, String(data), "utf8");
  }
  return abs;
}

/**
 * @param {import("./args.mjs").ParsedArgs} args
 * @param {Awaited<ReturnType<typeof loadCore>>} core
 */
async function cmdValidate(args, core) {
  const cwd = resolveCwd(args.flags);
  const configPath = resolveConfigPath(args.flags);
  const structureOnly = flagBool(args.flags, "structure-only") || flagBool(args.flags, "no-paths");
  const asJson = flagBool(args.flags, "json");

  const loaded = await loadSectionPackConfig({
    cwd,
    configPath,
    core,
  });

  const checkPaths = !structureOnly;
  const result = core.validateSectionPackConfig(loaded.config, {
    cwd,
    checkPaths,
    requireBehaviorBrief: true,
  });

  const meta = {
    sectionCount: loaded.config.sections?.length ?? 0,
    recipeCount: loaded.config.recipes?.length ?? 0,
    cwd,
    checkPaths,
    configSource: loaded.source,
  };

  if (asJson) {
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
    console.log(`Section pack config validation`);
    console.log(`  sections: ${meta.sectionCount}`);
    console.log(`  recipes:  ${meta.recipeCount}`);
    console.log(`  cwd:      ${meta.cwd}`);
    console.log(`  config:   ${meta.configSource}`);
    console.log(`  paths:    ${checkPaths ? "checked" : "skipped"}`);
    console.log(`  ok:       ${result.ok ? "yes" : "no"}`);
    console.log("");
    if (result.errors.length) {
      console.log(`Errors (${result.errors.length}):`);
      for (const e of result.errors) {
        const where = e.sectionId ? ` [${e.sectionId}]` : "";
        console.log(`  x  ${e.code}${where}: ${e.message}`);
      }
      console.log("");
    }
    if (result.warnings.length) {
      console.log(`Warnings (${result.warnings.length}):`);
      for (const w of result.warnings) {
        const where = w.sectionId ? ` [${w.sectionId}]` : "";
        console.log(`  !  ${w.code}${where}: ${w.message}`);
      }
      console.log("");
    }
    if (result.ok && !result.warnings.length) console.log("All checks passed.");
    else if (result.ok) console.log("Passed with warnings.");
    else console.log("Failed.");
  }

  return result.ok ? 0 : 1;
}

/**
 * @param {import("./args.mjs").ParsedArgs} args
 * @param {Awaited<ReturnType<typeof loadCore>>} core
 */
async function cmdList(args, core) {
  const cwd = resolveCwd(args.flags);
  const configPath = resolveConfigPath(args.flags);
  const asJson = flagBool(args.flags, "json");

  const loaded = await loadSectionPackConfig({ cwd, configPath, core });
  const sections = core.listSectionEntries(loaded.config).map((e) => ({
    id: e.id,
    label: e.label,
    description: e.description,
    tags: e.tags,
    componentPath: e.componentPath,
    componentExport: e.componentExport,
    contentKeys: e.contentKeys,
    cssSelectors: e.cssSelectors,
  }));
  const recipes = (loaded.config.recipes ?? []).map((r) => ({
    id: r.id,
    label: r.label,
    sectionIds: r.sectionIds,
  }));

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          configSource: loaded.source,
          cwd,
          sections,
          recipes,
          ids: sections.map((s) => s.id),
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`SectionPack sections (${sections.length})  config: ${loaded.source}`);
    console.log("");
    for (const s of sections) {
      const tags = s.tags?.length ? `  [${s.tags.join(", ")}]` : "";
      console.log(`  ${s.id.padEnd(16)} ${s.label}${tags}`);
      console.log(`    ${s.componentPath}  export ${s.componentExport}`);
    }
    if (recipes.length) {
      console.log("");
      console.log(`Recipes (${recipes.length}):`);
      for (const r of recipes) {
        console.log(`  ${r.id.padEnd(16)} ${r.label} -> ${r.sectionIds.join(", ")}`);
      }
    }
  }
  return 0;
}

/**
 * @param {import("./args.mjs").ParsedArgs} args
 * @param {Awaited<ReturnType<typeof loadCore>>} core
 */
async function cmdPack(args, core) {
  const cwd = resolveCwd(args.flags);
  const configPath = resolveConfigPath(args.flags);
  const formatRaw = flagString(args.flags, "format") ?? "describe";
  const outPath = flagString(args.flags, "out");

  const sectionId = args.positionals[0];
  if (!sectionId) {
    console.error("pack requires <sectionId>. Example: ctrlc pack hero --format describe");
    return 1;
  }

  const format = core.parseCopyFormat(formatRaw);
  if (!format) {
    console.error(
      `Unknown format "${formatRaw}". Try: describe, prompt, prompt-short, zip, json, component, content, css, template, cursor-rule`,
    );
    return 1;
  }

  const loaded = await loadSectionPackConfig({ cwd, configPath, core });
  const entry = core.getSectionEntry(loaded.config, sectionId);
  if (!entry) {
    const known = core.listSectionIds(loaded.config).join(", ");
    console.error(`Unknown section id "${sectionId}". Known: ${known}`);
    return 1;
  }

  const pack = core.buildSectionPack(entry, loaded.config, { cwd });

  if (format === "zip") {
    if (!outPath) {
      console.error("zip format requires --out <file.zip>");
      return 1;
    }
    const zip = core.buildSectionZip(pack);
    const abs = writeOut(outPath, zip.bytes, { binary: true });
    console.error(`Wrote ${abs} (${zip.byteLength} bytes, ${zip.entryCount} entries)`);
    return 0;
  }

  const text = core.formatPackForCopy(pack, format, null, {
    defaultVariables: loaded.config.defaultVariables,
  });

  if (outPath) {
    const abs = writeOut(outPath, text);
    console.error(`Wrote ${abs} (${Buffer.byteLength(text, "utf8")} bytes, format=${format})`);
  } else {
    process.stdout.write(text.endsWith("\n") ? text : text + "\n");
  }
  return 0;
}

/**
 * @param {import("./args.mjs").ParsedArgs} args
 * @param {Awaited<ReturnType<typeof loadCore>>} core
 */
async function cmdPackMulti(args, core) {
  const cwd = resolveCwd(args.flags);
  const configPath = resolveConfigPath(args.flags);
  const formatRaw = flagString(args.flags, "format") ?? "describe";
  const outPath = flagString(args.flags, "out");
  const recipeId = flagString(args.flags, "recipe");

  const idsRaw = args.positionals[0];
  // --recipe uses config recipe section ids; positional ids optional/ignored when set
  if (!recipeId && !idsRaw) {
    console.error(
      "pack-multi requires comma-separated ids or --recipe <id>.\n" +
        "  Example: ctrlc pack-multi hero,features,cta --format describe\n" +
        "  Example: ctrlc pack-multi --recipe landing-core --format describe --cwd examples/next-demo",
    );
    return 1;
  }

  const format = core.parseMultiFormat(formatRaw);
  if (!format) {
    console.error(
      `Unknown multi format "${formatRaw}". Try: describe, prompt, prompt-short, zip, json`,
    );
    return 1;
  }

  const loaded = await loadSectionPackConfig({ cwd, configPath, core });

  /** @type {ReturnType<typeof core.buildMultiSectionPack>} */
  let multi;
  if (recipeId) {
    const built = core.buildRecipePack(loaded.config, recipeId, { cwd });
    if (built && typeof built === "object" && "error" in built) {
      console.error(built.error);
      if (Array.isArray(built.knownRecipes) && built.knownRecipes.length) {
        console.error(`Known recipes: ${built.knownRecipes.join(", ")}`);
      }
      if (Array.isArray(built.unknownSections) && built.unknownSections.length) {
        console.error(`Unknown sections: ${built.unknownSections.join(", ")}`);
      }
      return 1;
    }
    multi = built;
  } else {
    const rawIds = core.parseIdsParam(idsRaw);
    const check = core.validateMultiSectionIds(loaded.config, rawIds);
    if (!check.ok) {
      console.error(check.error);
      console.error(`Known: ${check.known.join(", ")}`);
      return 1;
    }
    multi = core.buildMultiSectionPack(loaded.config, check.ids, { cwd });
  }

  if (format === "zip") {
    if (!outPath) {
      console.error("zip format requires --out <file.zip>");
      return 1;
    }
    const zip = core.buildMultiSectionZip(multi);
    const abs = writeOut(outPath, zip.bytes, { binary: true });
    console.error(`Wrote ${abs} (${zip.byteLength} bytes, ${zip.entryCount} entries)`);
    return 0;
  }

  const text = core.formatMultiPackForCopy(multi, format, null, {
    defaultVariables: loaded.config.defaultVariables,
  });

  if (outPath) {
    const abs = writeOut(outPath, text);
    console.error(`Wrote ${abs} (${Buffer.byteLength(text, "utf8")} bytes, format=${format})`);
  } else {
    process.stdout.write(text.endsWith("\n") ? text : text + "\n");
  }
  return 0;
}

/**
 * @param {import("./args.mjs").ParsedArgs} args
 */
async function cmdScan(args) {
  const cwd = resolveCwd(args.flags);
  const result = await scanSections({ cwd });

  if (!result.ok) {
    console.error(result.error);
    return 1;
  }

  // Always print draft config JSON to stdout (bootstrap for cloner Phase 3)
  console.log(JSON.stringify(result.draft, null, 2));
  const behaviorNote = result.meta.coreDraft
    ? `${result.meta.behaviorDrafts} with auto behavior drafts`
    : "path-only (core draft helpers unavailable)";
  console.error(
    `scan: ${result.meta.count} section(s) under ${result.meta.sectionsDir} (${behaviorNote}; React-only; edit contentKeys/cssSelectors/behavior before shipping)`,
  );
  return 0;
}

/**
 * Print SectionPackConfig JSON Schema to stdout.
 * @param {Awaited<ReturnType<typeof loadCore>>} core
 */
async function cmdSchema(core) {
  if (typeof core.getConfigSchema !== "function") {
    console.error(
      "getConfigSchema is not available from @ctrlc/core. Rebuild packages/core.",
    );
    return 1;
  }
  const schema = core.getConfigSchema();
  process.stdout.write(JSON.stringify(schema, null, 2) + "\n");
  return 0;
}

/**
 * Section dependency graph (mermaid by default; --json / --md).
 *
 * @param {import("./args.mjs").ParsedArgs} args
 * @param {Awaited<ReturnType<typeof loadCore>>} core
 */
async function cmdGraph(args, core) {
  if (typeof core.buildSectionGraph !== "function") {
    console.error(
      "buildSectionGraph is not available from @ctrlc/core. Rebuild packages/core.",
    );
    return 1;
  }

  const cwd = resolveCwd(args.flags);
  const configPath = resolveConfigPath(args.flags);
  const asJson = flagBool(args.flags, "json");
  const asMd = flagBool(args.flags, "md") || flagBool(args.flags, "markdown");
  const outPath = flagString(args.flags, "out");

  if (asJson && asMd) {
    console.error("graph: use either --json or --md, not both");
    return 1;
  }

  const loaded = await loadSectionPackConfig({ cwd, configPath, core });
  const graph = core.buildSectionGraph(loaded.config, { cwd });

  /** @type {string} */
  let text;
  if (asJson) {
    text = JSON.stringify(
      {
        configSource: loaded.source,
        cwd,
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        nodes: graph.nodes,
        edges: graph.edges,
        mermaid: graph.mermaid,
      },
      null,
      2,
    );
  } else if (asMd) {
    text = core.formatSectionGraphMarkdown(graph);
  } else {
    // Default: mermaid only (agents / docs paste)
    text = graph.mermaid;
  }

  if (outPath) {
    const abs = writeOut(outPath, text.endsWith("\n") ? text : text + "\n");
    console.error(
      `Wrote ${abs} (${graph.nodes.length} nodes, ${graph.edges.length} edges)`,
    );
  } else {
    process.stdout.write(text.endsWith("\n") ? text : text + "\n");
  }

  if (!asJson && !outPath) {
    // Brief summary on stderr so stdout stays pure mermaid/md
    console.error(
      `graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges (config: ${loaded.source})`,
    );
  }

  return 0;
}

/**
 * Build all sections and write SectionPackSnapshot JSON files.
 *
 * @param {import("./args.mjs").ParsedArgs} args
 * @param {Awaited<ReturnType<typeof loadCore>>} core
 */
async function cmdSnapshot(args, core) {
  const cwd = resolveCwd(args.flags);
  const configPath = resolveConfigPath(args.flags);
  const asJson = flagBool(args.flags, "json");
  const snapshotsDir = resolveSnapshotsDir(args.flags, cwd);

  const loaded = await loadSectionPackConfig({ cwd, configPath, core });
  const entries = core.listSectionEntries(loaded.config);

  /** @type {Array<{ id: string, contentHash: string, path: string, byteSizes?: object }>} */
  const results = [];

  for (const entry of entries) {
    const pack = core.buildSectionPack(entry, loaded.config, { cwd });
    const snap = core.snapshotSectionPack(pack);
    const abs = writeSnapshotFile(snapshotsDir, entry.id, snap);
    results.push({
      id: entry.id,
      contentHash: snap.contentHash,
      path: abs,
      byteSizes: snap.byteSizes,
    });
    if (!asJson) {
      const total = snap.byteSizes?.totalFiles ?? "?";
      console.log(
        `  ${entry.id.padEnd(16)} contentHash=${snap.contentHash.slice(0, 12)}...  files=${total}  -> ${path.relative(cwd, abs) || abs}`,
      );
    }
  }

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          cwd,
          configSource: loaded.source,
          snapshotsDir,
          count: results.length,
          snapshots: results.map((r) => ({
            id: r.id,
            contentHash: r.contentHash,
            path: r.path,
          })),
        },
        null,
        2,
      ),
    );
  } else {
    console.log("");
    console.log(
      `snapshot: wrote ${results.length} pack fingerprint(s) under ${snapshotsDir}`,
    );
  }
  return 0;
}

/**
 * Export a section library for agent / offline context.
 *
 * Layout:
 *   library/
 *     index.json
 *     index.md
 *     sections/<id>/
 *       NATURAL_LANGUAGE.md   (format=describe)
 *       CODE_PACK.md          (format=prompt)
 *       meta.json             (snapshot fingerprint)
 *
 * @param {import("./args.mjs").ParsedArgs} args
 * @param {Awaited<ReturnType<typeof loadCore>>} core
 */
async function cmdLibrary(args, core) {
  const cwd = resolveCwd(args.flags);
  const configPath = resolveConfigPath(args.flags);
  const asJson = flagBool(args.flags, "json");
  const libraryDir = resolveLibraryDir(args.flags, cwd);

  const loaded = await loadSectionPackConfig({ cwd, configPath, core });
  const entries = core.listSectionEntries(loaded.config);
  const generatedAt = new Date().toISOString();
  const formatOpts = { defaultVariables: loaded.config.defaultVariables };

  /** @type {Array<{
   *   id: string,
   *   label: string,
   *   tags: string[],
   *   contentHash: string,
   *   paths: { naturalLanguage: string, codePack: string, meta: string }
   * }>} */
  const sections = [];

  fs.mkdirSync(path.join(libraryDir, "sections"), { recursive: true });

  for (const entry of entries) {
    const pack = core.buildSectionPack(entry, loaded.config, { cwd });
    const snap = core.snapshotSectionPack(pack);

    const naturalLanguage = core.formatPackForCopy(pack, "describe", null, formatOpts);
    const codePack = core.formatPackForCopy(pack, "prompt", null, formatOpts);

    const sectionRel = path.join("sections", entry.id);
    const sectionAbs = path.join(libraryDir, sectionRel);
    fs.mkdirSync(sectionAbs, { recursive: true });

    const paths = {
      naturalLanguage: path.join(sectionRel, "NATURAL_LANGUAGE.md").replace(/\\/g, "/"),
      codePack: path.join(sectionRel, "CODE_PACK.md").replace(/\\/g, "/"),
      meta: path.join(sectionRel, "meta.json").replace(/\\/g, "/"),
    };

    fs.writeFileSync(
      path.join(sectionAbs, "NATURAL_LANGUAGE.md"),
      naturalLanguage.endsWith("\n") ? naturalLanguage : naturalLanguage + "\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(sectionAbs, "CODE_PACK.md"),
      codePack.endsWith("\n") ? codePack : codePack + "\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(sectionAbs, "meta.json"),
      JSON.stringify(snap, null, 2) + "\n",
      "utf8",
    );

    sections.push({
      id: entry.id,
      label: entry.label ?? pack.label ?? entry.id,
      tags: [...(entry.tags ?? pack.tags ?? [])],
      contentHash: pack.contentHash,
      paths,
    });

    if (!asJson) {
      console.log(
        `  ${entry.id.padEnd(16)} contentHash=${pack.contentHash.slice(0, 12)}...  -> ${sectionRel}`,
      );
    }
  }

  const index = {
    generatedAt,
    cwd,
    configSource: loaded.source,
    sectionCount: sections.length,
    sections,
  };

  const indexJsonPath = path.join(libraryDir, "index.json");
  fs.writeFileSync(indexJsonPath, JSON.stringify(index, null, 2) + "\n", "utf8");

  const mdLines = [
    `# Section library`,
    ``,
    `Generated: ${generatedAt}`,
    `Sections: ${sections.length}`,
    `Config: ${loaded.source}`,
    ``,
    `SectionPack exports for agent context. Prefer NATURAL_LANGUAGE.md for behavior`,
    `and CODE_PACK.md for multi-file React code as-is (never HTML dumps).`,
    ``,
    `Regenerate:`,
    ``,
    "```bash",
    `ctrlc library --cwd <project> --out ${DEFAULT_LIBRARY_DIR}`,
    "```",
    ``,
    `## Catalog`,
    ``,
  ];

  for (const s of sections) {
    const tagStr = s.tags.length ? ` \`${s.tags.join("`, `")}\`` : "";
    mdLines.push(`### ${s.label} (\`${s.id}\`)`);
    mdLines.push(``);
    mdLines.push(`- **contentHash:** \`${s.contentHash}\``);
    if (tagStr) mdLines.push(`- **tags:**${tagStr}`);
    mdLines.push(`- [Natural language](./${s.paths.naturalLanguage})`);
    mdLines.push(`- [Code pack](./${s.paths.codePack})`);
    mdLines.push(`- [meta.json](./${s.paths.meta})`);
    mdLines.push(``);
  }

  const indexMdPath = path.join(libraryDir, "index.md");
  fs.writeFileSync(indexMdPath, mdLines.join("\n"), "utf8");

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          cwd,
          configSource: loaded.source,
          libraryDir,
          generatedAt,
          sectionCount: sections.length,
          sections: sections.map((s) => ({
            id: s.id,
            label: s.label,
            tags: s.tags,
            contentHash: s.contentHash,
            paths: s.paths,
          })),
          index: {
            json: indexJsonPath,
            md: indexMdPath,
          },
        },
        null,
        2,
      ),
    );
  } else {
    console.log("");
    console.log(
      `library: wrote ${sections.length} section(s) under ${libraryDir}`,
    );
    console.log(`  index: ${path.relative(cwd, indexJsonPath) || indexJsonPath}`);
  }

  return 0;
}

/**
 * Watch section source files; rebuild affected packs on change.
 * Uses Node fs.watchFile (poll) so Windows + missing-file reappear work without chokidar.
 *
 * @param {import("./args.mjs").ParsedArgs} args
 * @param {Awaited<ReturnType<typeof loadCore>>} core
 */
async function cmdWatch(args, core) {
  const cwd = resolveCwd(args.flags);
  const configPath = resolveConfigPath(args.flags);
  const writeSnaps = flagBool(args.flags, "snapshot") || flagBool(args.flags, "snapshots");
  const snapshotsDir = resolveSnapshotsDir(args.flags, cwd);
  const intervalRaw = flagString(args.flags, "interval");
  const interval = Math.max(100, Number(intervalRaw) || 400);

  const loaded = await loadSectionPackConfig({ cwd, configPath, core });
  const entries = core.listSectionEntries(loaded.config);
  if (!entries.length) {
    console.error("watch: no sections in config");
    return 1;
  }

  /** @type {Map<string, Set<string>>} absPath -> section ids */
  const pathToIds = new Map();
  /** @type {Map<string, object>} id -> entry */
  const entryById = new Map();

  for (const entry of entries) {
    entryById.set(entry.id, entry);
    const rels = typeof core.listEntrySourcePaths === "function"
      ? core.listEntrySourcePaths(entry)
      : [
          entry.componentPath,
          entry.contentModulePath,
          entry.cssModulePath,
          ...(entry.relatedPaths ?? []),
        ].filter(Boolean);
    for (const rel of rels) {
      const abs = path.resolve(cwd, rel);
      if (!pathToIds.has(abs)) pathToIds.set(abs, new Set());
      pathToIds.get(abs).add(entry.id);
    }
  }

  const watched = [...pathToIds.keys()];
  console.log(`ctrlc watch`);
  console.log(`  cwd:      ${cwd}`);
  console.log(`  config:   ${loaded.source}`);
  console.log(`  sections: ${entries.length}`);
  console.log(`  files:    ${watched.length}`);
  console.log(`  interval: ${interval}ms`);
  if (writeSnaps) console.log(`  snapshots:${snapshotsDir}`);
  console.log(`  Ctrl+C to stop`);
  console.log("");

  /** @type {Map<string, string>} last contentHash per section */
  const lastHash = new Map();
  /** @type {Set<string>} pending rebuild section ids */
  const pending = new Set();
  let timer = null;
  let rebuilding = false;
  let stopping = false;

  /**
   * @param {string} sectionId
   * @param {{ reason?: string }} [meta]
   */
  function rebuildOne(sectionId, meta = {}) {
    const entry = entryById.get(sectionId);
    if (!entry) return;
    try {
      const pack = core.buildSectionPack(entry, loaded.config, { cwd });
      const prev = lastHash.get(sectionId) ?? null;
      lastHash.set(sectionId, pack.contentHash);
      const changed = prev !== null && prev !== pack.contentHash;
      const status =
        prev === null ? "built" : changed ? "changed" : "unchanged";
      const total = pack.byteSizes?.totalFiles ?? "?";
      const reason = meta.reason ? `  (${meta.reason})` : "";
      console.log(
        `[${new Date().toISOString()}] ${status.padEnd(9)} ${sectionId.padEnd(14)} contentHash=${pack.contentHash}  files=${total}${reason}`,
      );
      if (writeSnaps) {
        const snap = core.snapshotSectionPack(pack);
        const abs = writeSnapshotFile(snapshotsDir, sectionId, snap);
        console.log(`           snapshot -> ${path.relative(cwd, abs) || abs}`);
      }
    } catch (e) {
      console.error(
        `[${new Date().toISOString()}] error     ${sectionId}: ${String(e?.message ?? e)}`,
      );
    }
  }

  function flushPending() {
    if (rebuilding || stopping) return;
    if (!pending.size) return;
    rebuilding = true;
    const ids = [...pending];
    pending.clear();
    for (const id of ids) {
      rebuildOne(id, { reason: "source change" });
    }
    rebuilding = false;
    if (pending.size) {
      timer = setTimeout(flushPending, 50);
    }
  }

  /**
   * @param {string} absPath
   */
  function onFileChange(absPath) {
    if (stopping) return;
    const ids = pathToIds.get(absPath);
    if (!ids) return;
    for (const id of ids) pending.add(id);
    if (timer) clearTimeout(timer);
    timer = setTimeout(flushPending, 120);
  }

  // Initial build of every section so the terminal shows baseline hashes
  for (const entry of entries) {
    rebuildOne(entry.id, { reason: "initial" });
  }
  console.log("");
  console.log("watching...");

  for (const abs of watched) {
    // watchFile polls; works when files appear/disappear and on Windows
    fs.watchFile(abs, { interval, persistent: true }, (curr, prev) => {
      if (stopping) return;
      // Ignore no-op ticks (same mtime + size)
      if (curr.mtimeMs === prev.mtimeMs && curr.size === prev.size) return;
      onFileChange(abs);
    });
  }

  await new Promise((resolve) => {
    const shutdown = (signal) => {
      if (stopping) return;
      stopping = true;
      console.log("");
      console.log(`watch: ${signal} received, stopping...`);
      if (timer) clearTimeout(timer);
      for (const abs of watched) {
        try {
          fs.unwatchFile(abs);
        } catch {
          // ignore
        }
      }
      resolve(undefined);
    };
    process.once("SIGINT", () => shutdown("SIGINT"));
    process.once("SIGTERM", () => shutdown("SIGTERM"));
  });

  console.log("watch: stopped");
  return 0;
}

/**
 * @param {string[]} argv
 * @returns {Promise<number>}
 */
export async function run(argv) {
  const args = parseArgs(argv);

  if (args.help || !args.command || args.command === "help") {
    printHelp();
    return 0;
  }

  try {
    if (args.command === "scan") {
      return await cmdScan(args);
    }

    if (args.command === "init-clone") {
      await cmdInitClone(args);
      return 0;
    }

    if (args.command === "capture") {
      return await cmdCapture(args);
    }

    if (args.command === "pipeline") {
      let core = null;
      try {
        core = await loadCore();
      } catch {
        // tokens/register/specs need core; dry-run and --ir path still work for planning
      }
      return await cmdPipeline(args, core);
    }

    if (args.command === "doctor") {
      return await cmdDoctor(args);
    }

    // Capture-pipeline commands (static registry in command-modules.mjs)
    if (
      PIPELINE_COMMANDS.includes(args.command) ||
      EXPERIMENTAL_COMMANDS.includes(args.command)
    ) {
      let core = null;
      if (getCommandModule(args.command)) {
        try {
          core = await loadCore();
        } catch {
          // some pipeline cmds may work without core (e.g. materialize-assets)
        }
      }
      return await runPipelineCommand(args.command, args, core);
    }

    const core = await loadCore();

    switch (args.command) {
      case "validate":
        return await cmdValidate(args, core);
      case "list":
        return await cmdList(args, core);
      case "pack":
        return await cmdPack(args, core);
      case "pack-multi":
        return await cmdPackMulti(args, core);
      case "graph":
        return await cmdGraph(args, core);
      case "snapshot":
        return await cmdSnapshot(args, core);
      case "watch":
        return await cmdWatch(args, core);
      case "library":
        return await cmdLibrary(args, core);
      case "schema":
        return await cmdSchema(core);
      case "register":
        await cmdRegister(args, core);
        return 0;
      case "specs-from-ir":
        return await cmdSpecsFromIr(args, core);
      case "register-from-spec":
        return await cmdRegisterFromSpec(args, core);
      case "qa":
        await cmdQa(args, core);
        return 0;
      // Pipeline commands: getCommandModule / runPipelineCommand above.
      default:
        console.error(`Unknown command: ${args.command}`);
        printHelp();
        return 1;
    }
  } catch (e) {
    console.error(String(e?.message ?? e));
    if (process.env.CTRLC_DEBUG) console.error(e);
    return 1;
  }
}

// Allow direct: node src/cli.mjs list
const isDirect = (() => {
  if (!process.argv[1]) return false;
  const resolved = path.resolve(process.argv[1]).replace(/\\/g, "/");
  return (
    resolved.endsWith("/cli/src/cli.mjs") ||
    resolved.endsWith("/cli/dist/cli.mjs")
  );
})();

if (isDirect) {
  run(process.argv.slice(2)).then((code) => process.exit(code));
}
