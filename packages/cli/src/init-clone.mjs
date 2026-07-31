/**
 * ctrlc init-clone — scaffold a clone project with SectionPack pre-wired.
 *
 * Prefer examples/clone-template (empty host + research + registry) when present.
 * Fall back to scripts/create-ctrlc-app.mjs (next-demo with HowItWorks, etc.).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { flagString, flagBool } from "./args.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = path.resolve(__dirname, "../../..");
const CLONE_TEMPLATE_ROOT = path.join(
  MONOREPO_ROOT,
  "examples",
  "clone-template",
);

/**
 * Relative paths under examples/clone-template to copy when scaffolding.
 * Hidden dirs (.ctrlc) are handled separately.
 */
const CLONE_TEMPLATE_FILES = [
  "next.config.ts",
  "next.config.mjs",
  "tsconfig.json",
  "next-env.d.ts",
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/app/api/dev/section-pack/route.ts",
  "src/components/sections/index.ts",
  "src/content/home.ts",
  "src/lib/section-pack-config.ts",
  "src/styles/app.css",
  "public/images/.gitkeep",
  "public/seo/.gitkeep",
  "public/videos/.gitkeep",
  "docs/research/PAGE_TOPOLOGY.md",
  "docs/research/DESIGN_TOKENS.md",
  "docs/research/BEHAVIORS.md",
  "docs/research/components/.gitkeep",
  "docs/design-references/.gitkeep",
  "AGENTS.md",
];

/**
 * @param {string} dir
 */
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * @param {string} file
 * @param {string} content
 * @param {{ force?: boolean }} [opts]
 */
function writeFile(file, content, opts = {}) {
  if (!opts.force && fs.existsSync(file)) return false;
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content, "utf8");
  return true;
}

/**
 * @param {string} from
 * @param {string} to
 */
function copyFile(from, to) {
  ensureDir(path.dirname(to));
  fs.copyFileSync(from, to);
}

/**
 * @param {string} p
 */
function toPosix(p) {
  return p.split(path.sep).join("/");
}

/**
 * @param {string} dir
 */
function packageNameFromDir(dir) {
  const base = path.basename(path.resolve(dir));
  const slug =
    base
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "ctrlc-clone";
  if (slug.startsWith("@")) return slug;
  return slug;
}

/**
 * @param {string} fromDir
 * @param {string} packageSubpath
 */
function relFileDep(fromDir, packageSubpath) {
  const abs = path.join(MONOREPO_ROOT, packageSubpath);
  let rel = path.relative(fromDir, abs);
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return `file:${toPosix(rel)}`;
}

/**
 * True when clone-template looks complete enough to scaffold from.
 */
function isCloneTemplateReady() {
  if (!fs.existsSync(CLONE_TEMPLATE_ROOT)) return false;
  const must = [
    "package.json",
    "src/lib/section-pack-config.ts",
    "src/app/layout.tsx",
    "src/app/page.tsx",
    "src/app/api/dev/section-pack/route.ts",
    "docs/research/PAGE_TOPOLOGY.md",
  ];
  return must.every((rel) => fs.existsSync(path.join(CLONE_TEMPLATE_ROOT, rel)));
}

/**
 * @param {string} targetDir
 * @param {string} url
 * @param {string} scope
 */
function writeCloneMeta(targetDir, url, scope) {
  const meta = {
    schemaVersion: 1,
    sourceUrl: url || null,
    scope: scope || "page",
    createdAt: new Date().toISOString(),
    sectionPack: true,
    notes:
      "CtrlC clone project. React components only — never HTML dumps as product.",
  };
  writeFile(
    path.join(targetDir, ".ctrlc", "clone-meta.json"),
    JSON.stringify(meta, null, 2) + "\n",
    { force: true },
  );
}

/**
 * @param {string} targetDir
 */
function writeEmptyRegistry(targetDir) {
  const regPath = path.join(targetDir, ".ctrlc", "registry.json");
  if (fs.existsSync(regPath)) return;
  writeFile(
    regPath,
    JSON.stringify({ schemaVersion: 1, sections: [] }, null, 2) + "\n",
    { force: true },
  );
}

