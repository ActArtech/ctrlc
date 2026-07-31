/**
 * B5 - Extract design tokens from Page IR into CSS + DESIGN_TOKENS.md.
 *
 * Prefer ir.tokens; also mine section.styles for color / background / font-family.
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

export type TokensFromIRResult = {
  colors: string[];
  fonts: string[];
  cssVariables: Record<string, string>;
  /** :root { ... } block */
  css: string;
  /** DESIGN_TOKENS.md body */
  designTokensMarkdown: string;
};

export type WriteTokensFromIROptions = {
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

const COLOR_PROP_RE =
  /^(color|background|background-color|border-color|outline-color|fill|stroke|caret-color|text-decoration-color|column-rule-color|accent-color)$/i;
const FONT_PROP_RE = /^(font-family|font)$/i;

/** Loose color value detector for mined style values. */
const COLOR_VALUE_RE =
  /^(#([0-9a-f]{3,8})\b|rgba?\([^)]+\)|hsla?\([^)]+\)|hwb\([^)]+\)|lab\([^)]+\)|lch\([^)]+\)|oklab\([^)]+\)|oklch\([^)]+\)|color\([^)]+\)|transparent|currentcolor)$/i;

/**
 * Extract design tokens from a Page IR document (object or unknown JSON shape).
 */
export function extractTokensFromIR(ir: PageIR | unknown): TokensFromIRResult {
  const doc = normalizeIR(ir);
  const colorSet = new Map<string, string>(); // lower key -> display value
  const fontSet = new Map<string, string>();
  const cssVariables: Record<string, string> = {};

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
        cssVariables[name] = String(v).trim();
        // Also surface var values into color/font lists when obvious
        const val = String(v).trim();
        if (looksLikeColor(val)) addUnique(colorSet, val);
        if (looksLikeFont(name, val)) addUnique(fontSet, normalizeFontFamily(val));
      }
    }
  }

  for (const section of listIrSections(doc)) {
    mineSectionStyles(section, colorSet, fontSet);
  }

  // If cssVariables empty, synthesize from collected colors/fonts
  if (Object.keys(cssVariables).length === 0) {
    let colorIdx = 0;
    for (const value of colorSet.values()) {
      colorIdx += 1;
      cssVariables[`--pc-color-${colorIdx}`] = value;
    }
    let fontIdx = 0;
    for (const value of fontSet.values()) {
      fontIdx += 1;
      const role = fontRoleSlug(value, fontIdx);
      cssVariables[`--pc-font-${role}`] = value;
    }
  } else {
    // Ensure every mined color/font has a var if not already present as a value
    const existingValues = new Set(
      Object.values(cssVariables).map((v) => v.trim().toLowerCase()),
    );
    let colorIdx = Object.keys(cssVariables).filter((k) =>
      /color/i.test(k),
    ).length;
    for (const value of colorSet.values()) {
      if (existingValues.has(value.toLowerCase())) continue;
      colorIdx += 1;
      const key = `--pc-color-${colorIdx}`;
      if (cssVariables[key]) continue;
      cssVariables[key] = value;
      existingValues.add(value.toLowerCase());
    }
    let fontIdx = Object.keys(cssVariables).filter((k) => /font/i.test(k)).length;
    for (const value of fontSet.values()) {
      if (existingValues.has(value.toLowerCase())) continue;
      fontIdx += 1;
      const role = fontRoleSlug(value, fontIdx);
      const key = `--pc-font-${role}`;
      if (cssVariables[key]) {
        cssVariables[`--pc-font-${fontIdx}`] = value;
      } else {
        cssVariables[key] = value;
      }
      existingValues.add(value.toLowerCase());
    }
  }

  const colors = [...colorSet.values()];
  const fonts = [...fontSet.values()];
  const css = formatRootCss(cssVariables);
  const designTokensMarkdown = formatDesignTokensMarkdown({
    colors,
    fonts,
    cssVariables,
    sourceUrl: doc.sourceUrl,
  });

  return {
    colors,
    fonts,
    cssVariables,
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
  const tokens = extractTokensFromIR(ir);
  const outDir = path.resolve(options.outDir);
  fs.mkdirSync(outDir, { recursive: true });

  const cssRel =
    options.cssFileName ||
    (looksLikeProjectRoot(outDir) ? "src/styles/tokens.css" : "tokens.css");
  const mdRel = options.mdFileName || "DESIGN_TOKENS.md";

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

// --- helpers ---

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
  // Heuristic: package.json or src/ present
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
  // Strip CSS stack quotes / fallbacks for primary family when simple
  const primary = value.split(",")[0]?.trim() ?? value;
  return primary.replace(/^["']|["']$/g, "").trim() || value.trim();
}

function looksLikeColor(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (COLOR_VALUE_RE.test(v)) return true;
  // named CSS colors are common in IR; accept short alpha tokens carefully
  if (/^[a-z]{3,20}$/i.test(v) && !/^(normal|inherit|initial|unset|none|auto)$/i.test(v)) {
    // only treat as color if it looks like a known-ish color word
    return /^(black|white|red|blue|green|gray|grey|orange|purple|pink|yellow|cyan|magenta|navy|teal|olive|maroon|silver|gold|indigo|violet|brown|beige|coral|crimson|azure|ivory|khaki|lime|salmon|tan|turquoise|aqua|fuchsia|rebeccapurple)$/i.test(
      v,
    );
  }
  return false;
}

function looksLikeFont(varName: string, value: string): boolean {
  if (/font/i.test(varName)) return true;
  // family-like: letters, spaces, optional hyphens; not a color
  if (looksLikeColor(value)) return false;
  return /^[A-Za-z][A-Za-z0-9\s_-]{1,60}$/.test(value.trim());
}

function fontRoleSlug(family: string, index: number): string {
  const lower = family.toLowerCase();
  if (/mono|code|consolas|menlo|courier|fira code|jetbrains/i.test(lower)) {
    return "mono";
  }
  if (/serif|georgia|times|garamond|palatino/i.test(lower) && !/sans/i.test(lower)) {
    return "serif";
  }
  if (/sans|inter|helvetica|arial|system|roboto|open sans|lato|poppins|montserrat|nunito|work sans|dm sans/i.test(lower)) {
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
      // background can be gradients/images - extract color-like pieces
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
  // crude: last non-size token group is often family
  // e.g. "600 16px/1.5 Inter, system-ui"
  const cleaned = font.trim();
  if (!cleaned) return null;
  // if contains comma stack, take from first letter-like token after sizes
  const parts = cleaned.split(/\s+/);
  // find first part that starts with a letter and is not a keyword weight/style
  const skip =
    /^(normal|bold|bolder|lighter|italic|oblique|small-caps|[0-9.]+(px|rem|em|%)?|[1-9]00)$/i;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i].replace(/\/.*/, ""); // drop /line-height on size
    if (skip.test(p)) continue;
    if (/^[A-Za-z"']/.test(p)) {
      return parts.slice(i).join(" ");
    }
  }
  return cleaned;
}

function formatRootCss(vars: Record<string, string>): string {
  const keys = Object.keys(vars);
  if (!keys.length) {
    return `/* CtrlC design tokens (empty) */\n:root {\n}\n`;
  }
  const lines = keys.map((k) => `  ${k}: ${vars[k]};`);
  return [
    `/* CtrlC design tokens - generated from Page IR */`,
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
  sourceUrl?: string;
}): string {
  const { colors, fonts, cssVariables, sourceUrl } = opts;
  const colorRows =
    colors.length > 0
      ? colors.map((c, i) => `| --pc-color / ${i + 1} | \`${escapeMd(c)}\` |`).join("\n")
      : "| (none) | |";

  const fontRows =
    fonts.length > 0
      ? fonts.map((f, i) => `| font-${i + 1} | \`${escapeMd(f)}\` |`).join("\n")
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
    `Generated by CtrlC from capture IR. Prefer CSS variables in components.`,
    ``,
    `## Colors`,
    ``,
    `| Token / index | Value |`,
    `|---------------|-------|`,
    colorRows,
    ``,
    `## Fonts`,
    ``,
    `| Role | Family |`,
    `|------|--------|`,
    fontRows,
    ``,
    `## CSS variables`,
    ``,
    `| Variable | Value |`,
    `|----------|-------|`,
    varRows,
    ``,
    `## CSS`,
    ``,
    `See \`tokens.css\` (\`:root\` block) written next to this file or under \`src/styles/\`.`,
    ``,
  ].join("\n");
}

function escapeMd(s: string): string {
  return String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}
