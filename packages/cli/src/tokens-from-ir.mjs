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
  --max-colors <n>      Curated palette size (default 12)
  --max-fonts <n>       Curated font families (default 4)
  --max-palette <n>     Extra --ts-palette-N vars (default 8)
  --prefix <id>         CSS var prefix without dashes (default ts -> --ts-bg)
  --legacy-pc           Also emit legacy --pc-color-N / --pc-font-* dumps
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
  const maxColorsRaw = flagString(args.flags, "max-colors");
  const maxFontsRaw = flagString(args.flags, "max-fonts");
  const maxPaletteRaw = flagString(args.flags, "max-palette");
  const prefix = flagString(args.flags, "prefix") || undefined;
  const includeLegacyPc = flagBool(args.flags, "legacy-pc");

  const parseN = (raw, label) => {
    if (raw == null || raw === "") return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      console.error(`Invalid ${label}: ${raw}`);
      process.exit(1);
    }
    return Math.floor(n);
  };
  const maxColors = parseN(maxColorsRaw, "--max-colors");
  const maxFonts = parseN(maxFontsRaw, "--max-fonts");
  const maxPaletteVars = parseN(maxPaletteRaw, "--max-palette");

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
    maxColors,
    maxFonts,
    maxPaletteVars,
    prefix,
    includeLegacyPc,
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
          semantic: result.tokens.semantic,
          theme: result.tokens.theme,
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
  const sem = result.tokens.semantic || {};
  console.log(`tokens-from-ir: curated tokens under ${outDir}`);
  console.log(`  theme:  ${result.tokens.theme || "unknown"}`);
  console.log(`  colors: ${result.tokens.colors.length}`);
  console.log(`  fonts:  ${result.tokens.fonts.length}`);
  console.log(
    `  vars:   ${Object.keys(result.tokens.cssVariables || {}).length}`,
  );
  if (sem.bg || sem.accent) {
    console.log(`  roles:  bg=${sem.bg || "?"} accent=${sem.accent || "?"}`);
  }
  console.log(`  css:    ${cssRel}`);
  console.log(`  md:     ${mdRel}`);
  console.log(`
Next:
  - Import tokens.css in the host app (e.g. globals.css)
  - Prefer semantic vars: var(--ts-bg), var(--ts-ink), var(--ts-accent)
  - Keep DESIGN_TOKENS.md in docs/research for agents
  - Skill: .claude/skills/ctrlc-design-tokens/SKILL.md
`);
  return 0;
}
