/**
 * B6 - Optional external capture adapter (Ditto-inspired, adapter only).
 *
 * Convert third-party capture artifacts (generic file-map JSON or
 * section-oriented IR) into CtrlC Page IR. No network calls, no
 * vendored third-party source - pure shape normalization heuristics.
 */

import fs from "node:fs";
import path from "node:path";
import {
  pascalFromId,
  type IrInteractionModel,
  type PageIR,
  type PageIrAsset,
  type PageIrSection,
} from "./ir-to-specs";

/** Loose file-map shaped capture (Ditto-like unpack output). */
export type ExternalFileMap = {
  files?: Record<string, string>;
  [k: string]: unknown;
};

/**
 * Loose third-party capture document.
 * Accepts section arrays, multi-page shells, and/or file maps.
 */
export type ExternalCapture = {
  sourceUrl?: string;
  title?: string;
  viewport?: { width?: number; height?: number };
  sections?: Array<Record<string, unknown>>;
  tokens?: {
    colors?: string[];
    fonts?: string[];
    cssVariables?: Record<string, string>;
  };
  assets?: Array<{
    url?: string;
    kind?: string;
    path?: string;
    localPath?: string;
  }>;
  /** Ditto-like multi-page shell */
  pages?: Array<{
    url?: string;
    sections?: unknown[];
    title?: string;
  }>;
  /** File path -> content (or metadata string) */
  fileMap?: Record<string, string>;
  files?: Record<string, string>;
  [k: string]: unknown;
};

export type AdaptExternalCaptureOptions = {
  /** Override / fill sourceUrl when missing on input */
  sourceUrl?: string;
  /** Override capturedAt (default: now ISO) */
  capturedAt?: string;
};

export type WriteAdaptedIrResult = {
  ir: PageIR;
  path: string;
};

const ADAPTED_NOTE = "adaptedFrom: external-capture";
const INTERACTION_MODELS = new Set<string>([
  "static",
  "click",
  "scroll",
  "hover",
  "time",
  "hybrid",
]);

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|avif|ico|bmp)(\?.*)?$/i;
const FONT_EXT_RE = /\.(woff2?|ttf|otf|eot)(\?.*)?$/i;
const VIDEO_EXT_RE = /\.(mp4|webm|ogg|mov)(\?.*)?$/i;

/** Section / component path patterns used to invent sections from file maps. */
const SECTION_PATH_RE =
  /(?:^|\/)(?:components|sections)\/(?:sections\/)?([^/]+?)(?:\.(?:tsx?|jsx?|vue|svelte|md|json))?$/i;

/**
 * Normalize free-form ids to kebab-case section ids.
 * "HeroBanner" / "hero_banner" / "hero banner" -> "hero-banner"
 */
