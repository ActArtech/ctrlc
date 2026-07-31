/**
 * ctrlc register-from-ir — Page IR JSON → .ctrlc/registry.json
 */

import fs from "node:fs";
import path from "node:path";
import { flagString, flagBool, resolveCwd, resolveInputPath } from "./args.mjs";

/**
 * @param {import("./args.mjs").ParsedArgs} args
 * @param {Awaited<ReturnType<import("./cli.mjs")["loadCore"]>>} core
 */
export async function cmdRegisterFromIr(args, core) {
  const cwd = resolveCwd(args.flags);
  const irRaw =
    flagString(args.flags, "ir") ||
    flagString(args.flags, "input") ||
    args.positionals[0];

  if (!irRaw) {
    console.error(`Usage: ctrlc register-from-ir --ir path/to/ir.json [--cwd project]

Options:
  --ir <file>              Page IR JSON (required)
  --cwd <dir>              Project root (default: process.cwd())
  --out <file>             Registry path (default: <cwd>/.ctrlc/registry.json)
  --merge                  Merge with existing registry (default: true)
  --no-merge               Replace sections/recipes from IR only
  --component-dir <dir>    default src/components/sections
  --css <path>             default src/styles/clone.css
  --content-module <path>  default src/content/home.ts
  --json

Example:
  ctrlc register-from-ir --ir runs/example.com/ir.json --cwd . --merge
`);
    process.exit(1);
  }

  if (typeof core.writeRegistryFromIR !== "function") {
    console.error(
      "writeRegistryFromIR is not available from @ctrlc/core. Rebuild packages/core.",
    );
    process.exit(1);
  }

  const irPath = resolveInputPath(irRaw, cwd);
  if (!fs.existsSync(irPath)) {
    console.error(`Page IR not found: ${irPath}`);
    process.exit(1);
  }

  const outRaw =
    flagString(args.flags, "out") ||
    path.join(cwd, ".ctrlc", "registry.json");
  const outPath = path.isAbsolute(outRaw)
    ? outRaw
    : path.resolve(cwd, outRaw);

  // merge default true; --no-merge or --merge=false disables
  let merge = true;
  if (flagBool(args.flags, "no-merge")) merge = false;
  else if (args.flags.merge === false || args.flags.merge === "false") {
    merge = false;
  } else if (flagBool(args.flags, "merge")) {
    merge = true;
  }

  const componentDir =
    flagString(args.flags, "component-dir") || "src/components/sections";
  const cssPath =
    flagString(args.flags, "css") || "src/styles/clone.css";
  const contentModulePath =
    flagString(args.flags, "content-module") ||
    flagString(args.flags, "content") ||
    "src/content/home.ts";
  const asJson = flagBool(args.flags, "json");

  const result = core.writeRegistryFromIR(irPath, {
    outPath,
    merge,
    componentDir,
    cssPath,
    contentModulePath,
  });

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          cwd,
          ir: irPath,
          path: result.path,
          sectionIds: result.sectionIds,
          sectionCount: result.sectionIds.length,
          recipes: (result.registry.recipes || []).map((r) => ({
            id: r.id,
            sectionIds: r.sectionIds,
          })),
          merge,
        },
        null,
        2,
      ),
    );
    return 0;
  }

  const regRel = path.relative(cwd, result.path) || result.path;
  console.log(
    `register-from-ir: ${result.sectionIds.length} section(s) → ${regRel}`,
  );
  for (const id of result.sectionIds) {
    console.log(`  ${id}`);
  }
  const recipes = result.registry.recipes || [];
  if (recipes.length) {
    console.log(`recipes: ${recipes.map((r) => r.id).join(", ")}`);
  }
  console.log(`
Next:
  - ctrlc validate --cwd ${cwd}
  - ctrlc pack <id> --format describe --cwd ${cwd}
  - ctrlc pack-multi --recipe landing-core --cwd ${cwd}
`);
  return 0;
}
