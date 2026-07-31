/**
 * CtrlC MCP tool handlers (callable without the MCP handshake).
 *
 * Tools focus on SectionPack: list sections, build packs, validate config.
 * Prefer packs over full clone workflows.
 */

import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadCore } from "./load-core.mjs";
import { loadSectionPackConfig } from "./load-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MCP_ROOT = path.resolve(__dirname, "..");
const MONOREPO_ROOT = path.resolve(MCP_ROOT, "../..");
const CLI_BIN = path.join(MONOREPO_ROOT, "packages/cli/bin/ctrlc.mjs");

/** Pack formats exposed via MCP (no zip / binary). */
export const MCP_PACK_FORMATS = [
  "describe",
  "prompt",
  "prompt-short",
  "json",
];

/**
 * @typedef {{
 *   cwd?: string,
 *   configPath?: string | null,
 *   structureOnly?: boolean,
 *   sectionId?: string,
 *   format?: string,
 * }} ToolArgs
 */

/**
 * @param {ToolArgs | null | undefined} args
 * @returns {{ cwd: string, configPath: string | null }}
 */
export function resolveToolContext(args = {}) {
  const cwdRaw =
    args?.cwd ??
    process.env.CTRLC_CWD ??
    process.env.CTRLC_PROJECT ??
    process.cwd();
  const cwd = path.resolve(String(cwdRaw));
  const configPath = args?.configPath
    ? path.isAbsolute(args.configPath)
      ? args.configPath
      : path.resolve(cwd, args.configPath)
    : null;
  return { cwd, configPath };
}

/**
 * MCP tool definitions (JSON Schema for tools/list).
 */
export const TOOL_DEFINITIONS = [
  {
    name: "CTRLC_list",
    description:
      "List SectionPack section ids and recipes for a project cwd. Packs-first context for agents (not a full clone).",
    inputSchema: {
      type: "object",
      properties: {
        cwd: {
          type: "string",
          description:
            "Project root with section pack config (default: CTRLC_CWD or process.cwd())",
        },
        configPath: {
          type: "string",
          description: "Optional path to section pack config module",
        },
      },
    },
  },
  {
    name: "CTRLC_pack",
    description:
      "Build a SectionPack for one section id. Formats: describe, prompt, prompt-short, json. Returns natural language + code-as-is (never HTML dumps).",
    inputSchema: {
      type: "object",
      properties: {
        sectionId: {
          type: "string",
          description: "Section id (e.g. hero, features, cta)",
        },
        format: {
          type: "string",
          enum: MCP_PACK_FORMATS,
          description: "Copy format (default: describe)",
        },
        cwd: {
          type: "string",
          description: "Project root (default: CTRLC_CWD or process.cwd())",
        },
        configPath: {
          type: "string",
          description: "Optional path to section pack config module",
        },
      },
      required: ["sectionId"],
    },
  },
  {
    name: "CTRLC_validate",
    description:
      "Validate SectionPack config structure (and optionally filesystem paths).",
    inputSchema: {
      type: "object",
      properties: {
        cwd: {
          type: "string",
          description: "Project root (default: CTRLC_CWD or process.cwd())",
        },
        configPath: {
          type: "string",
          description: "Optional path to section pack config module",
        },
        structureOnly: {
          type: "boolean",
          description:
            "If true, skip filesystem path checks (default: true for agent safety)",
        },
      },
    },
  },
  {
    name: "CTRLC_library_summary",
    description:
      "Short summary of sections from config (ids, labels, tags, component paths). No full library write.",
    inputSchema: {
      type: "object",
      properties: {
        cwd: {
          type: "string",
          description: "Project root (default: CTRLC_CWD or process.cwd())",
        },
        configPath: {
          type: "string",
          description: "Optional path to section pack config module",
        },
      },
    },
  },
  {
    name: "CTRLC_doctor",
    description:
      "Run ctrlc doctor environment checks (Node, core, capture, monorepo paths).",
    inputSchema: {
      type: "object",
      properties: {
        cwd: {
          type: "string",
          description: "Noted in output only (checks are monorepo-oriented)",
        },
      },
    },
  },
];

