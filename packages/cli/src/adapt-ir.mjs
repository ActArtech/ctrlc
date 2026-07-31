/**
 * ctrlc adapt-ir — external capture JSON → CtrlC Page IR
 *
 * Adapter only: no Ditto/network APIs. Converts file-map or section-oriented
 * third-party artifacts into Page IR for specs-from-ir / pipeline --ir.
 */

import fs from "node:fs";
import path from "node:path";
import { flagString, flagBool, resolveCwd, resolveInputPath } from "./args.mjs";

/**
 * Default output when --out is omitted:
 *   docs/research/adapted-ir.json if docs/research exists (or can be used)
 *   else .ctrlc/adapted-ir.json
 * @param {string} cwd
 * @returns {string}
 */
function defaultOutPath(cwd) {
  const researchDir = path.join(cwd, "docs", "research");
  if (fs.existsSync(researchDir) || fs.existsSync(path.join(cwd, "docs"))) {
    return path.join(researchDir, "adapted-ir.json");
  }
  return path.join(cwd, ".ctrlc", "adapted-ir.json");
}

/**
 * @param {import("./args.mjs").ParsedArgs} args
 * @param {Awaited<ReturnType<import("./cli.mjs")["loadCore"]>>} core
 */
export async function cmdAdaptIr(args, core) {
  const cwd = resolveCwd(args.flags);
  const inputRaw =
    flagString(args.flags, "input") ||
    flagString(args.flags, "from") ||
    flagString(args.flags, "ir") ||
    args.positionals[0];

  if (!inputRaw) {
    console.error(`Usage: ctrlc adapt-ir --input path/to/external.json [--out path]

Options:
  --input, --from <file>  External capture / file-map JSON (required)
  --out <file>            Output Page IR path
                          (default: docs/research/adapted-ir.json or .ctrlc/adapted-ir.json)
  --cwd <dir>             Project root for default out path
  --source-url <url>      Override IR sourceUrl
  --pipeline              Print next pipeline steps for ctrlc pipeline --ir ...
  --json

Examples:
  ctrlc adapt-ir --input path/to/external.json --out runs/adapted/ir.json
  ctrlc adapt-ir --input file.json --cwd project
  ctrlc adapt-ir --from external.json --pipeline --json
`);
    process.exit(1);
  }

  if (typeof core.adaptExternalCaptureToPageIR !== "function") {
    console.error(
      "adaptExternalCaptureToPageIR is not available from @ctrlc/core. Rebuild packages/core.",
    );
    process.exit(1);
  }

  const inputPath = resolveInputPath(inputRaw, cwd);
  if (!fs.existsSync(inputPath)) {
    console.error(`External capture not found: ${inputPath}`);
    process.exit(1);
  }

  const outRaw = flagString(args.flags, "out") || defaultOutPath(cwd);
  const outPath = path.isAbsolute(outRaw)
    ? outRaw
    : path.resolve(cwd, outRaw);

  const sourceUrl = flagString(args.flags, "source-url") || undefined;
  const asJson = flagBool(args.flags, "json");
  const showPipeline = flagBool(args.flags, "pipeline");

  let result;
  try {
    if (typeof core.writeAdaptedIr === "function") {
      result = core.writeAdaptedIr(inputPath, outPath, {
        sourceUrl: sourceUrl || undefined,
      });
    } else {
      const raw =
        typeof core.loadExternalCapture === "function"
          ? core.loadExternalCapture(inputPath)
          : JSON.parse(fs.readFileSync(inputPath, "utf8"));
      const ir = core.adaptExternalCaptureToPageIR(raw, {
        sourceUrl: sourceUrl || undefined,
      });
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(ir, null, 2) + "\n", "utf8");
      result = { ir, path: outPath };
    }
  } catch (e) {
    console.error(`Failed to adapt external capture: ${String(e?.message ?? e)}`);
    process.exit(1);
  }

  const ir = result.ir;
  const sectionCount = Array.isArray(ir.sections) ? ir.sections.length : 0;
  const sectionIds = (ir.sections || []).map((s) => s.id).filter(Boolean);

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          cwd,
          input: inputPath,
          out: result.path,
          schemaVersion: ir.schemaVersion ?? 1,
          sourceUrl: ir.sourceUrl,
          sectionCount,
          sectionIds,
          notes: ir.notes ?? [],
          pipeline: showPipeline
            ? [
                `ctrlc pipeline --ir ${result.path} --cwd ${cwd}`,
                `ctrlc specs-from-ir --ir ${result.path} --cwd ${cwd}`,
                `ctrlc tokens-from-ir --ir ${result.path} --cwd ${cwd}`,
                `ctrlc register-from-ir --ir ${result.path} --cwd ${cwd}`,
              ]
            : undefined,
        },
        null,
        2,
      ),
    );
    return 0;
  }

  const outRel = path.relative(cwd, result.path) || result.path;
  console.log(`adapt-ir: wrote Page IR`);
  console.log(`  input:    ${inputPath}`);
  console.log(`  out:      ${outRel}`);
  console.log(`  sections: ${sectionCount}`);
  if (sectionIds.length) {
    console.log(`  ids:      ${sectionIds.join(", ")}`);
  }
  console.log(`  schema:   ${ir.schemaVersion ?? 1}`);
  console.log(`  source:   ${ir.sourceUrl || "(none)"}`);

  if (showPipeline) {
    console.log(`
Next (pipeline):
  ctrlc pipeline --ir ${outRel} --cwd ${cwd}
  ctrlc specs-from-ir --ir ${outRel} --cwd ${cwd}
  ctrlc tokens-from-ir --ir ${outRel} --cwd ${cwd}
  ctrlc register-from-ir --ir ${outRel} --cwd ${cwd}
`);
  } else {
    console.log(`
Next:
  ctrlc specs-from-ir --ir ${outRel} --cwd ${cwd}
  ctrlc pipeline --ir ${outRel} --cwd ${cwd}
`);
  }

  return 0;
}
