/**
 * Stable kebab-case section ids for Page IR.
 * Pure helpers (no DOM / Playwright) - unit-testable.
 */

/**
 * Normalize a free-form label or text sample into a kebab-case id base.
 * - lowercases
 * - strips diacritics
 * - replaces non-alphanumeric runs with single hyphens
 * - trims hyphens
 * - falls back to "section" when empty
 */
export function normalizeSectionId(raw: string): string {
  const base = String(raw ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  if (!base) return "section";
  // Cap length for stable, readable ids
  return base.length > 48 ? base.slice(0, 48).replace(/-+$/g, "") : base;
}

/**
 * Assign unique kebab ids from labels (or fallbacks).
 * Duplicates get -2, -3, ... suffixes. Final ids never collide.
 */
export function uniqueSectionIds(
  labels: readonly string[],
  opts?: { fallbackPrefix?: string },
): string[] {
  const prefix = opts?.fallbackPrefix ?? "section";
  const used = new Set<string>();
  const out: string[] = [];

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    let base = normalizeSectionId(label);
    if (base === "section" && !String(label ?? "").trim()) {
      base = `${prefix}-${i + 1}`;
    }

    let id = base;
    let n = 2;
    while (used.has(id)) {
      id = `${base}-${n}`;
      n += 1;
    }
    used.add(id);
    out.push(id);
  }

  return out;
}