/**
 * @param {any} core
 * @param {string} cwd
 * @param {string | null} configPath
 */
async function loadConfig(core, cwd, configPath) {
  return loadSectionPackConfig({ cwd, configPath, core });
}

/**
 * @param {ToolArgs} [args]
 */
export async function toolList(args = {}) {
  const core = await loadCore();
  const { cwd, configPath } = resolveToolContext(args);
  const loaded = await loadConfig(core, cwd, configPath);

  const sections = core.listSectionEntries(loaded.config).map((e) => ({
    id: e.id,
    label: e.label,
    description: e.description ?? null,
    tags: e.tags ?? [],
    componentPath: e.componentPath,
    componentExport: e.componentExport,
  }));
  const recipes = (loaded.config.recipes ?? []).map((r) => ({
    id: r.id,
    label: r.label,
    sectionIds: r.sectionIds,
  }));

  return {
    ok: true,
    cwd,
    configSource: loaded.source,
    sectionCount: sections.length,
    recipeCount: recipes.length,
    ids: sections.map((s) => s.id),
    sections,
    recipes,
  };
}

/**
 * @param {ToolArgs} [args]
 */
export async function toolPack(args = {}) {
  const core = await loadCore();
  const { cwd, configPath } = resolveToolContext(args);
  const sectionId = args.sectionId ? String(args.sectionId) : "";
  if (!sectionId) {
    return {
      ok: false,
      error: "sectionId is required",
      knownFormats: MCP_PACK_FORMATS,
    };
  }

  const formatRaw = args.format ? String(args.format) : "describe";
  const format = core.parseCopyFormat(formatRaw);
  if (!format || !MCP_PACK_FORMATS.includes(format)) {
    return {
      ok: false,
      error: `Unknown or unsupported format "${formatRaw}". Use: ${MCP_PACK_FORMATS.join(", ")}`,
      knownFormats: MCP_PACK_FORMATS,
    };
  }

  const loaded = await loadConfig(core, cwd, configPath);
  const entry = core.getSectionEntry(loaded.config, sectionId);
  if (!entry) {
    const known = core.listSectionIds(loaded.config);
    return {
      ok: false,
      error: `Unknown section id "${sectionId}"`,
      knownSections: known,
    };
  }

  const pack = core.buildSectionPack(entry, loaded.config, { cwd });
  const text = core.formatPackForCopy(pack, format, null, {
    defaultVariables: loaded.config.defaultVariables,
  });

  return {
    ok: true,
    cwd,
    configSource: loaded.source,
    sectionId: pack.id ?? sectionId,
    label: pack.label ?? entry.label ?? sectionId,
    format,
    contentHash: pack.contentHash,
    byteLength: Buffer.byteLength(text, "utf8"),
    text,
  };
}

/**
 * @param {ToolArgs} [args]
 */
export async function toolValidate(args = {}) {
  const core = await loadCore();
  const { cwd, configPath } = resolveToolContext(args);
  // Agents usually want structure first; path checks can fail outside host checkout
  const structureOnly =
    args.structureOnly === undefined ? true : Boolean(args.structureOnly);
  const checkPaths = !structureOnly;

  const loaded = await loadConfig(core, cwd, configPath);
  const result = core.validateSectionPackConfig(loaded.config, {
    cwd,
    checkPaths,
    requireBehaviorBrief: true,
  });

  return {
    ok: result.ok,
    cwd,
    configSource: loaded.source,
    checkPaths,
    sectionCount: loaded.config.sections?.length ?? 0,
    recipeCount: loaded.config.recipes?.length ?? 0,
    errors: result.errors ?? [],
    warnings: result.warnings ?? [],
  };
}

/**
 * @param {ToolArgs} [args]
 */
