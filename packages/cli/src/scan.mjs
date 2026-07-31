/**
 * scan - discover React section components and emit a draft SectionPackConfig JSON.
 *
 * Philosophy (React-only):
 * - SectionPack exports React/TSX sections + content + CSS, never mirrored HTML dumps.
 * - Scan is a Phase 3 bootstrap helper for cloners: guess paths from filenames, then
 *   a human or agent fills contentKeys, cssSelectors, behavior briefs, and recipes.
 * - When @ctrlc/core is available, each section gets a partial `behavior` draft
 *   from analyzeSectionSources / draftBehaviorBrief (heuristic; edit before shipping).
 *
 * Discovery:
 *   <cwd>/src/components/sections/*.tsx  (skips index.*, *.test.*, *.stories.*, shared/)
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * PascalCase / camelCase file base -> kebab section id.
 * SiteHeader -> site-header, PromoBar -> promo-bar, Hero -> hero, CTA -> cta
 * @param {string} name
 */
export function fileBaseToId(name) {
  const base = name.replace(/\.(tsx|ts|jsx|js)$/i, "");
  if (!base) return "section";
  // Already kebab or snake
  if (base.includes("-") || base.includes("_")) {
    return base.replace(/_/g, "-").replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  }
  // Insert hyphen before capitals; collapse ALLCAPS runs (CTA -> cta, not c-t-a)
  const parts = base
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .split("-")
    .filter(Boolean);
  return parts.map((p) => p.toLowerCase()).join("-") || "section";
}

/**
 * Guess named export from file source or filename.
 * @param {string} source
 * @param {string} fileBase  e.g. "Hero"
 */
export function guessExportName(source, fileBase) {
  const base = fileBase.replace(/\.(tsx|ts|jsx|js)$/i, "");
  const patterns = [
    new RegExp(`export\\s+function\\s+(${base})\\b`),
    new RegExp(`export\\s+const\\s+(${base})\\b`),
    new RegExp(`export\\s+function\\s+([A-Z][A-Za-z0-9_]*)\\b`),
    new RegExp(`export\\s+const\\s+([A-Z][A-Za-z0-9_]*)\\s*=`),
    /export\s+default\s+function\s+([A-Z][A-Za-z0-9_]*)\b/,
  ];
  for (const re of patterns) {
    const m = source.match(re);
    if (m?.[1]) return m[1];
  }
  return base;
}

/**
 * Pull simple class-like tokens from className= strings for cssSelectors guess.
 * @param {string} source
 * @param {string} id
 * @returns {string[]}
 */
