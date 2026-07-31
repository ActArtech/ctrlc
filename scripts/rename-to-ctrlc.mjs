/**
 * Case-sensitive brand rename: Pagecraft / ComponentCraft -> CtrlC / @ctrlc / ctrlc
 * Run from monorepo root: node scripts/rename-to-ctrlc.mjs
 *
 * Idempotent for already-renamed trees (old tokens simply not found).
 * Does not touch node_modules, dist, runs, or .git.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const skipDirs = new Set(["node_modules", ".next", "dist", "runs", ".git"]);
const textExt = new Set([
  ".md",
  ".mjs",
  ".js",
  ".cjs",
  ".ts",
  ".tsx",
  ".json",
  ".yml",
  ".yaml",
  ".css",
  ".html",
  ".txt",
  ".toml",
  ".svg",
]);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else {
      const ext = path.extname(ent.name);
      if (textExt.has(ext) || ent.name === "Dockerfile" || ent.name === "LICENSE") {
        out.push(p);
      }
    }
  }
  return out;
}

/** Ordered replacements (longer / more specific first). Case-sensitive. */
const pairs = [
  // Scoped packages
  ["@componentcraft/", "@ctrlc/"],
  ["@pagecraft/", "@ctrlc/"],
  // Env / tool prefixes
  ["COMPONENTCRAFT_", "CTRLC_"],
  ["PAGECRAFT_", "CTRLC_"],
  ["componentcraft_", "ctrlc_"],
  ["pagecraft_", "ctrlc_"],
  // Skill / scripts / paths
  ["componentcraft-clone", "ctrlc-clone"],
  ["pagecraft-clone", "ctrlc-clone"],
  ["create-componentcraft-app", "create-ctrlc-app"],
  ["create-pagecraft-app", "create-ctrlc-app"],
  ["componentcraft-previews", "ctrlc-previews"],
  ["pagecraft-previews", "ctrlc-previews"],
  ["componentcraft-assets", "ctrlc-assets"],
  ["pagecraft-assets", "ctrlc-assets"],
  ["componentcraft-mcp", "ctrlc-mcp"],
  ["pagecraft-mcp", "ctrlc-mcp"],
  ["componentcraft-capture", "ctrlc-capture"],
  ["pagecraft-capture", "ctrlc-capture"],
  // Config dirs
  [".componentcraft", ".ctrlc"],
  [".pagecraft", ".ctrlc"],
  // Domains
  ["https://componentcraft.dev", "https://ctrlc.dev"],
  ["https://pagecraft.dev", "https://ctrlc.dev"],
  // Brand prose (title case variants)
  ["ComponentCraft", "CtrlC"],
  ["PageCraft", "CtrlC"],
  ["Pagecraft", "CtrlC"],
  // CLI / lowercase product id
  ["componentcraft", "ctrlc"],
  ["pagecraft", "ctrlc"],
];

let n = 0;
for (const f of walk(root)) {
  let s = fs.readFileSync(f, "utf8");
  const orig = s;
  for (const [a, b] of pairs) {
    if (s.includes(a)) s = s.split(a).join(b);
  }
  if (s !== orig) {
    fs.writeFileSync(f, s);
    n++;
  }
}

// Normalize package.json name / bin / scripts to lowercase ctrlc
for (const rel of [
  "package.json",
  "packages/cli/package.json",
  "packages/mcp/package.json",
  "examples/clone-template/package.json",
  "examples/next-demo/package.json",
]) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) continue;
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  if (j.name === "CtrlC" || j.name === "Pagecraft" || j.name === "ComponentCraft") {
    j.name = "ctrlc";
  }
  if (j.keywords) {
    j.keywords = j.keywords.map((k) => {
      const lower = String(k).toLowerCase();
      if (
        lower.includes("ctrlc") ||
        lower.includes("pagecraft") ||
        lower.includes("componentcraft")
      ) {
        return "ctrlc";
      }
      return k;
    });
    if (!j.keywords.includes("ctrlc")) j.keywords.unshift("ctrlc");
  }
  if (j.scripts) {
    for (const key of Object.keys(j.scripts)) {
      if (
        key === "CtrlC" ||
        key === "Pagecraft" ||
        key === "ComponentCraft" ||
        key === "pagecraft" ||
        key === "componentcraft"
      ) {
        j.scripts.ctrlc = j.scripts[key];
        if (key !== "ctrlc") delete j.scripts[key];
      }
    }
  }
  if (j.bin && typeof j.bin === "object") {
    for (const key of Object.keys(j.bin)) {
      if (
        key === "CtrlC" ||
        key === "Pagecraft" ||
        key === "ComponentCraft" ||
        key === "pagecraft" ||
        key === "componentcraft"
      ) {
        j.bin.ctrlc = j.bin[key];
        if (key !== "ctrlc") delete j.bin[key];
      }
    }
  }
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
}

console.log(`CtrlC rename: updated ${n} text files + package manifests`);