/**
 * @param {string} targetDir
 * @param {string} url
 */
function writeResearchStubs(targetDir, url) {
  const research = path.join(targetDir, "docs", "research");
  const components = path.join(research, "components");
  const refs = path.join(targetDir, "docs", "design-references");
  ensureDir(components);
  ensureDir(refs);

  writeFile(
    path.join(research, "PAGE_TOPOLOGY.md"),
    `# Page topology

**Source:** ${url || "(set URL)"}  
**Scope:** page (default)

## Sections (top → bottom)

| # | id | Interaction model | Notes |
|---|-----|-------------------|-------|
| 1 | | static / click / scroll / hover / time / hybrid | |

## Overlays / sticky

-

## Assembly notes

-
`,
  );

  writeFile(
    path.join(research, "DESIGN_TOKENS.md"),
    `# Design tokens

## Color

| Token | Value |
|-------|-------|
| --background | |
| --foreground | |
| --primary | |

## Typography

| Role | Family | Weights |
|------|--------|---------|
| body | | |
| display | | |

## Spacing / radius

-
`,
  );

  writeFile(
    path.join(research, "BEHAVIORS.md"),
    `# Behaviors

## Interaction sweep

### Scroll
-

### Click
-

### Hover
-

### Responsive (1440 / 768 / 390)
-
`,
  );

  writeFile(path.join(components, ".gitkeep"), "");
  writeFile(path.join(refs, ".gitkeep"), "");
}

/**
 * @param {string} targetDir
 * @param {string} url
 */
function writeAgentsMd(targetDir, url) {
  const tpl = path.join(MONOREPO_ROOT, "docs", "templates", "AGENTS.clone.md");
  let body;
  if (fs.existsSync(tpl)) {
    body = fs
      .readFileSync(tpl, "utf8")
      .replaceAll("{{SOURCE_URL}}", url || "https://example.com")
      .replaceAll("{{SCOPE}}", "page");
  } else {
    body = `# Agent notes

Source: ${url || "TBD"}  
Stack: Next.js + SectionPack  

Rules:
- React components only (never HTML dump product)
- After each section: write spec, build component, run \`ctrlc register\`
- Dual export: natural language + code as-is
`;
  }
  writeFile(path.join(targetDir, "AGENTS.md"), body, { force: true });
}

/**
 * Copy skill into project for Claude/Cursor-style agents.
 * @param {string} targetDir
 */
function installSkillCopy(targetDir) {
  const skillSrc = path.join(
    MONOREPO_ROOT,
    ".claude",
    "skills",
    "ctrlc-clone",
    "SKILL.md",
  );
  if (!fs.existsSync(skillSrc)) return false;
  const dest = path.join(
    targetDir,
    ".claude",
    "skills",
    "ctrlc-clone",
    "SKILL.md",
  );
  ensureDir(path.dirname(dest));
  fs.copyFileSync(skillSrc, dest);
  return true;
}

/**
 * README for clone-template-based scaffolds (dual export + HowItWorks mention).
 * @param {string} targetDir
 * @param {string} name
 * @param {string} url
 */
