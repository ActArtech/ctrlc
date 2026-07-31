/**
 * Validate SectionPack config paths against files on disk (next-demo).
 *
 * Checks:
 * 1. section-pack-config.ts exists and parses section entries
 * 2. Each componentPath / contentModulePath / cssModulePath exists under the demo root
 * 3. Expected homepage ids are present: promo, header, hero, features, how-it-works, cta, footer
 *
 * Usage: node scripts/validate-packs.mjs
 * Exit 0 on success, 1 on failure.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEMO_ROOT = path.join(ROOT, "examples", "next-demo");
const CONFIG_REL = "src/lib/section-pack-config.ts";

const EXPECTED_IDS = [
  "promo",
  "header",
  "hero",
  "features",
  "how-it-works",
  "cta",
  "footer",
];

function readConfig() {
  const abs = path.join(DEMO_ROOT, CONFIG_REL);
  if (!fs.existsSync(abs)) {
    throw new Error(`Missing config: examples/next-demo/${CONFIG_REL}`);
  }
  return fs.readFileSync(abs, "utf8");
}

/**
 * Extract section object blocks from defineSectionPackConfig({ sections: [ ... ] }).
 * Returns array of raw object source strings.
 */
function extractSectionBlocks(src) {
  const sectionsKey = src.search(/sections\s*:\s*\[/);
  if (sectionsKey < 0) {
    throw new Error("Could not find sections: [ in section-pack-config.ts");
  }
  const openBracket = src.indexOf("[", sectionsKey);
  let depth = 0;
  let end = -1;
  for (let i = openBracket; i < src.length; i++) {
    const ch = src[i];
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) throw new Error("Unclosed sections array");
  const body = src.slice(openBracket + 1, end);

  const blocks = [];
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /\s|,/.test(body[i])) i++;
    if (i >= body.length) break;
    if (body[i] !== "{") {
      i++;
      continue;
    }
    const start = i;
    let d = 0;
    for (; i < body.length; i++) {
      if (body[i] === "{") d++;
      else if (body[i] === "}") {
        d--;
        if (d === 0) {
          blocks.push(body.slice(start, i + 1));
          i++;
          break;
        }
      }
    }
  }
  return blocks;
}

function fieldString(block, field) {
  const re = new RegExp(`${field}\\s*:\\s*["'\`]([^"'\`]+)["'\`]`);
  const m = block.match(re);
  return m ? m[1] : null;
}

/** Remove leftover duplicate section files (pc-* era). */
function pruneDuplicates() {
  const remove = [
    "src/components/HomePage.tsx",
    "src/components/sections/Promo.tsx",
    "src/components/sections/Header.tsx",
    "src/components/sections/Footer.tsx",
    "src/components/sections/shared/Reveal.tsx",
    "src/components/sections/shared/SectionShell.tsx",
    "next.config.mjs",
  ];
  for (const rel of remove) {
    const abs = path.join(DEMO_ROOT, rel);
    if (fs.existsSync(abs)) {
      fs.unlinkSync(abs);
      console.log(`  pruned  ${rel}`);
    }
  }
  const sharedDir = path.join(DEMO_ROOT, "src/components/sections/shared");
  if (fs.existsSync(sharedDir) && fs.readdirSync(sharedDir).length === 0) {
    fs.rmdirSync(sharedDir);
    console.log("  pruned  empty shared/");
  }
}

function main() {
  const errors = [];
  const prune = process.argv.includes("--prune");
  if (prune) {
    console.log("validate-packs: pruning duplicate demo files\n");
    pruneDuplicates();
    console.log("");
  }

  let src;
  try {
    src = readConfig();
  } catch (e) {
    console.error(`validate-packs: ${e.message}`);
    process.exit(1);
  }

  let blocks;
  try {
    blocks = extractSectionBlocks(src);
  } catch (e) {
    console.error(`validate-packs: ${e.message}`);
    process.exit(1);
  }

  if (blocks.length === 0) {
    console.error("validate-packs: no section entries found");
    process.exit(1);
  }

  console.log(`validate-packs: ${blocks.length} section(s) in next-demo config\n`);

  const foundIds = [];

  for (const block of blocks) {
    const id = fieldString(block, "id");
    if (!id) {
      errors.push("section block missing id");
      continue;
    }
    foundIds.push(id);

    for (const field of ["componentPath", "contentModulePath", "cssModulePath"]) {
      const rel = fieldString(block, field);
      if (!rel) {
        if (field === "componentPath") {
          errors.push(`[${id}] missing ${field}`);
        }
        continue;
      }
      const abs = path.join(DEMO_ROOT, rel);
      if (!fs.existsSync(abs)) {
        errors.push(`[${id}] ${field} missing on disk: ${rel}`);
      } else {
        console.log(`  ok  ${field.padEnd(18)} ${id} -> ${rel}`);
      }
    }

    const exp = fieldString(block, "componentExport");
    if (exp) {
      const componentPath = fieldString(block, "componentPath");
      if (componentPath) {
        const code = fs.readFileSync(path.join(DEMO_ROOT, componentPath), "utf8");
        const exportOk =
          code.includes(`export function ${exp}`) ||
          code.includes(`export const ${exp}`) ||
          code.includes(`export { ${exp}`) ||
          code.includes(`export {${exp}`);
        if (!exportOk) {
          errors.push(
            `[${id}] componentExport "${exp}" not found in ${componentPath}`,
          );
        } else {
          console.log(`  ok  componentExport   ${id} -> ${exp}`);
        }
      }
    }
  }

  console.log(`\nvalidate-packs: expected homepage ids\n`);
  for (const id of EXPECTED_IDS) {
    if (!foundIds.includes(id)) {
      errors.push(`missing expected section id "${id}" in config`);
    } else {
      console.log(`  ok  id  ${id}`);
    }
  }

  const pagePath = path.join(DEMO_ROOT, "src/app/page.tsx");
  if (fs.existsSync(pagePath)) {
    const page = fs.readFileSync(pagePath, "utf8");
    for (const id of EXPECTED_IDS) {
      if (!page.includes(`id="${id}"`)) {
        errors.push(`app/page.tsx missing SectionBoundary id="${id}"`);
      } else {
        console.log(`  ok  page boundary  ${id}`);
      }
    }
  } else {
    errors.push("missing src/app/page.tsx");
  }

  if (errors.length) {
    console.error("\nFailures:");
    for (const e of errors) console.error(`  x ${e}`);
    console.error(`\nvalidate-packs: ${errors.length} error(s)`);
    process.exit(1);
  }

  console.log("\nvalidate-packs: all checks passed");
  process.exit(0);
}

main();
