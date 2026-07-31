/**
 * B5 / B5b - Curate design tokens from Page IR into semantic CSS + DESIGN_TOKENS.md.
 *
 * Roles over bag-of-swatches (Impeccable-inspired):
 *   canvas, elevated, ink, muted, accent, accent-soft, line + fonts.
 * Prefix default: --ts-* (e.g. --ts-bg, --ts-accent).
 *
 * Inspiration: https://github.com/pbakaus/impeccable (Apache-2.0 ideas; not vendored).
 */

import fs from "node:fs";
import path from "node:path";
import {
  listIrSections,
  parsePageIR,
  type PageIR,
  type PageIrSection,
  type PageIrStyles,
} from "./ir-to-specs";

/** Semantic role keys used in curated output. */
export type TokenSemanticRole =
  | "bg"
  | "bgElevated"
  | "ink"
  | "muted"
  | "accent"
  | "accentSoft"
  | "line";

export type TokensFromIROptions = {
  /** Max distinct colors kept in the curated palette list (default 12). */
  maxColors?: number;
  /** Max distinct font families (default 4). */
  maxFonts?: number;
  /** Extra --{prefix}-palette-N vars after semantic roles (default 8). */
  maxPaletteVars?: number;
  /**
   * CSS custom property prefix without dashes (default "ts").
   * Yields --ts-bg, --ts-accent, etc.
   */
  prefix?: string;
  /** Keep cssVariables already present on the IR (default true). */
  preserveIrVars?: boolean;
  /**
   * Also emit legacy --pc-color-N / --pc-font-* dumps (default false).
   * Prefer semantic roles; legacy is for backwards tooling only.
   */
  includeLegacyPc?: boolean;
};

export type TokensFromIRResult = {
  /** Curated top-N colors (deduped, ordered: semantic seeds then rest). */
  colors: string[];
  /** Curated top-N fonts. */
  fonts: string[];
  /** Full CSS variable map (IR preserved + semantic + optional palette/legacy). */
  cssVariables: Record<string, string>;
  /** Role → color value (canvas/text/action/line). */
  semantic: Record<TokenSemanticRole, string>;
  /** Detected theme from palette luminance. */
  theme: "dark" | "light" | "unknown";
  /** :root { ... } block */
  css: string;
  /** DESIGN_TOKENS.md body */
  designTokensMarkdown: string;
};

export type WriteTokensFromIROptions = TokensFromIROptions & {
  /** Project root or docs/research (etc.) */
  outDir: string;
  /**
   * CSS output path relative to outDir, or absolute.
   * Default: src/styles/tokens.css when outDir looks like a project root,
   * else tokens.css under outDir.
   */
  cssFileName?: string;
  /** Markdown filename (default DESIGN_TOKENS.md under outDir) */
  mdFileName?: string;
};

export type WriteTokensFromIRResult = {
  cssPath: string;
  mdPath: string;
  tokens: TokensFromIRResult;
};

const DEFAULT_MAX_COLORS = 12;
const DEFAULT_MAX_FONTS = 4;
const DEFAULT_MAX_PALETTE = 8;
const DEFAULT_PREFIX = "ts";

const COLOR_PROP_RE =
  /^(color|background|background-color|border-color|outline-color|fill|stroke|caret-color|text-decoration-color|column-rule-color|accent-color)$/i;
const FONT_PROP_RE = /^(font-family|font)$/i;