export async function toolLibrarySummary(args = {}) {
  const core = await loadCore();
  const { cwd, configPath } = resolveToolContext(args);
  const loaded = await loadConfig(core, cwd, configPath);
  const entries = core.listSectionEntries(loaded.config);

  const sections = entries.map((e) => {
    let contentHash = null;
    try {
      const pack = core.buildSectionPack(e, loaded.config, { cwd });
      contentHash = pack.contentHash ?? null;
    } catch {
      contentHash = null;
    }
    return {
      id: e.id,
      label: e.label ?? e.id,
      tags: e.tags ?? [],
      componentPath: e.componentPath,
      componentExport: e.componentExport,
      contentKeys: e.contentKeys ?? [],
      cssSelectors: e.cssSelectors ?? [],
      contentHash,
    };
  });

  const recipes = (loaded.config.recipes ?? []).map((r) => ({
    id: r.id,
    label: r.label,
    sectionIds: r.sectionIds,
  }));

  return {
    ok: true,
    cwd,
    configSource: loaded.source,
    sectionCount: sections.length,
    recipeCount: recipes.length,
    sections,
    recipes,
    note: "Summary only. Use ctrlc library CLI or CTRLC_pack for full NL + code packs.",
  };
}

/**
 * Run doctor via CLI spawn (JSON). Falls back to inline minimal checks if CLI missing.
 * @param {ToolArgs} [args]
 */
export async function toolDoctor(args = {}) {
  const { cwd } = resolveToolContext(args);

  const r = spawnSync(
    process.execPath,
    [CLI_BIN, "doctor", "--json", "--cwd", cwd],
    {
      encoding: "utf8",
      cwd: MONOREPO_ROOT,
      env: process.env,
      windowsHide: true,
      timeout: 30_000,
    },
  );

  if (r.error && /** @type {NodeJS.ErrnoException} */ (r.error).code === "ENOENT") {
    return inlineDoctor(cwd, `CLI spawn failed: ${r.error.message}`);
  }

  const stdout = (r.stdout ?? "").trim();
  if (stdout) {
    try {
      const parsed = JSON.parse(stdout);
      return {
        ok: Boolean(parsed.ok),
        via: "cli",
        cwd,
        ...parsed,
      };
    } catch {
      // fall through
    }
  }

  return inlineDoctor(
    cwd,
    `CLI doctor failed (status=${r.status}): ${(r.stderr || r.stdout || "").slice(0, 500)}`,
  );
}

/**
 * @param {string} cwd
 * @param {string} [note]
 */
async function inlineDoctor(cwd, note) {
  /** @type {Array<{ id: string, ok: boolean, level: string, detail: string }>} */
  const checks = [];
  const major = Number(process.versions.node.split(".")[0]);
  const nodeOk = Number.isFinite(major) && major >= 20;
  checks.push({
    id: "node",
    ok: nodeOk,
    level: nodeOk ? "info" : "error",
    detail: `Node ${process.versions.node}`,
  });

  let coreOk = false;
  let coreDetail = "";
  try {
    await loadCore();
    coreOk = true;
    coreDetail = "@ctrlc/core loaded";
  } catch (e) {
    coreDetail = String(/** @type {Error} */ (e)?.message ?? e);
  }
  checks.push({
    id: "core",
    ok: coreOk,
    level: coreOk ? "info" : "error",
    detail: coreDetail,
  });

  const hardFail = checks.some((c) => !c.ok && c.level === "error");
  return {
    ok: !hardFail,
    via: "inline",
    cwd,
    monorepoRoot: MONOREPO_ROOT,
    note: note ?? null,
    checks,
  };
}

/**
 * Dispatch a tool by name.
 * @param {string} name
 * @param {ToolArgs} [args]
 */
export async function callTool(name, args = {}) {
  switch (name) {
    case "CTRLC_list":
      return toolList(args);
    case "CTRLC_pack":
      return toolPack(args);
    case "CTRLC_validate":
      return toolValidate(args);
    case "CTRLC_library_summary":
      return toolLibrarySummary(args);
    case "CTRLC_doctor":
      return toolDoctor(args);
    default:
      return {
        ok: false,
        error: `Unknown tool: ${name}`,
        knownTools: TOOL_DEFINITIONS.map((t) => t.name),
      };
  }
}
