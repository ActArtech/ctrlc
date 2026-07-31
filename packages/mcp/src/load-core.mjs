/**
 * Load @ctrlc/core the same way the CLI does (workspace name, sibling dist, tsx src).
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @returns {Promise<typeof import("@ctrlc/core")>}
 */
export async function loadCore() {
  /** @type {Error[]} */
  const errors = [];

  try {
    return await import("@ctrlc/core");
  } catch (e) {
    errors.push(/** @type {Error} */ (e));
  }

  const siblingRoot = path.resolve(__dirname, "../../core");
  const siblingDist = path.join(siblingRoot, "dist/index.js");
  const siblingSrc = path.join(siblingRoot, "src/index.ts");
  if (fs.existsSync(siblingDist)) {
    return import(pathToFileURL(siblingDist).href);
  }

  try {
    const corePkg = require.resolve("@ctrlc/core/package.json");
    const coreRoot = path.dirname(corePkg);
    const dist = path.join(coreRoot, "dist/index.js");
    if (fs.existsSync(dist)) {
      return import(pathToFileURL(dist).href);
    }
    const src = path.join(coreRoot, "src/index.ts");
    if (fs.existsSync(src)) {
      const api = await import("tsx/esm/api");
      api.register();
      return import(pathToFileURL(src).href);
    }
  } catch (e) {
    errors.push(/** @type {Error} */ (e));
  }

  if (fs.existsSync(siblingSrc)) {
    try {
      const api = await import("tsx/esm/api");
      api.register();
      return import(pathToFileURL(siblingSrc).href);
    } catch (e) {
      errors.push(/** @type {Error} */ (e));
    }
  }

  throw new Error(
    `Failed to load @ctrlc/core. Run npm install && npm run build from the monorepo root.\n` +
      errors.map((e) => String(e?.message ?? e)).join("\n"),
  );
}
