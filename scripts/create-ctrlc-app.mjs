#!/usr/bin/env node
/**
 * Scaffold a minimal CtrlC Next app from examples/next-demo.
 *
 * Usage (from monorepo root):
 *   node scripts/create-ctrlc-app.mjs ../my-app
 *   npm run create -- ../my-app
 *
 * Produces a React-only App Router structure (no HTML dumps).
 * SectionPack inspector + API routes are included.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = path.resolve(__dirname, "..");
const DEMO_ROOT = path.join(MONOREPO_ROOT, "examples", "next-demo");

/** Relative paths under examples/next-demo to copy (skip missing with a warn). */
const COPY_FILES = [
  "next.config.ts",
  "next.config.mjs",
  "tsconfig.json",
  "next-env.d.ts",
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/app/api/dev/section-pack/route.ts",
  "src/app/dev/packs/page.tsx",
  "src/components/sections/PromoBar.tsx",
  "src/components/sections/SiteHeader.tsx",
  "src/components/sections/Hero.tsx",
  "src/components/sections/Features.tsx",
  "src/components/sections/HowItWorks.tsx",
  "src/components/sections/Cta.tsx",
  "src/components/sections/SiteFooter.tsx",
  "src/components/sections/index.ts",
  "src/content/home.ts",
  "src/lib/section-pack-config.ts",
  "src/styles/demo.css",
];

function usage() {
  console.error(`Usage: node scripts/create-ctrlc-app.mjs <target-dir>

Examples:
  node scripts/create-ctrlc-app.mjs ../my-app
  npm run create -- ./apps/northline-clone

Copies a minimal React/Next SectionPack app from examples/next-demo.
Does not emit HTML dumps. Rewrites package.json name from the folder.
`);
}

function fail(msg) {
  console.error(`create-ctrlc-app: ${msg}`);
  process.exit(1);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(from, to) {
  ensureDir(path.dirname(to));
  fs.copyFileSync(from, to);
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function packageNameFromDir(dir) {
  const base = path.basename(path.resolve(dir));
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "ctrlc-app";
  if (slug.startsWith("@")) return slug;
  return slug;
}

function relFileDep(fromDir, packageSubpath) {
  const abs = path.join(MONOREPO_ROOT, packageSubpath);
  let rel = path.relative(fromDir, abs);
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return `file:${toPosix(rel)}`;
}

function writePackageJson(targetDir, name) {
  const pkg = {
    name,
    version: "0.1.0",
    private: true,
    type: "module",
    description:
      "CtrlC SectionPack app (scaffolded from examples/next-demo). React sections only.",
    license: "MIT",
    engines: {
      node: ">=20",
    },
    scripts: {
      dev: "next dev -p 3040",
      build: "next build",
      start: "next start -p 3040",
      typecheck: "tsc -p tsconfig.json --noEmit",
      validate: "ctrlc validate --cwd .",
      qa: "ctrlc qa --cwd .",
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
  fs.writeFileSync(
    path.join(targetDir, "package.json"),
    `${JSON.stringify(pkg, null, 2)}\n`,
    "utf8",
  );
}

function writeReadme(targetDir, name) {
  const body = `# ${name}

Scaffolded by CtrlC (\`create-ctrlc-app\`) from \`examples/next-demo\`.

React/Next **sections only** - no HTML dumps. SectionPack gives:

1. Natural language briefs per section
2. Code-as-is multi-file packs (TSX + content + CSS)

## Sections

| id | Component | File |
|----|-----------|------|
| promo | PromoBar | src/components/sections/PromoBar.tsx |
| header | SiteHeader | src/components/sections/SiteHeader.tsx |
| hero | Hero | src/components/sections/Hero.tsx |
| features | Features | src/components/sections/Features.tsx |
| how-it-works | HowItWorks | src/components/sections/HowItWorks.tsx |
| cta | Cta | src/components/sections/Cta.tsx |
| footer | SiteFooter | src/components/sections/SiteFooter.tsx |

Config: \`src/lib/section-pack-config.ts\` (paths relative to this app root).

## Prerequisites

- Node.js 20+
- CtrlC monorepo packages built once (\`@ctrlc/*\` are \`file:\` deps)

From the **CtrlC monorepo root**:

\`\`\`bash
npm install
npm run build
\`\`\`

## Run

\`\`\`bash
cd ${path.basename(targetDir)}
npm install
npm run dev
\`\`\`

Open:

| URL | What |
|-----|------|
| http://localhost:3040 | Homepage + SectionPack inspector |
| http://localhost:3040/dev/packs | Pack catalog |
| http://localhost:3040/api/dev/section-pack?list=1 | Section list JSON |

Inspector (development): Ctrl/Cmd + Shift + P. Hover a section chip to copy natural language or code.

## Alternative

You can also copy the monorepo demo in place:

\`\`\`bash
cp -r examples/next-demo ../my-app
\`\`\`

Then rename the package in \`package.json\` and point workspace deps as needed.

## License

MIT (same as CtrlC)
`;
  fs.writeFileSync(path.join(targetDir, "README.md"), body, "utf8");
}

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
  fs.writeFileSync(path.join(targetDir, ".gitignore"), body, "utf8");
}

function main() {
  const arg = process.argv[2];
  if (!arg || arg === "-h" || arg === "--help") {
    usage();
    process.exit(arg ? 0 : 1);
  }

  if (!fs.existsSync(DEMO_ROOT)) {
    fail(`demo not found at ${DEMO_ROOT}`);
  }

  const targetDir = path.resolve(process.cwd(), arg);
  if (fs.existsSync(targetDir)) {
    const existing = fs.readdirSync(targetDir).filter((n) => n !== ".git");
    if (existing.length > 0) {
      fail(`target is not empty: ${targetDir}`);
    }
  } else {
    ensureDir(targetDir);
  }

  const name = packageNameFromDir(targetDir);
  console.log(`create-ctrlc-app: scaffolding "${name}" -> ${targetDir}`);

  let copied = 0;
  for (const rel of COPY_FILES) {
    const from = path.join(DEMO_ROOT, rel);
    if (!fs.existsSync(from)) {
      console.warn(`  ~ skip missing demo file: ${rel}`);
      continue;
    }
    const to = path.join(targetDir, rel);
    copyFile(from, to);
    console.log(`  + ${rel}`);
    copied += 1;
  }
  if (copied === 0) {
    fail("no demo files were copied — is examples/next-demo intact?");
  }

  writePackageJson(targetDir, name);
  console.log("  + package.json");
  writeReadme(targetDir, name);
  console.log("  + README.md");
  writeGitignore(targetDir);
  console.log("  + .gitignore");

  console.log("");
  console.log("Done. React-only Next app with SectionPack (no HTML dump).");
  console.log("");
  console.log("Next steps:");
  console.log("  1. From monorepo root:  npm run build");
  console.log(`  2. cd ${targetDir}`);
  console.log("  3. npm install");
  console.log("  4. npm run dev");
  console.log("");
}

main();
