/**
 * ctrlc scaffold-from-ir --ir path --cwd project
 *
 * Generate React section stubs + home content keys + page.tsx order from Page IR.
 * Optionally hygienizes IR first (when @ctrlc/capture is available).
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import {
  flagString,
  flagBool,
  resolveCwd,
  resolveInputPath,
} from "./args.mjs";

/**
 * @param {import("./args.mjs").ParsedArgs} args
 * @param {Record<string, unknown>} core
 */
export async function cmdScaffoldFromIr(args, core) {
  const flags = args.flags;
  const irRaw = flagString(flags, "ir") ?? args.positionals[0];
  if (!irRaw) {
    console.error(`Usage: ctrlc scaffold-from-ir --ir path/to/ir.json --cwd project

Options:
  --ir <path>         Page IR JSON (required)
  --cwd <path>        Host project root (default: .)
  --dry-run           Plan only; do not write files
  --no-force          Skip existing files instead of overwriting
  --no-hygiene        Do not run IR hygiene before scaffold
  --skip-page         Do not write page.tsx
  --skip-content      Do not write home.ts
  --skip-components   Do not write section components
  --skip-css          Do not patch CSS
  --json              Machine-readable summary
`);
    process.exit(1);
  }

  const cwd = resolveCwd(flags);
  const irPath = resolveInputPath(irRaw, cwd);
  if (!fs.existsSync(irPath)) {
    console.error(`Page IR not found: ${irPath}`);
    process.exit(1);
  }

  const dryRun = flagBool(flags, "dry-run");
  const force = !flagBool(flags, "no-force");
  const noHygiene = flagBool(flags, "no-hygiene");
  const asJson = flagBool(flags, "json");
  const skipPage = flagBool(flags, "skip-page");
  const skipContent = flagBool(flags, "skip-content");
  const skipComponents = flagBool(flags, "skip-components");
  const skipCss = flagBool(flags, "skip-css");

  /** @type {unknown} */
  let ir = JSON.parse(fs.readFileSync(irPath, "utf8"));
  let hygieneNote = null;

  if (!noHygiene) {
    const hygienize = await tryLoadHygienize();
    if (hygienize) {
      const before = Array.isArray(/** @type {{sections?: unknown[]}} */ (ir).sections)
        ? /** @type {{sections: unknown[]}} */ (ir).sections.length
        : 0;
      ir = hygienize(ir);
      const after = Array.isArray(/** @type {{sections?: unknown[]}} */ (ir).sections)
        ? /** @type {{sections: unknown[]}} */ (ir).sections.length
        : 0;
      hygieneNote = `hygiene ${before} → ${after} sections`;
      // Persist hygienized IR next to source when counts change (helps pipeline)
      if (before !== after && !dryRun) {
        const hygPath = irPath.replace(/\.json$/i, ".hygienized.json");
        fs.writeFileSync(hygPath, `${JSON.stringify(ir, null, 2)}\n`, "utf8");
      }
    }
  }

  const writeScaffoldFromIR = await resolveWriteScaffold(core);
  if (typeof writeScaffoldFromIR !== "function") {
    console.error(
      "core.writeScaffoldFromIR missing - rebuild @ctrlc/core (npm run build -w @ctrlc/core)",
    );
    process.exit(1);
  }

  const result = writeScaffoldFromIR(ir, {
    cwd,
    dryRun,
    force,
    skipPage,
    skipContent,
    skipComponents,
    skipCss,
  });

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun,
          cwd,
          ir: irPath,
          hygiene: hygieneNote,
          sections: result.sections.map((s) => ({
            id: s.id,
            export: s.exportName,
            contentKey: s.contentKey,
            component: s.componentRelPath,
          })),
          files: result.files.map((f) => ({
            path: path.relative(cwd, f.path).replace(/\\/g, "/") || f.path,
            kind: f.kind,
            action: f.action,
            bytes: f.bytes,
          })),
          notes: result.notes,
        },
        null,
        2,
      ),
    );
    return 0;
  }

  console.log(`scaffold-from-ir${dryRun ? " (dry-run)" : ""}`);
  console.log(`  cwd:  ${cwd}`);
  console.log(`  ir:   ${irPath}`);
  if (hygieneNote) console.log(`  ${hygieneNote}`);
  console.log(`  sections: ${result.sections.length}`);
  for (const s of result.sections) {
    console.log(`  - ${s.id.padEnd(16)} → ${s.componentRelPath}  (${s.contentKey})`);
  }
  const written = result.files.filter((f) => f.action === "write" || f.action === "patch");
  console.log(`  files: ${written.length} write/patch, ${result.files.length - written.length} skip`);
  for (const n of result.notes) console.log(`  note: ${n}`);
  if (!dryRun) {
    console.log("");
    console.log("Next:");
    console.log("  npm run dev   # in host project");
    console.log("  ctrlc pack <id> --format describe --cwd .");
    console.log("  ctrlc plan-parallel --cwd . --format md");
  }
  return 0;
}

/**
 * @param {Record<string, unknown> | null | undefined} core
 */
async function resolveWriteScaffold(core) {
  if (core && typeof core.writeScaffoldFromIR === "function") {
    return core.writeScaffoldFromIR;
  }
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, "../../core/dist/index.js"),
    path.resolve(process.cwd(), "packages/core/dist/index.js"),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    try {
      const mod = await import(pathToFileURL(p).href);
      if (typeof mod.writeScaffoldFromIR === "function") {
        return mod.writeScaffoldFromIR;
      }
    } catch {
      // try next
    }
  }
  try {
    const mod = await import("@ctrlc/core");
    if (typeof mod.writeScaffoldFromIR === "function") {
      return mod.writeScaffoldFromIR;
    }
  } catch {
    // fall through
  }
  return null;
}

async function tryLoadHygienize() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, "../../capture/dist/index.js"),
    path.resolve(process.cwd(), "packages/capture/dist/index.js"),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    try {
      const mod = await import(pathToFileURL(p).href);
      if (typeof mod.hygienizePageIR === "function") return mod.hygienizePageIR;
    } catch {
      // try next
    }
  }
  try {
    const mod = await import("@ctrlc/capture");
    if (typeof mod.hygienizePageIR === "function") return mod.hygienizePageIR;
  } catch {
    // optional
  }
  return null;
}
