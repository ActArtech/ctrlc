/**
 * Normalize technical identifiers after brand rename to CtrlC.
 * Prose keeps "CtrlC"; CLI/bin/npm stay lowercase ctrlc.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const skip = new Set(["node_modules", ".next", "dist", "runs", ".git"]);
const textExt = new Set([
  ".md",
  ".mjs",
  ".js",
  ".ts",
  ".tsx",
  ".json",
  ".yml",
  ".yaml",
  ".css",
  ".html",
  ".txt",
  ".toml",
]);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(ent.name)) continue;
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

/** @param {string} s */
function fix(s) {
  let out = s;
  const pairs = [
    ["bin/ctrlc.mjs", "bin/ctrlc.mjs"],
    ["CtrlC contributors", "CtrlC contributors"],
    ["ctrlc:section-pack-mode", "ctrlc:section-pack-mode"],
    ["ctrlc:pack-hud-collapsed", "ctrlc:pack-hud-collapsed"],
    ["ctrlc-capture/", "ctrlc-capture/"],
    ["https://ctrlc.dev", "https://ctrlc.dev"],
    ["https://ctrlc.dev", "https://ctrlc.dev"],
    ["npm run ctrlc", "npm run ctrlc"],
    ["ctrlc <command>", "ctrlc <command>"],
    ["*   ctrlc ", "*   ctrlc "],
    ["  ctrlc ", "  ctrlc "],
    ["ctrlc_", "ctrlc_"],
    ["ctrlc_list", "ctrlc_list"],
    ["ctrlc_pack", "ctrlc_pack"],
    ["ctrlc_validate", "ctrlc_validate"],
    ["ctrlc_library_summary", "ctrlc_library_summary"],
    ["ctrlc_doctor", "ctrlc_doctor"],
    ['"name": "ctrlc"', '"name": "ctrlc"'],
    ['"ctrlc",', '"ctrlc",'],
  ];
  for (const [a, b] of pairs) out = out.split(a).join(b);

  // CLI invocations: ctrlc list|pack|...
  out = out.replace(
    /(?<!@|\w)CtrlC (list|pack|pack-multi|validate|doctor|pipeline|capture|help|init-clone|qa|register|snapshot|library|watch|graph|scan|baseline|adapt-ir|plan-parallel|visual-diff|materialize-assets|tokens-from-ir|register-from-ir|specs-from-ir|register-from-spec)\b/g,
    "ctrlc $1",
  );

  return out;
}

let n = 0;
for (const f of walk(root)) {
  const orig = fs.readFileSync(f, "utf8");
  const next = fix(orig);
  if (next !== orig) {
    fs.writeFileSync(f, next);
    n++;
  }
}
console.log(`fixed ${n} files`);