export function guessCssSelectors(source, id) {
  const found = new Set();
  // className="foo bar" / className={'foo'} / className={`foo`}
  const re =
    /className\s*=\s*(?:\{)?(?:`|'|")([^`'"}]+)(?:`|'|")/g;
  let m;
  while ((m = re.exec(source))) {
    const tokens = m[1].split(/\s+/).filter(Boolean);
    for (const t of tokens) {
      // skip template expr crumbs
      if (t.includes("${") || t.includes("{") || t.length < 2) continue;
      if (/^[a-zA-Z_][\w-]*$/.test(t)) found.add(`.${t}`);
    }
  }
  // Prefer selectors that look section-scoped (contain id fragment)
  const idFrag = id.replace(/-/g, "");
  const ranked = [...found].sort((a, b) => {
    const as = a.toLowerCase().includes(id) || a.toLowerCase().includes(idFrag) ? 0 : 1;
    const bs = b.toLowerCase().includes(id) || b.toLowerCase().includes(idFrag) ? 0 : 1;
    return as - bs || a.localeCompare(b);
  });
  if (ranked.length) return ranked.slice(0, 6);
  return [`.${id}`];
}

/**
 * @param {string} cwd
 * @returns {{ contentModulePath?: string, cssModulePath: string, relatedPaths: string[] }}
 */
export function guessSharedPaths(cwd) {
  const contentCandidates = [
    "src/content/home.ts",
    "src/content/home.tsx",
    "src/content/page.ts",
    "content/home.ts",
  ];
  let contentModulePath;
  for (const rel of contentCandidates) {
    if (fs.existsSync(path.join(cwd, rel))) {
      contentModulePath = rel.replace(/\\/g, "/");
      break;
    }
  }

  const cssCandidates = [
    "src/styles/demo.css",
    "src/styles/sections.css",
    "src/styles/globals.css",
    "src/app/globals.css",
    "styles/demo.css",
  ];
  let cssModulePath = "src/styles/demo.css";
  for (const rel of cssCandidates) {
    if (fs.existsSync(path.join(cwd, rel))) {
      cssModulePath = rel.replace(/\\/g, "/");
      break;
    }
  }

  // related: shared folder if present
  /** @type {string[]} */
  const relatedPaths = [];
  const sharedDir = path.join(cwd, "src/components/sections/shared");
  if (fs.existsSync(sharedDir) && fs.statSync(sharedDir).isDirectory()) {
    for (const name of fs.readdirSync(sharedDir)) {
      if (/\.(tsx|ts)$/i.test(name) && !name.startsWith(".")) {
        relatedPaths.push(`src/components/sections/shared/${name}`.replace(/\\/g, "/"));
      }
    }
  }

  return { contentModulePath, cssModulePath, relatedPaths };
}

/**
 * @param {string} fileBase e.g. Hero
 * @param {string} id e.g. hero
 */
export function guessContentKey(fileBase, id) {
  const base = fileBase.replace(/\.(tsx|ts|jsx|js)$/i, "");
  // camelCase from PascalCase
  if (/^[A-Z]/.test(base)) {
    return base[0].toLowerCase() + base.slice(1);
  }
  // kebab id -> camelCase
  return id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Title-case label from id.
 * @param {string} id
 * @param {string} exportName
 */
export function guessLabel(id, exportName) {
  if (exportName && exportName.length) {
    return exportName.replace(/([a-z])([A-Z])/g, "$1 $2");
  }
  return id
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Load @ctrlc/core draft helpers when available (workspace, sibling dist, or tsx src).
 * Returns null when core cannot be loaded so scan still works as path-only bootstrap.
 * @returns {Promise<{ draftBehaviorBrief?: Function, analyzeSectionSources?: Function } | null>}
 */
export async function tryLoadCoreDraftHelpers() {
  /** @type {Error[]} */
  const errors = [];

  try {
    const core = await import("@ctrlc/core");
    if (typeof core.draftBehaviorBrief === "function") return core;
  } catch (e) {
    errors.push(/** @type {Error} */ (e));
  }

  const siblingRoot = path.resolve(__dirname, "../../core");
  const siblingDist = path.join(siblingRoot, "dist/index.js");
  if (fs.existsSync(siblingDist)) {
    try {
      const core = await import(pathToFileURL(siblingDist).href);
      if (typeof core.draftBehaviorBrief === "function") return core;
    } catch (e) {
      errors.push(/** @type {Error} */ (e));
    }
  }

  try {
    const corePkg = require.resolve("@ctrlc/core/package.json");
    const coreRoot = path.dirname(corePkg);
    const dist = path.join(coreRoot, "dist/index.js");
    if (fs.existsSync(dist)) {
      const core = await import(pathToFileURL(dist).href);
      if (typeof core.draftBehaviorBrief === "function") return core;
    }
  } catch (e) {
    errors.push(/** @type {Error} */ (e));
  }

  const siblingSrc = path.join(siblingRoot, "src/index.ts");
  if (fs.existsSync(siblingSrc)) {
    try {
      const api = await import("tsx/esm/api");
      api.register();
      const core = await import(pathToFileURL(siblingSrc).href);
      if (typeof core.draftBehaviorBrief === "function") return core;
    } catch (e) {
      errors.push(/** @type {Error} */ (e));
    }
  }

  if (process.env.CTRLC_DEBUG && errors.length) {
    console.error(
      "scan: could not load @ctrlc/core for behavior drafts:\n" +
        errors.map((e) => String(e?.message ?? e)).join("\n"),
    );
  }
  return null;
}

/**
 * Slim behavior object for draft config (heuristic; hosts should edit).
 * @param {import("@ctrlc/core").BehaviorBriefSpec} brief
 */
export function toPartialBehavior(brief) {
  if (!brief || typeof brief !== "object") return undefined;
  return {
    id: brief.id,
    whatItIs: brief.whatItIs,
    function: brief.function,
    behavior: Array.isArray(brief.behavior) ? [...brief.behavior] : [],
    motion: Array.isArray(brief.motion) ? [...brief.motion] : [],
    layout: Array.isArray(brief.layout) ? [...brief.layout] : [],
    color: Array.isArray(brief.color) ? [...brief.color] : [],
    type: Array.isArray(brief.type) ? [...brief.type] : [],
    responsive: Array.isArray(brief.responsive) ? [...brief.responsive] : [],
    a11y: Array.isArray(brief.a11y) ? [...brief.a11y] : [],
    influences: Array.isArray(brief.influences) ? [...brief.influences] : [],
    rebuildGuidance: Array.isArray(brief.rebuildGuidance)
      ? [...brief.rebuildGuidance]
      : [],
  };
}

/**
 * @param {{ cwd: string, sectionsDir?: string, core?: any, skipBehavior?: boolean }} opts
 */
export async function scanSections(opts) {
  const cwd = opts.cwd;
  const sectionsDirRel = (opts.sectionsDir ?? "src/components/sections").replace(
    /\\/g,
    "/",
  );
  const sectionsDir = path.join(cwd, sectionsDirRel);

  if (!fs.existsSync(sectionsDir) || !fs.statSync(sectionsDir).isDirectory()) {
    return {
      ok: false,
      error: `No sections directory at ${sectionsDirRel} (cwd: ${cwd})`,
      draft: null,
      discovered: [],
    };
  }

  const names = fs
    .readdirSync(sectionsDir)
    .filter((n) => {
      if (!/\.tsx$/i.test(n)) return false;
      if (/^index\./i.test(n)) return false;
      if (/\.(test|spec|stories)\./i.test(n)) return false;
      return true;
    })
    .sort((a, b) => a.localeCompare(b));

  const shared = guessSharedPaths(cwd);
  /** @type {any[]} */
  const sections = [];
  /** @type {any[]} */
  const discovered = [];

  let core = opts.core ?? null;
  let behaviorDrafts = 0;
  if (!opts.skipBehavior && !core) {
    core = await tryLoadCoreDraftHelpers();
  }
  const canDraft =
    !opts.skipBehavior && core && typeof core.draftBehaviorBrief === "function";

  for (const name of names) {
    const componentPath = `${sectionsDirRel}/${name}`.replace(/\\/g, "/");
    const abs = path.join(cwd, componentPath);
    let source = "";
    try {
      source = fs.readFileSync(abs, "utf8");
    } catch {
      source = "";
    }
    const id = fileBaseToId(name);
    const componentExport = guessExportName(source, name);
    const label = guessLabel(id, componentExport);
    const contentKey = guessContentKey(name, id);
    const cssSelectors = guessCssSelectors(source, id);

    /** @type {Record<string, unknown>} */
    const entry = {
      id,
      label,
      description: `${label} section (draft from scan; edit before shipping).`,
      componentPath,
      componentExport,
      contentKeys: shared.contentModulePath ? [contentKey] : [],
      ...(shared.contentModulePath
        ? { contentModulePath: shared.contentModulePath }
        : {}),
      cssSelectors,
      cssModulePath: shared.cssModulePath,
      ...(shared.relatedPaths.length ? { relatedPaths: [...shared.relatedPaths] } : {}),
      tags: [id.split("-")[0] || "section"],
      promptRole: `${label} React section`,
    };

    if (canDraft) {
      try {
        const { brief } = core.draftBehaviorBrief(entry, {
          cwd,
          componentSource: source,
        });
        const partial = toPartialBehavior(brief);
        if (partial) {
          entry.behavior = partial;
          behaviorDrafts++;
        }
      } catch (e) {
        if (process.env.CTRLC_DEBUG) {
          console.error(`scan: draftBehaviorBrief failed for ${id}:`, e);
        }
      }
    }

    sections.push(entry);
    discovered.push({
      id,
      file: componentPath,
      export: componentExport,
      hasBehavior: Boolean(entry.behavior),
    });
  }

  const draft = {
    // Draft only: React section components + content + CSS. Not HTML dumps.
    // Fill / tighten contentKeys, cssSelectors, behavior briefs, then defineSectionPackConfig.
    defaultVariables: {
      productName: "Product",
      tagline: "Tagline",
      demoHref: "/demo",
      email: "hello@example.com",
      primaryCta: "Get started",
    },
    sharedUtilSelectors: [".btn", ".container", ".section"],
    recipes: sections.length
      ? [
          {
            id: "page-core",
            label: "Page core",
            description: "All scanned sections in filename order",
            sectionIds: sections.map((s) => s.id),
          },
        ]
      : [],
    sections,
  };

  return {
    ok: true,
    error: null,
    draft,
    discovered,
    meta: {
      cwd,
      sectionsDir: sectionsDirRel,
      contentModulePath: shared.contentModulePath ?? null,
      cssModulePath: shared.cssModulePath,
      count: sections.length,
      behaviorDrafts,
      coreDraft: Boolean(canDraft),
    },
  };
}
