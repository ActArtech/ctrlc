/**
 * ctrlc hygienize-ir --ir path [--out path] [--json]
 * Re-run IR section hygiene on an existing ir.json (drop noise, dedupe, short ids).
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { flagString, flagBool, resolveCwd, resolveInputPath } from "./args.mjs";

/**
 * @param {import("./args.mjs").ParsedArgs} args
 */
export async function cmdHygienizeIr(args) {
  const flags = args.flags;
  const irRaw = flagString(flags, "ir") ?? args.positionals[0];
  if (!irRaw) {
    console.error(
      "Usage: ctrlc hygienize-ir --ir <path/to/ir.json> [--out path] [--json]",
    );
    process.exit(1);
  }

  const cwd = resolveCwd(flags);
  const irPath = resolveInputPath(irRaw, cwd);
  if (!fs.existsSync(irPath)) {
    console.error(`Page IR not found: ${irPath}`);
    process.exit(1);
  }

  const outRaw = flagString(flags, "out") ?? flagString(flags, "o");
  const outPath = outRaw
    ? path.isAbsolute(outRaw)
      ? outRaw
      : path.resolve(cwd, outRaw)
    : irPath;
  const asJson = flagBool(flags, "json");

  const hygienizePageIR = await loadHygienize();
  const raw = JSON.parse(fs.readFileSync(irPath, "utf8"));
  const before = Array.isArray(raw.sections) ? raw.sections.length : 0;
  const cleaned = hygienizePageIR(raw);
  const after = cleaned.sections?.length ?? 0;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(cleaned, null, 2)}\n`, "utf8");

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          ir: outPath,
          before,
          after,
          ids: (cleaned.sections || []).map((s) => s.id),
        },
        null,
        2,
      ),
    );
    return 0;
  }

  console.log(`hygienize-ir: ${before} → ${after} sections`);
  console.log(`  wrote: ${outPath}`);
  for (const s of cleaned.sections || []) {
    console.log(`  - ${s.id.padEnd(16)} ${s.label}`);
  }
  return 0;
}

async function loadHygienize() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, "../../capture/dist/index.js"),
    path.resolve(process.cwd(), "packages/capture/dist/index.js"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const mod = await import(pathToFileURL(p).href);
      if (typeof mod.hygienizePageIR === "function") return mod.hygienizePageIR;
    }
  }
  try {
    const mod = await import("@ctrlc/capture");
    if (typeof mod.hygienizePageIR === "function") return mod.hygienizePageIR;
  } catch {
    // fall through
  }
  console.error(
    "Could not load hygienizePageIR from @ctrlc/capture. Run: npm run build -w @ctrlc/capture",
  );
  process.exit(1);
}
