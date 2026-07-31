/**
 * Structured section text model for Page IR.
 * Prefer headings / CTAs / list items over one giant textSample blob.
 */

import type { PageIRSection } from "./ir";

/** Clickable / actionable label extracted from a section. */
export type PageIRCta = {
  label: string;
  href?: string;
  /** Heuristic: primary | secondary | button | link */
  role?: string;
};

/**
 * Structured copy for one section (IR `text` field).
 * All arrays are ordered document-order within the section root.
 */
export type PageIRSectionText = {
  /** Small label above main heading when detected */
  eyebrow?: string;
  /** h1–h6 texts */
  headings: string[];
  /** Visible paragraph texts */
  paragraphs: string[];
  /** li texts (including nested lists flattened) */
  listItems: string[];
  /** Buttons and links with visible labels */
  ctas: PageIRCta[];
  /** Short labels (figcaption, dt, strong labels, aria-label) */
  labels?: string[];
};

export function emptySectionText(): PageIRSectionText {
  return {
    headings: [],
    paragraphs: [],
    listItems: [],
    ctas: [],
    labels: [],
  };
}

export function isEmptySectionText(t?: PageIRSectionText | null): boolean {
  if (!t) return true;
  return (
    !t.eyebrow &&
    !(t.headings?.length) &&
    !(t.paragraphs?.length) &&
    !(t.listItems?.length) &&
    !(t.ctas?.length) &&
    !(t.labels?.length)
  );
}

function cleanLine(raw: string, max = 240): string {
  return String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function dedupePreserveOrder(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const t = cleanLine(raw);
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/**
 * Normalize / clamp a partial text model from capture or adapters.
 */
export function normalizeSectionText(
  raw?: Partial<PageIRSectionText> | null,
): PageIRSectionText | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const headings = dedupePreserveOrder(
    Array.isArray(raw.headings) ? raw.headings.map(String) : [],
  ).slice(0, 12);
  const paragraphs = dedupePreserveOrder(
    Array.isArray(raw.paragraphs) ? raw.paragraphs.map(String) : [],
  ).slice(0, 16);
  const listItems = dedupePreserveOrder(
    Array.isArray(raw.listItems) ? raw.listItems.map(String) : [],
  ).slice(0, 40);
  const labels = dedupePreserveOrder(
    Array.isArray(raw.labels) ? raw.labels.map(String) : [],
  ).slice(0, 20);

  const ctas: PageIRCta[] = [];
  const ctaSeen = new Set<string>();
  if (Array.isArray(raw.ctas)) {
    for (const c of raw.ctas) {
      if (!c || typeof c !== "object") continue;
      const label = cleanLine(String((c as PageIRCta).label || ""), 120);
      if (!label) continue;
      const href = (c as PageIRCta).href
        ? cleanLine(String((c as PageIRCta).href), 500)
        : undefined;
      const role = (c as PageIRCta).role
        ? cleanLine(String((c as PageIRCta).role), 40)
        : undefined;
      const key = `${label.toLowerCase()}|${href || ""}`;
      if (ctaSeen.has(key)) continue;
      ctaSeen.add(key);
      ctas.push({
        label,
        ...(href ? { href } : {}),
        ...(role ? { role } : {}),
      });
      if (ctas.length >= 16) break;
    }
  }

  const eyebrow = raw.eyebrow ? cleanLine(String(raw.eyebrow), 120) : undefined;
  const model: PageIRSectionText = {
    headings,
    paragraphs,
    listItems,
    ctas,
    ...(labels.length ? { labels } : {}),
    ...(eyebrow ? { eyebrow } : {}),
  };
  if (isEmptySectionText(model)) return undefined;
  return model;
}

/**
 * Build a compact textSample from structured fields (backward compatible).
 */
export function synthesizeTextSample(
  text?: PageIRSectionText | null,
  max = 200,
): string {
  if (!text || isEmptySectionText(text)) return "";
  const parts: string[] = [];
  if (text.eyebrow) parts.push(text.eyebrow);
  for (const h of text.headings || []) parts.push(h);
  for (const p of text.paragraphs || []) parts.push(p);
  for (const li of (text.listItems || []).slice(0, 6)) parts.push(li);
  for (const c of (text.ctas || []).slice(0, 4)) parts.push(c.label);
  for (const l of (text.labels || []).slice(0, 4)) parts.push(l);
  return cleanLine(parts.join(" "), max);
}

/**
 * Map structured text → content slots used by specs / scaffold.
 */
export function contentSlotsFromSectionText(
  text?: PageIRSectionText | null,
): Record<string, string> {
  const t = normalizeSectionText(text);
  if (!t) return {};
  const slots: Record<string, string> = {};
  if (t.eyebrow) slots.eyebrow = t.eyebrow;
  if (t.headings[0]) slots.title = t.headings[0];
  if (t.headings.length > 1) {
    slots.subtitle = t.headings.slice(1, 3).join(" · ");
  }
  if (t.paragraphs.length) {
    slots.body = t.paragraphs.slice(0, 3).join("\n\n");
  }
  if (t.listItems.length) {
    slots.listItems = t.listItems
      .slice(0, 12)
      .map((x) => `- ${x}`)
      .join("\n");
  }
  const primary = t.ctas.find((c) => c.role === "primary") || t.ctas[0];
  const secondary =
    t.ctas.find((c) => c.role === "secondary") ||
    (t.ctas.length > 1 ? t.ctas[1] : undefined);
  if (primary) {
    slots.primaryCta = primary.label;
    if (primary.href) slots.primaryCtaHref = primary.href;
  }
  if (secondary) {
    slots.secondaryCta = secondary.label;
    if (secondary.href) slots.secondaryCtaHref = secondary.href;
  }
  if (t.ctas.length > 2) {
    slots.otherCtas = t.ctas
      .slice(2, 8)
      .map((c) => (c.href ? `${c.label} (${c.href})` : c.label))
      .join("; ");
  }
  return slots;
}

/**
 * Ensure section has normalized `text` and a derived `textSample` when missing.
 */
export function ensureSectionTextFields(section: PageIRSection): PageIRSection {
  const text = normalizeSectionText(section.text);
  const textSample =
    (section.textSample && cleanLine(section.textSample, 200)) ||
    synthesizeTextSample(text, 200) ||
    undefined;
  return {
    ...section,
    ...(text ? { text } : {}),
    ...(textSample ? { textSample } : {}),
  };
}

/**
 * Apply ensureSectionTextFields across IR sections (immutable).
 */
export function ensureIrTextFields<T extends { sections?: PageIRSection[] }>(
  ir: T,
): T {
  if (!ir?.sections?.length) return ir;
  return {
    ...ir,
    sections: ir.sections.map(ensureSectionTextFields),
  };
}