export function normalizeSectionId(raw: string): string {
  const s = String(raw ?? "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return s || "section";
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function asString(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") {
    const t = v.trim();
    return t || undefined;
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return undefined;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function normalizeInteractionModel(raw: unknown): IrInteractionModel {
  const s = asString(raw)?.toLowerCase();
  if (s && INTERACTION_MODELS.has(s)) return s as IrInteractionModel;
  return "static";
}

function resolveFileMap(input: ExternalCapture): Record<string, string> {
  const out: Record<string, string> = {};
  const maps = [input.fileMap, input.files];
  for (const m of maps) {
    if (!m || typeof m !== "object") continue;
    for (const [k, v] of Object.entries(m)) {
      if (typeof k !== "string" || !k.trim()) continue;
      out[k.replace(/\\/g, "/")] = v == null ? "" : String(v);
    }
  }
  return out;
}

function inventSectionsFromFileMap(
  fileMap: Record<string, string>,
): PageIrSection[] {
  const seen = new Set<string>();
  const sections: PageIrSection[] = [];

  const keys = Object.keys(fileMap).sort();
  for (const key of keys) {
    const norm = key.replace(/\\/g, "/");
    // Prefer components/ and sections/ trees; skip shared/utils noise
    if (!/(?:^|\/)(components|sections)\//i.test(norm)) continue;
    if (/(?:^|\/)(shared|utils|hooks|lib|types|__tests__|node_modules)\//i.test(norm)) {
      continue;
    }

    const m = norm.match(SECTION_PATH_RE);
    if (!m) continue;
    const base = m[1];
    if (!base || /^(index|page|layout|loading|error|template)$/i.test(base)) {
      continue;
    }

    const id = normalizeSectionId(base);
    if (seen.has(id)) continue;
    seen.add(id);

    const content = fileMap[key] ?? "";
    const textSample =
      typeof content === "string" && content.length > 0
        ? content.slice(0, 160).replace(/\s+/g, " ").trim()
        : undefined;

    sections.push({
      id,
      label: pascalFromId(id).replace(/([a-z])([A-Z])/g, "$1 $2") || id,
      interactionModel: "static",
      textSample: textSample || undefined,
      childrenHints: [],
    });
  }

  return sections;
}

function mapLooseSection(
  raw: Record<string, unknown>,
  index: number,
): PageIrSection | null {
  const idRaw =
    asString(raw.id) ||
    asString(raw.name) ||
    asString(raw.slug) ||
    asString(raw.key) ||
    asString(raw.component) ||
    `section-${index + 1}`;
  const id = normalizeSectionId(idRaw);
  if (!id) return null;

  const label =
    asString(raw.label) ||
    asString(raw.title) ||
    asString(raw.name) ||
    pascalFromId(id).replace(/([a-z])([A-Z])/g, "$1 $2") ||
    id;

  const interactionModel = normalizeInteractionModel(
    raw.interactionModel ?? raw.interaction ?? raw.model,
  );

  const section: PageIrSection = {
    id,
    label,
    interactionModel,
  };

  const selector = asString(raw.selector) || asString(raw.cssSelector);
  if (selector) section.selector = selector;

  const textSample =
    asString(raw.textSample) ||
    asString(raw.text) ||
    asString(raw.sample) ||
    asString(raw.description);
  if (textSample) section.textSample = textSample;

  if (isPlainObject(raw.boundingBox) || isPlainObject(raw.box)) {
    const box = (isPlainObject(raw.boundingBox)
      ? raw.boundingBox
      : raw.box) as Record<string, unknown>;
    const x = asNumber(box.x) ?? 0;
    const y = asNumber(box.y) ?? 0;
    const width = asNumber(box.width) ?? asNumber(box.w) ?? 0;
    const height = asNumber(box.height) ?? asNumber(box.h) ?? 0;
    section.boundingBox = { x, y, width, height };
  }

  if (isPlainObject(raw.styles)) {
    const styles: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw.styles)) {
      if (v == null) continue;
      styles[k] = String(v);
    }
    if (Object.keys(styles).length) section.styles = styles;
  }

  if (Array.isArray(raw.childrenHints)) {
    section.childrenHints = raw.childrenHints
      .map((h) => asString(h))
      .filter((h): h is string => !!h);
  }

  if (typeof raw.order === "number" && Number.isFinite(raw.order)) {
    section.order = raw.order;
  } else {
    section.order = index;
  }

  return section;
}

function collectLooseSections(input: ExternalCapture): PageIrSection[] {
  const out: PageIrSection[] = [];
  const seen = new Set<string>();

  const pushList = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (!isPlainObject(item)) continue;
      const mapped = mapLooseSection(item, out.length);
      if (!mapped || seen.has(mapped.id)) continue;
      seen.add(mapped.id);
      out.push(mapped);
    }
  };

  pushList(input.sections);

  if (out.length === 0 && Array.isArray(input.pages)) {
    for (const page of input.pages) {
      if (!page || typeof page !== "object") continue;
      const p = page as { sections?: unknown[] };
      pushList(p.sections);
      if (out.length > 0) break; // pages[0] (and first non-empty)
    }
  }

  if (out.length === 0) {
    const fileMap = resolveFileMap(input);
    for (const s of inventSectionsFromFileMap(fileMap)) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      out.push(s);
    }
  }

  return out;
}

function kindFromPathOrUrl(s: string): "image" | "video" | "font" | "other" {
  if (IMAGE_EXT_RE.test(s)) return "image";
  if (VIDEO_EXT_RE.test(s)) return "video";
  if (FONT_EXT_RE.test(s)) return "font";
  return "other";
}

function collectAssets(input: ExternalCapture): PageIrAsset[] {
  const out: PageIrAsset[] = [];
  const seen = new Set<string>();

  const push = (asset: PageIrAsset) => {
    const key = asset.localPath || asset.url || asset.path || "";
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(asset);
  };

  if (Array.isArray(input.assets)) {
    for (const a of input.assets) {
      if (!a || typeof a !== "object") continue;
      const url = asString(a.url) || asString(a.path) || asString(a.localPath) || "";
      if (!url) continue;
      const kindRaw = asString(a.kind)?.toLowerCase();
      const kind =
        kindRaw === "image" ||
        kindRaw === "video" ||
        kindRaw === "font" ||
        kindRaw === "other"
          ? kindRaw
          : kindFromPathOrUrl(url);
      push({
        url: asString(a.url) || url,
        kind,
        path: asString(a.path),
        localPath: asString(a.localPath),
      });
    }
  }

  // Image (and media) paths in file map
  const fileMap = resolveFileMap(input);
  for (const key of Object.keys(fileMap).sort()) {
    const norm = key.replace(/\\/g, "/");
    const kind = kindFromPathOrUrl(norm);
    if (kind === "other") continue;
    // Prefer public/assets/images style paths; still accept any media extension
    push({
      url: norm.startsWith("http") ? norm : `file://${norm}`,
      kind,
      localPath: norm.startsWith("http") ? undefined : norm,
      path: norm,
    });
  }

  return out;
}

