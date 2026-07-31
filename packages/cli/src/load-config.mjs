/**
 * Load a host SectionPackConfig from a module path or well-known defaults.
 *
 * Supports:
 * - default export object with .sections
 * - default export factory () => config
 * - named createDemoSectionPackConfig / createSectionPackConfig / sectionPackConfig / config
 *
 * TypeScript host configs require `tsx` (devDependency of this package / monorepo root).
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

let tsxReady = false;
let tsxTried = false;

async function ensureTsLoader() {
  if (tsxTried) return;
  tsxTried = true;
  try {
    const api = await import("tsx/esm/api");
    if (typeof api.register === "function") {
      api.register();
      tsxReady = true;
    }
  } catch {
    // tsx optional until a .ts config is loaded
  }
}

/**
 * @param {string} absPath
 */
async function importModule(absPath) {
  const isTs = /\.(mts|cts|ts)$/i.test(absPath);
  if (isTs) {
    await ensureTsLoader();
    if (!tsxReady) {
      throw new Error(
        `Cannot load TypeScript config without tsx: ${absPath}\n` +
          `Install tsx (npm i -D tsx) or pass a .mjs/.js config via --config.`,
      );
    }
  }
  const href = pathToFileURL(absPath).href;
  return import(href);
}

/**
 * @param {any} mod
 * @param {string} label
 */
export function configFromModule(mod, label = "module") {
  // CJS interop: --import tsx may nest named exports under default
  const candidates = [mod];
  if (mod?.default && typeof mod.default === "object") {
    candidates.push(mod.default);
    if (mod.default.default && typeof mod.default.default === "object") {
      candidates.push(mod.default.default);
    }
  }

  for (const m of candidates) {
    if (typeof m.createDemoSectionPackConfig === "function") {
      return m.createDemoSectionPackConfig();
    }
    if (typeof m.createSectionPackConfig === "function") {
      return m.createSectionPackConfig();
    }
    if (m.sectionPackConfig && Array.isArray(m.sectionPackConfig.sections)) {
      return m.sectionPackConfig;
    }
    if (m.config && Array.isArray(m.config.sections)) {
      return m.config;
    }
    if (typeof m.default === "function") {
      const out = m.default();
      if (out && Array.isArray(out.sections)) return out;
    }
    if (m.default && typeof m.default === "object" && Array.isArray(m.default.sections)) {
      return m.default;
    }
    if (Array.isArray(m.sections)) {
      return m;
    }
  }

  throw new Error(
    `Could not load SectionPackConfig from ${label}. ` +
      `Export default config object, default factory, sectionPackConfig, createSectionPackConfig, or createDemoSectionPackConfig.`,
  );
}

/** Well-known host config locations relative to project cwd. */
export const CONFIG_CANDIDATES = [
  "sectionpack.config.ts",
  "sectionpack.config.mts",
  "sectionpack.config.mjs",
  "sectionpack.config.js",
  "section-pack.config.ts",
  "section-pack.config.mjs",
  "src/lib/section-pack-config.ts",
  "src/lib/section-pack-config.mjs",
  "src/lib/sectionpack.config.ts",
  "lib/section-pack-config.ts",
];

/**
 * @param {string} cwd
 * @returns {string | null}
 */
export function findConfigPath(cwd) {
  for (const rel of CONFIG_CANDIDATES) {
    const abs = path.join(cwd, rel);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  }
  return null;
}

/**
 * @param {{
 *   configPath?: string | null,
 *   cwd: string,
 *   core: any,
 * }} opts
 */
export async function loadSectionPackConfig(opts) {
  const { cwd, core } = opts;
  let configPath = opts.configPath ?? null;

  if (!configPath) {
    configPath = findConfigPath(cwd);
  }

  if (!configPath) {
    return {
      config: core.createDemoSectionPackConfig(),
      source: "createDemoSectionPackConfig()",
      configPath: null,
    };
  }

  const abs = path.resolve(configPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Config not found: ${abs}`);
  }

  const mod = await importModule(abs);
  let config = configFromModule(mod, abs);

  // Auto-merge .ctrlc/registry.json (written by `ctrlc register`)
  const regPath = path.join(cwd, ".ctrlc", "registry.json");
  if (
    fs.existsSync(regPath) &&
    core &&
    typeof core.mergeSectionRegistry === "function"
  ) {
    try {
      const reg = JSON.parse(fs.readFileSync(regPath, "utf8"));
      config = core.mergeSectionRegistry(config, reg);
      return {
        config,
        source: `${abs} + ${regPath}`,
        configPath: abs,
        registryPath: regPath,
      };
    } catch {
      // ignore invalid registry; host config still used
    }
  }

  return {
    config,
    source: abs,
    configPath: abs,
  };
}