function writeCloneScaffoldReadme(targetDir, name, url) {
  const body = `# ${name}

Scaffolded by \`ctrlc init-clone\` from \`examples/clone-template\`.

Empty **clone host**: Next.js App Router + SectionPack, no demo sections yet.
React components only - never HTML dumps.

**Source URL:** ${url || "(set with --url or edit AGENTS.md)"}

## Dual export (SectionPack)

Every registered section exports two ways:

1. **Natural language** - function, motion, layout, color (\`ctrlc pack <id> --format describe\`)
2. **Code as-is** - multi-file pack TSX + content + CSS (\`ctrlc pack <id> --format prompt\`)

Register after each section so dual export works immediately:

\`\`\`bash
ctrlc register <id> --cwd . \\
  --component src/components/sections/<Name>.tsx \\
  --export <Name> \\
  --content-module src/content/home.ts \\
  --content-key <key> \\
  --css src/styles/app.css \\
  --selector .<class> \\
  --interaction scroll \\
  --from-spec docs/research/components/<id>.spec.md
\`\`\`

### Reference section: HowItWorks

The monorepo demo (\`examples/next-demo\`) includes a full **HowItWorks** section with
dual export wired. Use it as a shape reference when building your first section:

- Component: \`examples/next-demo/src/components/sections/HowItWorks.tsx\`
- Config entry: id \`how-it-works\` in \`section-pack-config.ts\`
- Pack smoke: \`ctrlc pack how-it-works --format describe --cwd examples/next-demo\`

## Capture pipeline

From the CtrlC monorepo (after \`npm run build\`):

\`\`\`bash
# 1) Recon -> Page IR
ctrlc capture https://example.com --out runs/example

# 2) Specs from IR (into this project)
ctrlc specs-from-ir --ir runs/example/ir.json --cwd .

# 3) Build React sections from docs/research/components/*.spec.md
# 4) Register
ctrlc register-from-spec --cwd . --spec docs/research/components/<id>.spec.md

# 5) QA
ctrlc validate --cwd . && ctrlc qa --cwd .
\`\`\`

## Layout

\`\`\`text
src/app/page.tsx                      # compose sections here
src/lib/section-pack-config.ts        # empty base + registry merge
src/components/sections/              # add React sections
docs/research/                        # topology, tokens, behaviors, specs
.ctrlc/registry.json              # ctrlc register target (empty shell)
AGENTS.md
\`\`\`

## Run

\`\`\`bash
cd ${path.basename(targetDir)}
npm install
npm run dev
\`\`\`

Prerequisites: Node.js 20+, monorepo \`@ctrlc/*\` packages built if using \`file:\` deps.

## License

MIT (same as CtrlC)
`;
  writeFile(path.join(targetDir, "README.md"), body, { force: true });
}

/**
 * @param {string} targetDir
 * @param {string} name
 */
function writeClonePackageJson(targetDir, name) {
  const pkg = {
    name,
    version: "0.1.0",
    private: true,
    type: "module",
    description:
      "CtrlC clone host (scaffolded from examples/clone-template). React sections + SectionPack dual export.",
    license: "MIT",
    engines: {
      node: ">=20",
    },
    scripts: {
      dev: "next dev -p 3041",
      build: "next build",
      start: "next start -p 3041",
      typecheck: "tsc -p tsconfig.json --noEmit",
      CtrlC: "ctrlc",
      validate: "ctrlc validate --cwd .",
      qa: "ctrlc qa --cwd .",
      list: "ctrlc list --cwd .",
      scan: "ctrlc scan --cwd .",
    },
    dependencies: {
      "@ctrlc/core": relFileDep(targetDir, "packages/core"),
      "@ctrlc/next": relFileDep(targetDir, "packages/next"),
      "@ctrlc/react": relFileDep(targetDir, "packages/react"),
      next: "^15.2.4",
      react: "^19.0.0",
      "react-dom": "^19.0.0",
    },
    devDependencies: {
      "@types/node": "^22.13.10",
      "@types/react": "^19.0.12",
      "@types/react-dom": "^19.0.4",
      typescript: "^5.8.2",
    },
  };
  writeFile(
    path.join(targetDir, "package.json"),
    JSON.stringify(pkg, null, 2) + "\n",
    { force: true },
  );
}

/**
 * @param {string} targetDir
 */
function writeGitignore(targetDir) {
  const body = `node_modules/
.next/
out/
dist/
*.tsbuildinfo
next-env.d.ts
.DS_Store
.env*
!.env.example
`;
  writeFile(path.join(targetDir, ".gitignore"), body, { force: true });
}

/**
 * Scaffold from examples/clone-template (preferred empty host).
 * @param {string} targetDir
 * @param {string} url
 */