function collectTokens(input: ExternalCapture): NonNullable<PageIR["tokens"]> {
  const t = input.tokens;
  const colors: string[] = [];
  const fonts: string[] = [];
  const cssVariables: Record<string, string> = {};

  if (t && typeof t === "object") {
    if (Array.isArray(t.colors)) {
      for (const c of t.colors) {
        const s = asString(c);
        if (s) colors.push(s);
      }
    }
    if (Array.isArray(t.fonts)) {
      for (const f of t.fonts) {
        const s = asString(f);
        if (s) fonts.push(s);
      }
    }
    if (t.cssVariables && typeof t.cssVariables === "object") {
      for (const [k, v] of Object.entries(t.cssVariables)) {
        if (v == null) continue;
        const name = k.startsWith("--") ? k : `--${k}`;
        cssVariables[name] = String(v);
      }
    }
  }

  return {
    colors,
    fonts,
    ...(Object.keys(cssVariables).length ? { cssVariables } : {}),
  };
}

/**
 * Convert a loose external capture / file-map document into CtrlC Page IR.
 * Does not call any network APIs.
 */
export function adaptExternalCaptureToPageIR(
  input: unknown,
  options?: AdaptExternalCaptureOptions,
): PageIR {
  if (!isPlainObject(input)) {
    throw new Error("External capture must be a JSON object");
  }

  const doc = input as ExternalCapture;
  const sections = collectLooseSections(doc);
  const assets = collectAssets(doc);
  const tokens = collectTokens(doc);

  const sourceUrl =
    options?.sourceUrl ||
    asString(doc.sourceUrl) ||
    (Array.isArray(doc.pages) &&
      doc.pages[0] &&
      typeof doc.pages[0] === "object" &&
      asString((doc.pages[0] as { url?: string }).url)) ||
    "about:blank";

  const title =
    asString(doc.title) ||
    (Array.isArray(doc.pages) &&
      doc.pages[0] &&
      typeof doc.pages[0] === "object" &&
      asString((doc.pages[0] as { title?: string }).title)) ||
    undefined;

  const vw = asNumber(doc.viewport?.width) ?? 1440;
  const vh = asNumber(doc.viewport?.height) ?? 900;

  const notes: string[] = [ADAPTED_NOTE];
  if (Array.isArray(doc.notes)) {
    for (const n of doc.notes) {
      const s = asString(n);
      if (s && s !== ADAPTED_NOTE) notes.push(s);
    }
  }
  if (sections.length === 0) {
    notes.push(
      "No sections found in external capture; invented none from fileMap. Add sections[] or components/* paths.",
    );
  }

  const fileMap = resolveFileMap(doc);
  const fileMapKeys = Object.keys(fileMap).length;
  if (fileMapKeys > 0) {
    notes.push(`external fileMap keys: ${fileMapKeys}`);
  }

  const ir: PageIR = {
    schemaVersion: 1,
    sourceUrl,
    capturedAt: options?.capturedAt || new Date().toISOString(),
    viewport: { width: vw, height: vh },
    title,
    sections,
    tokens,
    assets,
    notes,
  };

  return ir;
}

/**
 * Read external capture JSON from disk (no network).
 */
export function loadExternalCapture(filePath: string): unknown {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`External capture not found: ${abs}`);
  }
  const raw = fs.readFileSync(abs, "utf8");
  try {
    return JSON.parse(raw) as unknown;
  } catch (e) {
    throw new Error(
      `Invalid JSON in external capture ${abs}: ${String((e as Error)?.message ?? e)}`,
    );
  }
}

/**
 * Adapt input (object or path string) and write Page IR JSON to outPath.
 */
export function writeAdaptedIr(
  input: unknown,
  outPath: string,
  options?: AdaptExternalCaptureOptions,
): WriteAdaptedIrResult {
  let raw = input;
  if (typeof input === "string") {
    raw = loadExternalCapture(input);
  }
  const ir = adaptExternalCaptureToPageIR(raw, options);
  const abs = path.resolve(outPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(ir, null, 2) + "\n", "utf8");
  return { ir, path: abs };
}
