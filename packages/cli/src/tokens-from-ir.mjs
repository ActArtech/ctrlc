/**
 * ctrlc tokens-from-ir — Page IR JSON → tokens.css + DESIGN_TOKENS.md
 */

import fs from "node:fs";
import path from "node:path";
import { flagString, flagBool, resolveCwd, resolveInputPath } from "./args.mjs";

/**
 * @param {import("./args.mjs").ParsedArgs} args
 * @param {Awaited<ReturnType<import("./cli.mjs")["loadCore"]>>} core
 */
export async function cmdTokensFromIr(args, core) {
  const cwd = resolveCwd(args.flags);
  const irRaw =
    flagString(args.flags, "ir") ||
    flagString(args.flags, "input") ||
    args.positionals[0];

  if (!irRaw) {
    console.error(`Usage: ctrlc tokens-from-ir --ir path/to/ir.json [--cwd project]

Options:
  --ir <file>           Page IR JSON (required)
  --cwd <dir>           Project root (default: process.cwd())
  --out-dir <dir>       Output directory (default: <cwd>/docs/research)
  --css <file>          CSS path relative to out-dir or absolute (default: tokens.css)
  --md <file>           Markdown filename (default: DESIGN_TOKENS.md)
  --json

Example:
  ctrlc tokens-from-ir --ir runs/example.com/ir.json --cwd . --out-dir docs/research
`);
    process.exit(1);
  }

  if (typeof core.extractTokensFromIR !== "function") {
    console.error(
      "extractTokensFromIR is not available from @ctrlc/core. Rebuild packages/core.",
    );
    process.exit(1);
  }

  const irPath = resolveInputPath(irRaw, cwd);
  if (!fs.existsSync(irPath)) {
    console.error(`Page IR not found: ${irPath}`);
    process.exit(1);
  }

  const outDirRaw =
    flagString(args.flags, "out-dir") ||
    flagString(args.flags, "out") ||
    path.join(cwd, "docs", "research");
  const outDir = path.isAbsolute(outDirRaw)
    ? outDirRaw
    : path.resolve(cwd, outDirRaw);

  const cssFileName = flagString(args.flags, "css") || "tokens.css";
  const mdFileName = flagString(args.flags, "md") || "DESIGN_TOKENS.md";
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

  const write =
    typeof core.writeTokensFromIR === "function"
      ? core.writeTokensFromIR
      : null;

  if (!write) {
    console.error(
      "writeTokensFromIR is not available from @ctrlc/core. Rebuild packages/core.",
    );
    process.exit(1);
  }

  const result = write(ir, {
    outDir,
    cssFileName,
    mdFileName,
  });

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          cwd,
          ir: irPath,
          outDir,
          cssPath: result.cssPath,
          mdPath: result.mdPath,
          colors: result.tokens.colors,
          fonts: result.tokens.fonts,
          cssVariableCount: Object.keys(result.tokens.cssVariables || {}).length,
        },
        null,
        2,
      ),
    );
    return 0;
  }

  const cssRel = path.relative(cwd, result.cssPath) || result.cssPath;
  const mdRel = path.relative(cwd, result.mdPath) || result.mdPath;
  console.log(`tokens-from-ir: wrote tokens under ${outDir}`);
  console.log(`  colors: ${result.tokens.colors.length}`);
  console.log(`  fonts:  ${result.tokens.fonts.length}`);
  console.log(
    `  vars:   ${Object.keys(result.tokens.cssVariables || {}).length}`,
  );
  console.log(`  css:    ${cssRel}`);
  console.log(`  md:     ${mdRel}`);
  console.log(`
Next:
  - Import tokens.css in the host app (e.g. globals.css)
  - Keep DESIGN_TOKENS.md in docs/research for agents
`);
  return 0;
}
