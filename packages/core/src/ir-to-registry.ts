/**
 * D10 - Emit SectionPack registry (.ctrlc/registry.json) from Page IR.
 */

import fs from "node:fs";
import path from "node:path";
import {
  behaviorFromIRSection,
  camelFromId,
  listIrSections,
  loadPageIR,
  parsePageIR,
  pascalFromId,
  type PageIR,
  type PageIrSection,
} from "./ir-to-specs";
import {
  emptyRegistry,
  upsertRegistrySection,
  type SectionPackRegistryFile,
} from "./registry";
import { inferRecipesFromIR } from "./recipe-from-ir";
import type { PackRecipe, SectionPackEntry } from "./types";

export type IrToRegistryOptions = {
  /** default: src/components/sections */
  componentDir?: string;
  /** default: src/styles/clone.css */
  cssPath?: string;
  /** default: src/content/home.ts */
  contentModulePath?: string;
  /** Attach behavior brief via behaviorFromIRSection (default true) */
  includeBehavior?: boolean;
};

export type WriteRegistryFromIROptions = IrToRegistryOptions & {
  /** Output path for registry.json (e.g. .ctrlc/registry.json) */
  outPath: string;
  /** Merge with existing registry if present (default true) */
  merge?: boolean;
};

export type WriteRegistryFromIRResult = {
  registry: SectionPackRegistryFile;
  path: string;
  sectionIds: string[];
};

/**
 * Map one IR section to a SectionPackEntry.
 */
export function sectionEntryFromIRSection(
  section: PageIrSection,
  options: IrToRegistryOptions = {},
): SectionPackEntry {
  const id = section.id;
  const label = section.label || id;
  const pascal = pascalFromId(id);
  const camel = camelFromId(id);
  const componentDir = (
    options.componentDir || "src/components/sections"
  ).replace(/\\/g, "/");
  const cssModulePath = (options.cssPath || "src/styles/clone.css").replace(
    /\\/g,
    "/",
  );
  const contentModulePath = (
    options.contentModulePath || "src/content/home.ts"
  ).replace(/\\/g, "/");

  const model = String(section.interactionModel || "static")
    .toLowerCase()
    .trim();
  const description =
    section.description ||
    (section.textSample
      ? truncate(section.textSample, 160)
      : `Section "${label}" from Page IR`);

  const cssSelectors = buildCssSelectors(id, section.selector);
  const tags = uniqueTags([
    model,
    "from-ir",
    ...(Array.isArray(section.tags) ? section.tags.map(String) : []),
  ]);

  const entry: SectionPackEntry = {
    id,
    label,
    description,
    componentPath: `${componentDir.replace(/\/$/, "")}/${pascal}.tsx`,
    componentExport: pascal,
    contentKeys: [camel],
    contentModulePath,
    cssModulePath,
    cssSelectors,
    tags,
    promptRole: promptRoleFromModel(model, label),
  };

  if (options.includeBehavior !== false) {
    try {
      entry.behavior = behaviorFromIRSection(section);
    } catch {
      // keep entry without behavior if brief draft fails
    }
  }

  return entry;
}

/**
 * Build a full registry file from Page IR (sections + inferred recipes).
 */
export function registryFromIR(
  ir: PageIR | unknown,
  options: IrToRegistryOptions = {},
): SectionPackRegistryFile {
  const doc = normalizeIR(ir);
  const sections = listIrSections(doc);
  const entries = sections.map((s) => sectionEntryFromIRSection(s, options));
  const recipes = inferRecipesFromIR(doc);

  return {
    schemaVersion: 1,
    sections: entries,
    recipes,
  };
}

/**
 * Write registry JSON from IR path or IR object.
 * When merge is true (default), upserts sections into any existing file.
 */