/** Loose color value detector for mined style values. */
const COLOR_VALUE_RE =
  /^(#([0-9a-f]{3,8})\b|rgba?\([^)]+\)|hsla?\([^)]+\)|hwb\([^)]+\)|lab\([^)]+\)|lch\([^)]+\)|oklab\([^)]+\)|oklch\([^)]+\)|color\([^)]+\)|transparent|currentcolor)$/i;

/** Fallback neutrals when IR has almost no colors. */
const FALLBACKS = {
  dark: {
    bg: "#0a0a0a",
    bgElevated: "#141414",
    ink: "#f5f5f5",
    muted: "#a3a3a3",
    accent: "#3b82f6",
    accentSoft: "rgba(59, 130, 246, 0.16)",
    line: "rgba(255, 255, 255, 0.12)",
  },
  light: {
    bg: "#ffffff",
    bgElevated: "#f8fafc",
    ink: "#0f172a",
    muted: "#64748b",
    accent: "#2563eb",
    accentSoft: "rgba(37, 99, 235, 0.12)",
    line: "rgba(15, 23, 42, 0.12)",
  },
} as const;

type Rgb = { r: number; g: number; b: number; a: number };

/**
 * Extract and curate design tokens from a Page IR document.
 */
export function extractTokensFromIR(
  ir: PageIR | unknown,
  options: TokensFromIROptions = {},
): TokensFromIRResult {
  const maxColors = clampInt(options.maxColors, 1, 64, DEFAULT_MAX_COLORS);
  const maxFonts = clampInt(options.maxFonts, 1, 16, DEFAULT_MAX_FONTS);
  const maxPaletteVars = clampInt(
    options.maxPaletteVars,
    0,
    32,
    DEFAULT_MAX_PALETTE,
  );
  const prefix = sanitizePrefix(options.prefix ?? DEFAULT_PREFIX);
  const preserveIrVars = options.preserveIrVars !== false;
  const includeLegacyPc = options.includeLegacyPc === true;

  const doc = normalizeIR(ir);
  const colorSet = new Map<string, string>(); // lower key -> display value
  const fontSet = new Map<string, string>();
  const irCssVariables: Record<string, string> = {};

  const tokens = doc.tokens;
  if (tokens) {
    for (const c of tokens.colors ?? []) {
      addUnique(colorSet, String(c));
    }
    for (const f of tokens.fonts ?? []) {
      addUnique(fontSet, normalizeFontFamily(String(f)));
    }
    if (tokens.cssVariables && typeof tokens.cssVariables === "object") {
      for (const [k, v] of Object.entries(tokens.cssVariables)) {
        if (v == null || String(v).trim() === "") continue;
        const name = k.startsWith("--") ? k : `--${k}`;
        const val = String(v).trim();
        irCssVariables[name] = val;
        if (looksLikeColor(val)) addUnique(colorSet, val);
        if (looksLikeFont(name, val)) addUnique(fontSet, normalizeFontFamily(val));
      }
    }
  }

  for (const section of listIrSections(doc)) {
    mineSectionStyles(section, colorSet, fontSet);
  }

  const allColors = [...colorSet.values()];
  const allFonts = [...fontSet.values()];

  const theme = detectTheme(allColors, irCssVariables);
  const semantic = curateSemanticRoles(allColors, irCssVariables, theme);
  const colors = orderAndCapColors(allColors, semantic, maxColors);
  const fonts = orderAndCapFonts(allFonts, maxFonts);

  const cssVariables: Record<string, string> = {};

  if (preserveIrVars) {
    for (const [k, v] of Object.entries(irCssVariables)) {
      cssVariables[k] = v;
    }
  }

  // Semantic roles first (do not overwrite IR keys; semantic uses --ts-*)
  const roleVars = semanticRoleVars(semantic, prefix);
  for (const [k, v] of Object.entries(roleVars)) {
    if (cssVariables[k] == null) cssVariables[k] = v;
  }

  // Font roles
  const fontVars = curateFontVars(fonts, prefix);
  for (const [k, v] of Object.entries(fontVars)) {
    if (cssVariables[k] == null) cssVariables[k] = v;
  }

  // Limited palette dump (skip values already used as semantic roles)
  const usedSemantic = new Set(
    Object.values(semantic).map((v) => v.trim().toLowerCase()),
  );
  let paletteIdx = 0;
  for (const value of colors) {
    if (paletteIdx >= maxPaletteVars) break;
    if (usedSemantic.has(value.toLowerCase())) continue;
    paletteIdx += 1;
    const key = `--${prefix}-palette-${paletteIdx}`;
    if (cssVariables[key] == null) cssVariables[key] = value;
  }

  if (includeLegacyPc) {
    let colorIdx = 0;
    for (const value of colors) {
      colorIdx += 1;
      const key = `--pc-color-${colorIdx}`;
      if (cssVariables[key] == null) cssVariables[key] = value;
    }
    let fontIdx = 0;
    for (const value of fonts) {
      fontIdx += 1;
      const role = fontRoleSlug(value, fontIdx);
      const key = `--pc-font-${role}`;
      if (cssVariables[key] == null) {
        cssVariables[key] = value;
      } else {
        cssVariables[`--pc-font-${fontIdx}`] = value;
      }
    }
  }

  const css = formatRootCss(cssVariables, prefix, theme);
  const designTokensMarkdown = formatDesignTokensMarkdown({
    colors,
    fonts,
    cssVariables,
    semantic,
    theme,
    prefix,
    sourceUrl: doc.sourceUrl,
  });

  return {
    colors,
    fonts,
    cssVariables,
    semantic,
    theme,
    css,
    designTokensMarkdown,
  };
}

/**
 * Write tokens.css + DESIGN_TOKENS.md under outDir.
 */
export function writeTokensFromIR(
  ir: PageIR | unknown,
  options: WriteTokensFromIROptions,
): WriteTokensFromIRResult {
  const {
    outDir: outDirOpt,
    cssFileName,
    mdFileName,
    ...extractOpts
  } = options;
  const tokens = extractTokensFromIR(ir, extractOpts);
  const outDir = path.resolve(outDirOpt);
  fs.mkdirSync(outDir, { recursive: true });

  const cssRel =
    cssFileName ||
    (looksLikeProjectRoot(outDir) ? "src/styles/tokens.css" : "tokens.css");
  const mdRel = mdFileName || "DESIGN_TOKENS.md";

  const cssPath = path.isAbsolute(cssRel)
    ? cssRel
    : path.resolve(outDir, cssRel);
  const mdPath = path.isAbsolute(mdRel) ? mdRel : path.resolve(outDir, mdRel);

  fs.mkdirSync(path.dirname(cssPath), { recursive: true });
  fs.mkdirSync(path.dirname(mdPath), { recursive: true });

  const cssBody = tokens.css.endsWith("\n") ? tokens.css : tokens.css + "\n";
  const mdBody = tokens.designTokensMarkdown.endsWith("\n")
    ? tokens.designTokensMarkdown
    : tokens.designTokensMarkdown + "\n";

  fs.writeFileSync(cssPath, cssBody, "utf8");
  fs.writeFileSync(mdPath, mdBody, "utf8");

  return { cssPath, mdPath, tokens };
}

// --- curation ---

function semanticRoleVars(
  semantic: Record<TokenSemanticRole, string>,
  prefix: string,
): Record<string, string> {
  return {
    [`--${prefix}-bg`]: semantic.bg,
    [`--${prefix}-bg-elevated`]: semantic.bgElevated,
    [`--${prefix}-ink`]: semantic.ink,
    [`--${prefix}-muted`]: semantic.muted,
    [`--${prefix}-accent`]: semantic.accent,
    [`--${prefix}-accent-soft`]: semantic.accentSoft,
    [`--${prefix}-line`]: semantic.line,
  };
}

function curateSemanticRoles(
  colors: string[],
  irVars: Record<string, string>,
  theme: "dark" | "light" | "unknown",
): Record<TokenSemanticRole, string> {
  const fb = theme === "light" ? FALLBACKS.light : FALLBACKS.dark;
  const analyzed = colors
    .map((c) => {
      const rgb = parseColorToRgb(c);
      if (!rgb) return null;
      return {
        value: c,
        rgb,
        lum: relativeLuminance(rgb),
        sat: saturation(rgb),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  const byLumAsc = [...analyzed].sort((a, b) => a.lum - b.lum);
  const bySatDesc = [...analyzed].sort((b, a) => a.sat - b.sat);

  const hint = (re: RegExp): string | undefined => {
    for (const [k, v] of Object.entries(irVars)) {
      if (re.test(k) && looksLikeColor(v) && !/transparent|currentcolor/i.test(v)) {
        return v;
      }
    }
    return undefined;
  };

  const bgHint = hint(/--.*(bg|background|canvas|surface|ground)/i);
  const inkHint = hint(/--.*(ink|fg|foreground|text(?!-muted)|on-?bg)/i);
  const mutedHint = hint(/--.*(muted|subtle|secondary-?text|caption)/i);
  const accentHint = hint(
    /--.*(accent|brand|primary(?!.*text)|action|link|cta)/i,
  );
  const lineHint = hint(/--.*(border|line|rule|divider|separator|hairline)/i);
  const elevatedHint = hint(
    /--.*(elevated|raised|panel|card|surface-?2|bg-?elev)/i,
  );

  let bg = bgHint ?? pickBg(byLumAsc, theme) ?? fb.bg;
  let ink = inkHint ?? pickInk(byLumAsc, bg, theme) ?? fb.ink;
  let accent =
    accentHint ??
    pickAccent(bySatDesc, bg, ink) ??
    (bySatDesc[0]?.value && bySatDesc[0].sat > 0.12
      ? bySatDesc[0].value
      : fb.accent);

  // Avoid accent === bg when possible
  if (
    accent.trim().toLowerCase() === bg.trim().toLowerCase() &&
    bySatDesc.length > 1
  ) {
    accent = bySatDesc.find((c) => c.value !== bg)?.value ?? fb.accent;
  }

  let muted =
    mutedHint ??
    pickMuted(analyzed, bg, ink, theme) ??
    fb.muted;

  let bgElevated =
    elevatedHint ??
    pickElevated(byLumAsc, bg, theme) ??
    fb.bgElevated;

  let line = lineHint ?? softLineFrom(bg, theme) ?? fb.line;

  // Soft accent: translucent brand for chips/hover fills
  let accentSoft = softAccent(accent) ?? fb.accentSoft;

  // Guard identical bg/ink
  if (bg.trim().toLowerCase() === ink.trim().toLowerCase()) {
    ink = theme === "light" ? FALLBACKS.light.ink : FALLBACKS.dark.ink;
  }

  return {
    bg,
    bgElevated,
    ink,
    muted,
    accent,
    accentSoft,
    line,
  };
}

function pickBg(
  byLumAsc: Array<{ value: string; lum: number }>,
  theme: "dark" | "light" | "unknown",
): string | undefined {
  if (!byLumAsc.length) return undefined;
  if (theme === "light") {
    // lightest as canvas
    return byLumAsc[byLumAsc.length - 1]?.value;
  }
  // dark / unknown: darkest canvas
  return byLumAsc[0]?.value;
}

function pickInk(
  byLumAsc: Array<{ value: string; lum: number; sat: number }>,
  bg: string,
  theme: "dark" | "light" | "unknown",
): string | undefined {
  if (!byLumAsc.length) return undefined;
  const bgRgb = parseColorToRgb(bg);
  const bgLum = bgRgb ? relativeLuminance(bgRgb) : theme === "light" ? 0.95 : 0.05;

  // Prefer near-white on dark, near-black on light; among candidates pick max contrast
  let best: { value: string; score: number } | null = null;
  for (const c of byLumAsc) {
    // Prefer low saturation for body text
    const contrast = Math.abs(c.lum - bgLum);
    const score = contrast * 2 - c.sat * 0.3;
    if (!best || score > best.score) best = { value: c.value, score };
  }
  return best?.value;
}

function pickAccent(
  bySatDesc: Array<{ value: string; lum: number; sat: number }>,
  bg: string,
  ink: string,
): string | undefined {
  const skip = new Set([bg.toLowerCase(), ink.toLowerCase()]);
  for (const c of bySatDesc) {
    if (c.sat < 0.08) continue;
    if (skip.has(c.value.toLowerCase())) continue;
    // skip pure gray
    if (c.sat < 0.1 && c.lum > 0.05 && c.lum < 0.95) continue;
    return c.value;
  }
  return bySatDesc.find((c) => !skip.has(c.value.toLowerCase()))?.value;
}

function pickMuted(
  analyzed: Array<{ value: string; lum: number; sat: number }>,
  bg: string,
  ink: string,
  theme: "dark" | "light" | "unknown",
): string | undefined {
  const skip = new Set([bg.toLowerCase(), ink.toLowerCase()]);
  const target = theme === "light" ? 0.4 : 0.55;
  let best: { value: string; dist: number } | null = null;
  for (const c of analyzed) {
    if (skip.has(c.value.toLowerCase())) continue;
    // prefer desaturated midtones
    const dist = Math.abs(c.lum - target) + c.sat * 0.5;
    if (!best || dist < best.dist) best = { value: c.value, dist };
  }
  return best?.value;
}

function pickElevated(
  byLumAsc: Array<{ value: string; lum: number; sat?: number }>,
  bg: string,
  theme: "dark" | "light" | "unknown",
): string | undefined {
  const bgRgb = parseColorToRgb(bg);
  if (!bgRgb) return undefined;
  const bgLum = relativeLuminance(bgRgb);
  // Prefer a nearby surface step (not mid-gray body muted, not accent).
  // Dark: next lighter near canvas; light: next darker near paper.
  let best: { value: string; score: number } | null = null;
  for (const c of byLumAsc) {
    if (c.value.toLowerCase() === bg.toLowerCase()) continue;
    const sat = c.sat ?? 0;
    // Skip colorful accents for elevation
    if (sat > 0.25) continue;
    let dist: number;
    if (theme === "light") {
      if (c.lum >= bgLum) continue;
      dist = bgLum - c.lum;
    } else {
      if (c.lum <= bgLum) continue;
      dist = c.lum - bgLum;
    }
    // Allow tiny steps (near-black #111 on #0a0a0a) up to ~0.35 lum
    if (dist < 0.002 || dist > 0.35) continue;
    // Prefer small step + low saturation (score lower is better)
    const score = dist + sat * 0.4;
    if (!best || score < best.score) best = { value: c.value, score };
  }
  if (best) return best.value;
  // Synthesize via simple shift when no near surface exists
  return shiftLum(bg, theme === "light" ? -0.04 : 0.05) ?? undefined;
}

function softLineFrom(
  bg: string,
  theme: "dark" | "light" | "unknown",
): string | undefined {
  const rgb = parseColorToRgb(bg);
  if (!rgb) return undefined;
  const a = theme === "light" ? 0.12 : 0.14;
  if (theme === "light") {
    return `rgba(15, 23, 42, ${a})`;
  }
  return `rgba(255, 255, 255, ${a})`;
}

function softAccent(accent: string): string | undefined {
  const rgb = parseColorToRgb(accent);
  if (!rgb) return undefined;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.16)`;
}

function shiftLum(color: string, delta: number): string | null {
  const rgb = parseColorToRgb(color);
  if (!rgb) return null;
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  // crude RGB lift/drop
  const f = delta > 0 ? 1 + delta * 3 : 1 + delta * 3;
  return `rgb(${clamp(rgb.r * f)}, ${clamp(rgb.g * f)}, ${clamp(rgb.b * f)})`;
}

function detectTheme(
  colors: string[],
  irVars: Record<string, string>,
): "dark" | "light" | "unknown" {
  // Hint from var names / values
  for (const [k, v] of Object.entries(irVars)) {
    if (/dark/i.test(k)) return "dark";
    if (/light/i.test(k) && /theme|mode|scheme/i.test(k)) return "light";
    const rgb = parseColorToRgb(v);
    if (rgb && /--.*(bg|background|canvas)/i.test(k)) {
      return relativeLuminance(rgb) < 0.35 ? "dark" : "light";
    }
  }

  const lums = colors
    .map((c) => parseColorToRgb(c))
    .filter((r): r is Rgb => r != null)
    .map((r) => relativeLuminance(r));
  if (!lums.length) return "unknown";
  const avg = lums.reduce((a, b) => a + b, 0) / lums.length;
  // dark sites often include both black bg and white text -> avg mid; use min
  const min = Math.min(...lums);
  const max = Math.max(...lums);
  if (min < 0.15 && max > 0.7) {
    // high contrast pair: treat as dark if darkest is very dark
    return min < 0.2 ? "dark" : "light";
  }
  if (avg < 0.4) return "dark";
  if (avg > 0.65) return "light";
  return min < 0.25 ? "dark" : "light";
}

function orderAndCapColors(
  all: string[],
  semantic: Record<TokenSemanticRole, string>,
  max: number,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (v: string) => {
    const key = v.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    // skip non-colors / transparent in top list
    if (/^(transparent|currentcolor)$/i.test(v)) return;
    seen.add(key);
    out.push(v);
  };
  // Semantic seeds first
  for (const role of [
    "bg",
    "bgElevated",
    "ink",
    "muted",
    "accent",
    "line",
  ] as TokenSemanticRole[]) {
    push(semantic[role]);
  }
  for (const c of all) push(c);
  return out.slice(0, max);
}

function orderAndCapFonts(all: string[], max: number): string[] {
  // Prefer: sans, then serif, then mono, then rest
  const rank = (f: string): number => {
    const lower = f.toLowerCase();
    if (/mono|code|consolas|menlo|courier|fira code|jetbrains|source code/i.test(lower))
      return 2;
    if (/serif|georgia|times|garamond|palatino|merriweather/i.test(lower) && !/sans/i.test(lower))
      return 1;
    return 0;
  };
  const sorted = [...all].sort((a, b) => rank(a) - rank(b));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const f of sorted) {
    const key = f.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
    if (out.length >= max) break;
  }
  return out;
}

function curateFontVars(
  fonts: string[],
  prefix: string,
): Record<string, string> {
  const vars: Record<string, string> = {};
  let sans: string | undefined;
  let serif: string | undefined;
  let mono: string | undefined;
  const extras: string[] = [];

  for (const f of fonts) {
    const lower = f.toLowerCase();
    if (
      !mono &&
      /mono|code|consolas|menlo|courier|fira code|jetbrains|source code/i.test(
        lower,
      )
    ) {
      mono = f;
      continue;
    }
    if (
      !serif &&
      /serif|georgia|times|garamond|palatino|merriweather/i.test(lower) &&
      !/sans/i.test(lower)
    ) {
      serif = f;
      continue;
    }
    if (!sans) {
      sans = f;
      continue;
    }
    extras.push(f);
  }

  if (sans) vars[`--${prefix}-font-sans`] = sans;
  if (serif) vars[`--${prefix}-font-serif`] = serif;
  if (mono) vars[`--${prefix}-font-mono`] = mono;
  // First font also as generic body stack alias
  if (sans || fonts[0]) {
    vars[`--${prefix}-font`] = sans ?? fonts[0];
  }
  extras.forEach((f, i) => {
    vars[`--${prefix}-font-extra-${i + 1}`] = f;
  });
  return vars;
}

// --- color math ---

function parseColorToRgb(input: string): Rgb | null {
  const v = input.trim();
  if (!v || /^(transparent|currentcolor)$/i.test(v)) return null;

  // #rgb #rrggbb #rgba #rrggbbaa
  const hex = v.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) {
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    }
    if (h.length === 6 || h.length === 8) {
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
  }

  const rgb = v.match(
    /^rgba?\(\s*([0-9.]+)\s*[, ]\s*([0-9.]+)\s*[, ]\s*([0-9.]+)(?:\s*[,/]\s*([0-9.]+%?))?\s*\)$/i,
  );
  if (rgb) {
    return {
      r: clampByte(+rgb[1]),
      g: clampByte(+rgb[2]),
      b: clampByte(+rgb[3]),
      a: rgb[4] != null ? parseAlpha(rgb[4]) : 1,
    };
  }

  // named colors (subset)
  const named: Record<string, Rgb> = {
    black: { r: 0, g: 0, b: 0, a: 1 },
    white: { r: 255, g: 255, b: 255, a: 1 },
    red: { r: 255, g: 0, b: 0, a: 1 },
    blue: { r: 0, g: 0, b: 255, a: 1 },
    green: { r: 0, g: 128, b: 0, a: 1 },
    gray: { r: 128, g: 128, b: 128, a: 1 },
    grey: { r: 128, g: 128, b: 128, a: 1 },
    navy: { r: 0, g: 0, b: 128, a: 1 },
    teal: { r: 0, g: 128, b: 128, a: 1 },
    orange: { r: 255, g: 165, b: 0, a: 1 },
    purple: { r: 128, g: 0, b: 128, a: 1 },
    silver: { r: 192, g: 192, b: 192, a: 1 },
  };
  if (named[v.toLowerCase()]) return named[v.toLowerCase()];

  // oklch / hsl etc: skip precise parse (keep value in palette, no role math)
  return null;
}

function clampByte(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseAlpha(s: string): number {
  if (s.endsWith("%")) return Math.max(0, Math.min(1, parseFloat(s) / 100));
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
}

/** Relative luminance (sRGB, WCAG). */
function relativeLuminance(rgb: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
}

/** Rough HSV-like saturation 0..1 from RGB. */
function saturation(rgb: Rgb): number {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

// --- helpers ---

function clampInt(
  n: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (n == null || !Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function sanitizePrefix(raw: string): string {
  const p = String(raw || DEFAULT_PREFIX)
    .replace(/^--+/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .toLowerCase();
  return p || DEFAULT_PREFIX;
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

function looksLikeProjectRoot(dir: string): boolean {
  return (
    fs.existsSync(path.join(dir, "package.json")) ||
    fs.existsSync(path.join(dir, "src"))
  );
}

function addUnique(map: Map<string, string>, raw: string): void {
  const v = String(raw ?? "").trim();
  if (!v) return;
  const key = v.toLowerCase();
  if (map.has(key)) return;
  map.set(key, v);
}

function normalizeFontFamily(value: string): string {
  const primary = value.split(",")[0]?.trim() ?? value;
  return primary.replace(/^["']|["']$/g, "").trim() || value.trim();
}

function looksLikeColor(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (COLOR_VALUE_RE.test(v)) return true;
  if (
    /^[a-z]{3,20}$/i.test(v) &&
    !/^(normal|inherit|initial|unset|none|auto)$/i.test(v)
  ) {
    return /^(black|white|red|blue|green|gray|grey|orange|purple|pink|yellow|cyan|magenta|navy|teal|olive|maroon|silver|gold|indigo|violet|brown|beige|coral|crimson|azure|ivory|khaki|lime|salmon|tan|turquoise|aqua|fuchsia|rebeccapurple)$/i.test(
      v,
    );
  }
  return false;
}

function looksLikeFont(varName: string, value: string): boolean {
  if (/font/i.test(varName)) return true;
  if (looksLikeColor(value)) return false;
  return /^[A-Za-z][A-Za-z0-9\s_-]{1,60}$/.test(value.trim());
}

function fontRoleSlug(family: string, index: number): string {
  const lower = family.toLowerCase();
  if (/mono|code|consolas|menlo|courier|fira code|jetbrains/i.test(lower)) {
    return "mono";
  }
  if (
    /serif|georgia|times|garamond|palatino/i.test(lower) &&
    !/sans/i.test(lower)
  ) {
    return "serif";
  }
  if (
    /sans|inter|helvetica|arial|system|roboto|open sans|lato|poppins|montserrat|nunito|work sans|dm sans/i.test(
      lower,
    )
  ) {
    return index === 1 ? "sans" : `sans-${index}`;
  }
  if (index === 1) return "sans";
  return String(index);
}

function mineSectionStyles(
  section: PageIrSection,
  colorSet: Map<string, string>,
  fontSet: Map<string, string>,
): void {
  const styles = section.styles;
  if (!styles) return;

  const pairs = styleEntries(styles);
  for (const { property, value } of pairs) {
    if (!property || !value) continue;
    const prop = property.toLowerCase();
    if (COLOR_PROP_RE.test(prop) || prop.includes("color")) {
      extractColorishValues(value).forEach((c) => addUnique(colorSet, c));
    }
    if (FONT_PROP_RE.test(prop) || prop === "font-family") {
      const fam = prop === "font" ? fontFamilyFromShorthand(value) : value;
      if (fam) addUnique(fontSet, normalizeFontFamily(fam));
    }
  }
}

function styleEntries(
  styles: PageIrStyles,
): Array<{ property: string; value: string }> {
  if (Array.isArray(styles)) {
    return styles
      .filter((s) => s && (s.property || s.value))
      .map((s) => ({
        property: String(s.property || ""),
        value: String(s.value || ""),
      }));
  }
  return Object.entries(styles).map(([property, value]) => ({
    property,
    value: String(value ?? ""),
  }));
}

function extractColorishValues(value: string): string[] {
  const v = value.trim();
  if (!v) return [];
  if (looksLikeColor(v)) return [v];
  const found: string[] = [];
  const re =
    /#(?:[0-9a-f]{3,8})\b|rgba?\([^)]+\)|hsla?\([^)]+\)|hwb\([^)]+\)|oklch\([^)]+\)|oklab\([^)]+\)|lab\([^)]+\)|lch\([^)]+\)|color\([^)]+\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(v)) != null) {
    found.push(m[0]);
  }
  return found;
}

function fontFamilyFromShorthand(font: string): string | null {
  const cleaned = font.trim();
  if (!cleaned) return null;
  const parts = cleaned.split(/\s+/);
  const skip =
    /^(normal|bold|bolder|lighter|italic|oblique|small-caps|[0-9.]+(px|rem|em|%)?|[1-9]00)$/i;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i].replace(/\/.*/, "");
    if (skip.test(p)) continue;
    if (/^[A-Za-z"']/.test(p)) {
      return parts.slice(i).join(" ");
    }
  }
  return cleaned;
}

function formatRootCss(
  vars: Record<string, string>,
  prefix: string,
  theme: string,
): string {
  const keys = Object.keys(vars);
  if (!keys.length) {
    return `/* CtrlC design tokens (empty) */\n:root {\n}\n`;
  }

  // Stable order: semantic roles, fonts, IR/other, palette, legacy pc
  const semanticOrder = [
    "bg",
    "bg-elevated",
    "ink",
    "muted",
    "accent",
    "accent-soft",
    "line",
  ].map((r) => `--${prefix}-${r}`);
  const fontKeys = keys
    .filter((k) => k.startsWith(`--${prefix}-font`))
    .sort();
  const paletteKeys = keys
    .filter((k) => k.startsWith(`--${prefix}-palette-`))
    .sort(
      (a, b) =>
        parseInt(a.replace(/\D/g, ""), 10) - parseInt(b.replace(/\D/g, ""), 10),
    );
  const legacyKeys = keys.filter((k) => k.startsWith("--pc-")).sort();
  const used = new Set([
    ...semanticOrder,
    ...fontKeys,
    ...paletteKeys,
    ...legacyKeys,
  ]);
  const otherKeys = keys.filter((k) => !used.has(k)).sort();

  const ordered = [
    ...semanticOrder.filter((k) => vars[k] != null),
    ...fontKeys.filter((k) => vars[k] != null),
    ...otherKeys,
    ...paletteKeys.filter((k) => vars[k] != null),
    ...legacyKeys.filter((k) => vars[k] != null),
  ];

  const lines = ordered.map((k) => `  ${k}: ${vars[k]};`);
  return [
    `/* CtrlC design tokens - curated from Page IR (theme: ${theme}) */`,
    `/* Semantic roles: --${prefix}-bg | bg-elevated | ink | muted | accent | accent-soft | line */`,
    `/* Prefer roles in components; palette/legacy are reference only. */`,
    `:root {`,
    ...lines,
    `}`,
    ``,
  ].join("\n");
}

function formatDesignTokensMarkdown(opts: {
  colors: string[];
  fonts: string[];
  cssVariables: Record<string, string>;
  semantic: Record<TokenSemanticRole, string>;
  theme: string;
  prefix: string;
  sourceUrl?: string;
}): string {
  const { colors, fonts, cssVariables, semantic, theme, prefix, sourceUrl } =
    opts;

  const roleRows = (
    [
      ["bg", "Canvas / page ground", semantic.bg],
      ["bg-elevated", "Panels, cards, elevated surfaces", semantic.bgElevated],
      ["ink", "Primary text", semantic.ink],
      ["muted", "Secondary text, captions", semantic.muted],
      ["accent", "Action, brand, links", semantic.accent],
      ["accent-soft", "Soft accent fills / chips", semantic.accentSoft],
      ["line", "Borders and separators", semantic.line],
    ] as const
  )
    .map(
      ([role, use, val]) =>
        `| \`--${prefix}-${role}\` | ${use} | \`${escapeMd(val)}\` |`,
    )
    .join("\n");

  const colorRows =
    colors.length > 0
      ? colors
          .map((c, i) => `| ${i + 1} | \`${escapeMd(c)}\` |`)
          .join("\n")
      : "| (none) | |";

  const fontRows =
    fonts.length > 0
      ? fonts.map((f, i) => `| ${i + 1} | \`${escapeMd(f)}\` |`).join("\n")
      : "| (none) | |";

  const varEntries = Object.entries(cssVariables);
  const varRows =
    varEntries.length > 0
      ? varEntries
          .map(([k, v]) => `| \`${escapeMd(k)}\` | \`${escapeMd(v)}\` |`)
          .join("\n")
      : "| (none) | |";

  return [
    `# Design tokens`,
    ``,
    sourceUrl ? `**Source:** ${sourceUrl}` : `**Source:** (Page IR)`,
    ``,
    `**Theme (detected):** ${theme}`,
    ``,
    `Generated by CtrlC token curation from capture IR.`,
    `Build **roles**, not a bag of swatches: canvas, text, action, borders.`,
    ``,
    `## Semantic roles`,
    ``,
    `Use these in components (\`var(--${prefix}-accent)\`). Do not invent parallel brand colors.`,
    ``,
    `| Variable | Role | Value |`,
    `|----------|------|-------|`,
    roleRows,
    ``,
    `## Curated colors (top ${colors.length})`,
    ``,
    `| # | Value |`,
    `|---|-------|`,
    colorRows,
    ``,
    `## Fonts (top ${fonts.length})`,
    ``,
    `| # | Family |`,
    `|---|--------|`,
    fontRows,
    ``,
    `## CSS variables`,
    ``,
    `| Variable | Value |`,
    `|----------|-------|`,
    varRows,
    ``,
    `## Usage`,
    ``,
    `- Import \`tokens.css\` in the host app (e.g. \`globals.css\`).`,
    `- Prefer semantic vars: \`background: var(--${prefix}-bg)\`; \`color: var(--${prefix}-ink)\`; CTAs \`var(--${prefix}-accent)\`.`,
    `- \`--${prefix}-palette-N\` is reference only; promote a swatch into a role when it gains meaning.`,
    `- Guidance: \`.claude/skills/ctrlc-design-tokens/SKILL.md\` (Impeccable-inspired role system).`,
    ``,
    `## CSS`,
    ``,
    `See \`tokens.css\` (\`:root\` block) written next to this file or under \`src/styles/\`.`,
    ``,
  ].join("\n");
}

function escapeMd(s: string): string {
  return String(s ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ")
    .trim();
}
