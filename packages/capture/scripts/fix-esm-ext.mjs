/**
 * tsc (moduleResolution bundler) emits extensionless relative imports.
 * Node ESM requires explicit .js - rewrite dist after build.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, "..", "dist");

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (name.endsWith(".js")) fixFile(p);
  }
}

function fixFile(file) {
  let src = fs.readFileSync(file, "utf8");
  const next = src.replace(
    /(from\s+["'])(\.[^"']+)(["'])/g,
    (full, a, spec, c) => {
      if (
        spec.endsWith(".js") ||
        spec.endsWith(".json") ||
        spec.endsWith(".mjs")
      ) {
        return full;
      }
      return `${a}${spec}.js${c}`;
    },
  );
  if (next !== src) fs.writeFileSync(file, next);
}

if (fs.existsSync(dist)) {
  walk(dist);
  console.log("fix-esm-ext: ok");
}
