/**
 * ctrlc register — upsert a section into .ctrlc/registry.json
 * and optionally draft behavior from a spec file.
 */

import fs from "node:fs";
import path from "node:path";
import { flagString, flagBool, resolveCwd } from "./args.mjs";

/**
 * @param {string} cwd
 */
function registryPath(cwd) {
  return path.join(cwd, ".ctrlc", "registry.json");
}

/**
 * @param {string} cwd
 */
function readRegistry(cwd) {
  const p = registryPath(cwd);
  if (!fs.existsSync(p)) {
    return { schemaVersion: 1, sections: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return { schemaVersion: 1, sections: [] };
  }
}

/**
 * @param {string} cwd
 * @param {object} reg
 */
function writeRegistry(cwd, reg) {
  const p = registryPath(cwd);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(reg, null, 2) + "\n", "utf8");
  return p;
}

/**
 * @param {string} s
 */
function pascalFromId(s) {
  return s
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}

/**
 * @param {import("./args.mjs").ParsedArgs} args
 * @param {Awaited<ReturnType<import("./cli.mjs")["loadCore"]>>} [core]
 */
export async function cmdRegister(args, core) {
  const id = args.positionals[0];
  if (!id) {
    console.error(`Usage: ctrlc register <sectionId> [options]

Options:
  --cwd <dir>
  --component <path>     e.g. src/components/sections/Hero.tsx
  --export <Name>        component export (default: PascalCase of id)
  --content-module <path>
  --content-key <name>   repeatable via comma list
  --css <path>
  --selector <css>       comma-separated selectors
  --label <text>
  --description <text>
  --tags <a,b,c>
  --prompt-role <text>
  --interaction <model>  static|click|scroll|hover|time|hybrid
  --from-spec <file>     section.spec.md → behavior brief
  --related <paths>      comma-separated related file paths
  --json

Example:
  ctrlc register hero --cwd . \\
    --component src/components/sections/Hero.tsx --export Hero \\
    --content-module src/content/home.ts --content-key hero \\
    --css src/styles/demo.css --selector .hero \\
    --interaction scroll --from-spec docs/research/components/hero.spec.md
`);
    process.exit(1);
  }

  const cwd = resolveCwd(args.flags);
  const componentPath =
    flagString(args.flags, "component") ||
    `src/components/sections/${pascalFromId(id)}.tsx`;
  const componentExport =
    flagString(args.flags, "export") || pascalFromId(id);
  const contentModulePath =
    flagString(args.flags, "content-module") ||
    flagString(args.flags, "content") ||
    "src/content/home.ts";
  const contentKeysRaw =
    flagString(args.flags, "content-key") ||
    flagString(args.flags, "content-keys") ||
    id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const contentKeys = contentKeysRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const cssModulePath =
    flagString(args.flags, "css") || "src/styles/demo.css";
  const selectorsRaw =
    flagString(args.flags, "selector") ||
    flagString(args.flags, "selectors") ||
    `.${id}`;
  const cssSelectors = selectorsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const label = flagString(args.flags, "label") || id;
  const description =
    flagString(args.flags, "description") ||
    `Section ${label} (registered via ctrlc register)`;
  const tags = (flagString(args.flags, "tags") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const promptRole =
    flagString(args.flags, "prompt-role") || `Section ${label}`;
  const interaction =
    flagString(args.flags, "interaction") ||
    flagString(args.flags, "interaction-model") ||
    "static";
  const related = (flagString(args.flags, "related") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const fromSpec = flagString(args.flags, "from-spec");
  const asJson = flagBool(args.flags, "json");

  /** @type {import("@ctrlc/core").SectionPackEntry} */
  let entry = {
    id,
    label,
    description,
    componentPath,
    componentExport,
    contentKeys,
    contentModulePath,
    cssModulePath,
    cssSelectors,
    tags: tags.length ? tags : ["section"],
    promptRole,
    relatedPaths: related.length ? related : undefined,
  };

  if (core?.behaviorFromSpec) {
    let specInput = {
      id,
      label,
      description,
      interactionModel: interaction,
    };
    if (fromSpec && fs.existsSync(path.resolve(cwd, fromSpec))) {
      const md = fs.readFileSync(path.resolve(cwd, fromSpec), "utf8");
      if (core.parseSpecMarkdown) {
        specInput = {
          ...core.parseSpecMarkdown(id, md),
          ...specInput,
          label: specInput.label,
        };
      }
    }
    entry.behavior = core.behaviorFromSpec(specInput);
  }

  const reg = readRegistry(cwd);
  const next = core?.upsertRegistrySection
    ? core.upsertRegistrySection(reg, entry)
    : {
        ...reg,
        sections: [
          ...(reg.sections || []).filter((s) => s.id !== id),
          entry,
        ],
      };

  const outPath = writeRegistry(cwd, next);

  // Auto recipe landing-core if multiple sections
  if ((next.sections?.length ?? 0) >= 2 && !next.recipes?.length) {
    next.recipes = [
      {
        id: "landing-core",
        label: "Landing core",
        description: "Auto recipe from registered section order",
        sectionIds: next.sections.map((s) => s.id),
      },
    ];
    writeRegistry(cwd, next);
  }

  if (asJson) {
    console.log(JSON.stringify({ registry: outPath, entry }, null, 2));
  } else {
    console.log(`register: upserted "${id}" → ${outPath}`);
    console.log(`  component: ${componentPath} (${componentExport})`);
    console.log(`  content:   ${contentModulePath} [${contentKeys.join(", ")}]`);
    console.log(`  css:       ${cssModulePath} ${cssSelectors.join(" ")}`);
    if (entry.behavior) {
      console.log(`  behavior:  drafted (interaction=${interaction})`);
    }
    console.log(`
Next:
  - Ensure <SectionBoundary id="${id}"> wraps the component in page.tsx
  - ctrlc validate --cwd ${cwd}
  - ctrlc pack ${id} --format describe --cwd ${cwd}
`);
  }
}