function scaffoldFromCloneTemplate(targetDir, url) {
  ensureDir(targetDir);
  const name = packageNameFromDir(targetDir);
  console.log(
    `init-clone: scaffolding from examples/clone-template → ${targetDir}`,
  );

  let copied = 0;
  for (const rel of CLONE_TEMPLATE_FILES) {
    const from = path.join(CLONE_TEMPLATE_ROOT, rel);
    if (!fs.existsSync(from)) {
      console.warn(`  ~ skip missing template file: ${rel}`);
      continue;
    }
    copyFile(from, path.join(targetDir, rel));
    console.log(`  + ${rel}`);
    copied += 1;
  }

  // Empty registry shell from template if present
  const regSrc = path.join(CLONE_TEMPLATE_ROOT, ".ctrlc", "registry.json");
  if (fs.existsSync(regSrc)) {
    copyFile(regSrc, path.join(targetDir, ".ctrlc", "registry.json"));
    console.log("  + .ctrlc/registry.json");
    copied += 1;
  }

  if (copied === 0) {
    throw new Error(
      "clone-template copy produced 0 files — is examples/clone-template intact?",
    );
  }

  writeClonePackageJson(targetDir, name);
  console.log("  + package.json");
  writeCloneScaffoldReadme(targetDir, name, url);
  console.log("  + README.md");
  writeGitignore(targetDir);
  console.log("  + .gitignore");
}

/**
 * Fallback: scaffold from next-demo via create-ctrlc-app (includes HowItWorks).
 * @param {string} targetDir
 */
function scaffoldFromDemo(targetDir) {
  const createScript = path.join(
    MONOREPO_ROOT,
    "scripts",
    "create-ctrlc-app.mjs",
  );
  if (!fs.existsSync(createScript)) {
    throw new Error(`Missing create-ctrlc-app.mjs at ${createScript}`);
  }
  console.log(
    `init-clone: clone-template unavailable; using create-ctrlc-app (next-demo) → ${targetDir}`,
  );
  const r = spawnSync(process.execPath, [createScript, targetDir], {
    cwd: MONOREPO_ROOT,
    stdio: "inherit",
    env: process.env,
  });
  if (r.status !== 0) {
    throw new Error(`create-ctrlc-app failed with exit ${r.status ?? "?"}`);
  }
}

/**
 * Prefer clone-template; fall back to next-demo create script.
 * @param {string} targetDir
 * @param {string} url
 */
function scaffoldApp(targetDir, url) {
  if (isCloneTemplateReady()) {
    scaffoldFromCloneTemplate(targetDir, url);
    return "clone-template";
  }
  scaffoldFromDemo(targetDir);
  return "next-demo";
}

/**
 * @param {import("./args.mjs").ParsedArgs} args
 */