export function writeRegistryFromIR(
  irPathOrIR: string | PageIR | unknown,
  options: WriteRegistryFromIROptions,
): WriteRegistryFromIRResult {
  const ir = resolveIR(irPathOrIR);
  const built = registryFromIR(ir, options);
  const outPath = path.resolve(options.outPath);
  const merge = options.merge !== false;

  let registry: SectionPackRegistryFile = built;

  if (merge && fs.existsSync(outPath)) {
    let existing: SectionPackRegistryFile = emptyRegistry();
    try {
      const raw = JSON.parse(fs.readFileSync(outPath, "utf8"));
      if (raw && typeof raw === "object") {
        existing = {
          schemaVersion: raw.schemaVersion ?? 1,
          sections: Array.isArray(raw.sections) ? raw.sections : [],
          recipes: Array.isArray(raw.recipes) ? raw.recipes : undefined,
          defaultVariables: raw.defaultVariables,
          sharedUtilSelectors: raw.sharedUtilSelectors,
        };
      }
    } catch {
      existing = emptyRegistry();
    }

    let merged: SectionPackRegistryFile = {
      schemaVersion: existing.schemaVersion ?? 1,
      sections: [...(existing.sections ?? [])],
      recipes: existing.recipes,
      defaultVariables: existing.defaultVariables,
      sharedUtilSelectors: existing.sharedUtilSelectors,
    };

    for (const entry of built.sections) {
      merged = upsertRegistrySection(merged, entry);
    }
    merged.recipes = mergeRecipes(existing.recipes, built.recipes);
    registry = merged;
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    JSON.stringify(registry, null, 2) + "\n",
    "utf8",
  );

  return {
    registry,
    path: outPath,
    sectionIds: registry.sections.map((s) => s.id),
  };
}

// --- helpers ---

function resolveIR(irPathOrIR: string | PageIR | unknown): PageIR {
  if (typeof irPathOrIR === "string") {
    const abs = path.resolve(irPathOrIR);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      return loadPageIR(abs);
    }
    // treat as JSON text
    try {
      return parsePageIR(irPathOrIR);
    } catch {
      throw new Error(`Page IR not found or invalid: ${irPathOrIR}`);
    }
  }
  return normalizeIR(irPathOrIR);
}

function normalizeIR(ir: PageIR | unknown): PageIR {
  if (ir == null) return {};
  if (typeof ir === "string") {
    try {
      return parsePageIR(ir);
    } catch {
      return {};
    }
  }
  if (typeof ir === "object") return ir as PageIR;
  return {};
}

function buildCssSelectors(id: string, selector?: string): string[] {
  const out: string[] = [`.${id}`];
  if (selector && typeof selector === "string") {
    const sel = selector.trim();
    if (sel && sel !== `.${id}`) {
      // include class selectors and the raw selector when useful
      if (sel.startsWith(".")) {
        out.push(sel);
      } else if (sel.includes(".") || sel.startsWith("#") || sel.includes("[")) {
        out.push(sel);
      } else if (/^[a-zA-Z][\w-]*$/.test(sel)) {
        // bare class token without dot
        out.push(`.${sel}`);
      } else {
        out.push(sel);
      }
    }
  }
  return [...new Set(out)];
}

function promptRoleFromModel(model: string, label: string): string {
  const m = model || "static";
  switch (m) {
    case "scroll":
      return `Scroll-driven ${label}`;
    case "click":
      return `Click-interactive ${label}`;
    case "hover":
      return `Hover-interactive ${label}`;
    case "time":
      return `Time-driven ${label}`;
    case "hybrid":
      return `Hybrid-interaction ${label}`;
    case "static":
    default:
      return `Static ${label}`;
  }
}

function uniqueTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const v = String(t || "")
      .trim()
      .toLowerCase();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function mergeRecipes(
  existing: PackRecipe[] | undefined,
  inferred: PackRecipe[] | undefined,
): PackRecipe[] {
  const byId = new Map<string, PackRecipe>();
  for (const r of existing ?? []) {
    if (r?.id) byId.set(r.id, r);
  }
  for (const r of inferred ?? []) {
    if (r?.id) byId.set(r.id, r);
  }
  return [...byId.values()];
}

function truncate(s: string, n: number): string {
  const t = String(s).replace(/\s+/g, " ").trim();
  return t.length <= n ? t : t.slice(0, n - 1) + "...";
}
