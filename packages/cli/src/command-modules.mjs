/**
 * Static registry of pipeline / capture-postprocess command modules.
 *
 * Bundlers (esbuild) need static imports; dynamic import(path) of sibling
 * files does not resolve once sources are packed into dist/cli.mjs.
 */

import * as materializeAssets from "./materialize-assets.mjs";
import * as tokensFromIr from "./tokens-from-ir.mjs";
import * as registerFromIr from "./register-from-ir.mjs";
import * as baseline from "./baseline.mjs";
import * as planParallel from "./plan-parallel.mjs";
import * as hygienizeIr from "./hygienize-ir.mjs";
import * as scaffoldFromIr from "./scaffold-from-ir.mjs";
import * as visualDiff from "./visual-diff.mjs";
import * as adaptIr from "./adapt-ir.mjs";
import * as capture from "./capture.mjs";
import * as specsFromIr from "./specs-from-ir.mjs";

/**
 * Command name -> module namespace (static imports for bundling).
 * @type {Record<string, Record<string, unknown>>}
 */
export const COMMAND_MODULES = {
  "materialize-assets": materializeAssets,
  "tokens-from-ir": tokensFromIr,
  "register-from-ir": registerFromIr,
  baseline,
  "plan-parallel": planParallel,
  "hygienize-ir": hygienizeIr,
  "scaffold-from-ir": scaffoldFromIr,
  "visual-diff": visualDiff,
  "adapt-ir": adaptIr,
  // Also used by pipeline orchestration (siblings of cli entry).
  capture,
  "specs-from-ir": specsFromIr,
};

/**
 * @param {string} name  kebab-case command (e.g. "tokens-from-ir")
 * @returns {Record<string, unknown> | null}
 */
export function getCommandModule(name) {
  if (!name || typeof name !== "string") return null;
  return COMMAND_MODULES[name] ?? null;
}

/**
 * Resolve cmd export: cmdFooBar from "foo-bar", or default/run.
 * @param {Record<string, unknown> | null | undefined} mod
 * @param {string} command
 * @returns {((args: import("./args.mjs").ParsedArgs, core?: unknown) => Promise<number|void>) | null}
 */
export function resolveCommandFn(mod, command) {
  if (!mod || typeof mod !== "object") return null;
  const camel =
    "cmd" +
    String(command)
      .split("-")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join("");
  const fn = mod[camel] || mod.default || mod.run;
  return typeof fn === "function" ? /** @type {any} */ (fn) : null;
}
