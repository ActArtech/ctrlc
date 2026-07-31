/**
 * ctrlc specs-from-ir — Page IR JSON → docs/research/components/*.spec.md
 * Also creates/updates docs/research/PAGE_TOPOLOGY.md section table.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { flagString, flagBool, resolveCwd, resolveInputPath } from "./args.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = path.resolve(__dirname, "../../..");

/**
 * Prefer monorepo docs/templates/section.spec.md when present.
 * @returns {string | null}
 */
function resolveDefaultTemplatePath() {
  const candidates = [
    path.join(MONOREPO_ROOT, "docs", "templates", "section.spec.md"),
    path.resolve(process.cwd(), "docs", "templates", "section.spec.md"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * @param {import("./args.mjs").ParsedArgs} args
 * @param {Awaited<ReturnType<import("./cli.mjs")["loadCore"]>>} core
 */
export async function cmdSpecsFromIr(args, core) {
  const cwd = resolveCwd(args.flags);
  const irRaw =
    flagString(args.flags, "ir") ||
    flagString(args.flags, "input") ||
    args.positionals[0];

  if (!irRaw) {
    console.error(`Usage: ctrlc specs-from-ir --ir path/to/ir.json [--cwd project]

Options:
  --ir <file>           Page IR JSON (required)
  --cwd <dir>           Project root (default: process.cwd())
  --out <dir>           Specs directory (default: <cwd>/docs/research/components)
  --template <file>     section.spec.md template override
  --no-topology         Skip PAGE_TOPOLOGY.md create/update
  --topology <file>     Topology path (default: <cwd>/docs/research/PAGE_TOPOLOGY.md)
  --force               Overwrite topology fully (default: merge table)
  --json

Example:
  ctrlc specs-from-ir --ir runs/example.com/ir.json --cwd ../my-clone
`);
    process.exit(1);
  }

  if (typeof core.writeSectionSpecsFromIR !== "function") {
    console.error(
      "writeSectionSpecsFromIR is not available from @ctrlc/core. Rebuild packages/core.",
    );
    process.exit(1);
  }

  const irPath = resolveInputPath(irRaw, cwd);
  if (!fs.existsSync(irPath)) {
    console.error(`Page IR not found: ${irPath}`);
    process.exit(1);
  }

  const outDirRaw =
    flagString(args.flags, "out") ||
    flagString(args.flags, "out-dir") ||
    path.join(cwd, "docs", "research", "components");
  const outDir = path.isAbsolute(outDirRaw)
    ? outDirRaw
    : path.resolve(cwd, outDirRaw);

  const templateFlag = flagString(args.flags, "template");
  const templatePath = templateFlag
    ? path.isAbsolute(templateFlag)
      ? templateFlag
      : path.resolve(cwd, templateFlag)
    : resolveDefaultTemplatePath();

  const skipTopology =
    flagBool(args.flags, "no-topology") || flagBool(args.flags, "skip-topology");
  const topologyRaw =
    flagString(args.flags, "topology") ||
    path.join(cwd, "docs", "research", "PAGE_TOPOLOGY.md");
  const topologyPath = path.isAbsolute(topologyRaw)
    ? topologyRaw
    : path.resolve(cwd, topologyRaw);
  const forceTopology = flagBool(args.flags, "force");
  const asJson = flagBool(args.flags, "json");

  /** @type {import("@ctrlc/core").PageIR} */
  let ir;
  try {
    ir =
      typeof core.loadPageIR === "function"
        ? core.loadPageIR(irPath)
        : JSON.parse(fs.readFileSync(irPath, "utf8"));
  } catch (e) {
    console.error(`Failed to load Page IR: ${String(e?.message ?? e)}`);
    process.exit(1);
  }

  const result = core.writeSectionSpecsFromIR(ir, outDir, {
    templatePath: templatePath || undefined,
    force: true,
  });

  /** @type {{ path: string, created: boolean, sectionCount: number } | null} */
  let topology = null;
  if (!skipTopology && typeof core.writeTopologyFromIR === "function") {
    topology = core.writeTopologyFromIR(ir, {
      topologyPath,
      force: forceTopology,
    });
  }

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          cwd,
          ir: irPath,
          outDir: result.outDir,
          written: result.written.map((w) => ({
            id: w.id,
            label: w.label,
            path: w.path,
            interactionModel: w.interactionModel,
          })),
          skipped: result.skipped,
          topology,
          templatePath: templatePath || null,
        },
        null,
        2,
      ),
    );
    return 0;
  }

  console.log(`specs-from-ir: ${result.written.length} spec(s) under ${result.outDir}`);
  for (const w of result.written) {
    const rel = path.relative(cwd, w.path) || w.path;
    console.log(
      `  ${w.id.padEnd(16)} ${String(w.interactionModel).padEnd(8)} → ${rel}`,
    );
  }
  if (result.skipped.length) {
    console.log(`  skipped: ${result.skipped.join(", ")}`);
  }
  if (topology) {
    const rel = path.relative(cwd, topology.path) || topology.path;
    console.log(
      `topology: ${topology.created ? "created" : "updated"} ${rel} (${topology.sectionCount} sections)`,
    );
  }
  console.log(`
Next:
  - Build React sections under src/components/sections/ (never HTML dumps)
  - ctrlc register-from-spec --cwd ${cwd} --spec docs/research/components/<id>.spec.md
  - ctrlc validate --cwd ${cwd}
`);
  return 0;
}