export async function cmdInitClone(args) {
  const cwdFlag = flagString(args.flags, "cwd");
  const out =
    args.positionals[0] ||
    flagString(args.flags, "out") ||
    cwdFlag ||
    null;
  if (!out) {
    console.error(`Usage: ctrlc init-clone <target-dir> [--url <url>] [--scope page|site]

Scaffolds a React/Next app with SectionPack pre-wired, research folders, AGENTS.md,
empty .ctrlc/registry.json, and the ctrlc-clone skill.

Prefers examples/clone-template (empty host). Falls back to next-demo via create-ctrlc-app.

Examples:
  ctrlc init-clone ../my-clone --url https://example.com
  ctrlc init-clone ./work --url https://example.com/pricing --scope page
`);
    process.exit(1);
  }

  const targetDir = path.resolve(out);
  const url = flagString(args.flags, "url") || "";
  const scope = flagString(args.flags, "scope") || "page";
  const skipScaffold = flagBool(args.flags, "no-scaffold");
  const force = flagBool(args.flags, "force");

  const exists = fs.existsSync(targetDir);
  const hasPackage =
    exists && fs.existsSync(path.join(targetDir, "package.json"));

  /** @type {string | null} */
  let scaffoldSource = null;

  if (!skipScaffold) {
    if (hasPackage && !force) {
      console.log(
        `init-clone: package.json exists at ${targetDir} (use --force to re-run scaffold, or --no-scaffold to only add pack wiring)`,
      );
    } else {
      if (exists && !hasPackage) {
        // empty or non-app dir
      }
      if (hasPackage && force) {
        // create-ctrlc-app refuses non-empty dirs; clone-template path overwrites known files
        console.log(`init-clone: --force re-scaffold → ${targetDir}`);
      } else {
        console.log(`init-clone: scaffolding app → ${targetDir}`);
      }
      scaffoldSource = scaffoldApp(targetDir, url);
    }
  } else {
    ensureDir(targetDir);
  }

  writeCloneMeta(targetDir, url, scope);
  writeEmptyRegistry(targetDir);
  writeResearchStubs(targetDir, url);
  writeAgentsMd(targetDir, url);
  const skillOk = installSkillCopy(targetDir);

  // Ensure registry merge helper note in lib if scaffold created config
  const configPath = path.join(
    targetDir,
    "src",
    "lib",
    "section-pack-config.ts",
  );
  if (fs.existsSync(configPath)) {
    patchConfigToMergeRegistry(configPath);
  }

  // Demo fallback README may omit capture pipeline; soft-append dual export note if missing
  const readmePath = path.join(targetDir, "README.md");
  if (fs.existsSync(readmePath) && scaffoldSource === "next-demo") {
    ensureDemoReadmeDualExportNote(readmePath);
  }

  console.log(`
init-clone: ready

  Project:     ${targetDir}
  Source URL:  ${url || "(not set — pass --url)"}
  Scope:       ${scope}
  Scaffold:    ${scaffoldSource || "(skipped / existing package.json)"}
  SectionPack: .ctrlc/registry.json + API/provider (from scaffold)
  Research:    docs/research/ + docs/design-references/
  Agents:      AGENTS.md${skillOk ? "\n  Skill:       .claude/skills/ctrlc-clone/SKILL.md" : ""}

Next:
  1. cd ${targetDir} && npm install && npm run dev
  2. Follow AGENTS.md / ctrlc-clone skill for recon → specs → React sections
  3. After each section builds:
       ctrlc register <id> --cwd . --component src/components/sections/X.tsx --export X ...
     or: ctrlc scan --cwd .  (then merge draft into config/registry)
  4. ctrlc validate --cwd . && ctrlc qa --cwd .
`);
}

/**
 * Ensure next-demo scaffold README mentions dual export + HowItWorks.
 * @param {string} readmePath
 */
function ensureDemoReadmeDualExportNote(readmePath) {
  let body = fs.readFileSync(readmePath, "utf8");
  if (body.includes("Dual export") || body.includes("dual export")) return;
  const note = `
## Dual export (SectionPack)

Every section supports **natural language** (\`describe\`) and **code as-is** (\`prompt\` / zip).
Demo includes **HowItWorks** (\`how-it-works\`) as a dual-export reference section.

\`\`\`bash
ctrlc pack how-it-works --format describe --cwd .
ctrlc pack how-it-works --format prompt-short --cwd .
\`\`\`
`;
  body = body.trimEnd() + "\n" + note;
  fs.writeFileSync(readmePath, body, "utf8");
}

/**
 * Ensure section-pack-config merges .ctrlc/registry.json when present.
 * @param {string} configPath
 */
function patchConfigToMergeRegistry(configPath) {
  let src = fs.readFileSync(configPath, "utf8");
  if (src.includes("mergeSectionRegistry") || src.includes("registry.json")) {
    return;
  }
  // Soft patch: prepend comment block with instructions (avoid brittle AST rewrite)
  const banner = `/**
 * SectionPack host config.
 * Runtime registry: .ctrlc/registry.json (updated by \`ctrlc register\`).
 * Prefer register after each section so dual export (NL + code) works immediately.
 */
`;
  if (!src.startsWith("/**")) {
    src = banner + src;
  }
  // Try to inject merge if defineSectionPackConfig is used simply
  if (
    src.includes("defineSectionPackConfig") &&
    !src.includes("mergeSectionRegistry")
  ) {
    src = src.replace(
      /from ["']@CtrlC\/core["']/,
      `from "@ctrlc/core";\n// mergeSectionRegistry available from @ctrlc/core for .ctrlc/registry.json`,
    );
  }
  fs.writeFileSync(configPath, src, "utf8");
}
