/**
 * Light complexity budget checks for section.spec.md (and similar) markdown.
 * Soft warnings only - does not hard-fail builds.
 */

export type SpecBudgetOptions = {
  /** Max lines before a warning (default 400). */
  maxLines?: number;
  /** Max characters before a warning (default 40000). */
  maxChars?: number;
};

export type SpecBudgetWarning = {
  code: "max-lines" | "max-chars";
  message: string;
  actual: number;
  limit: number;
};

export type SpecBudgetResult = {
  ok: boolean;
  lines: number;
  chars: number;
  warnings: SpecBudgetWarning[];
};

const DEFAULT_MAX_LINES = 400;
const DEFAULT_MAX_CHARS = 40_000;

/**
 * Check markdown length against soft budget defaults.
 *
 * @param markdown - Full spec (or research) markdown text
 * @param options - Optional limits
 * @returns ok=false when any warning is raised; always includes counts
 */
export function checkSpecBudget(
  markdown: string,
  options?: SpecBudgetOptions,
): SpecBudgetResult {
  const maxLines = options?.maxLines ?? DEFAULT_MAX_LINES;
  const maxChars = options?.maxChars ?? DEFAULT_MAX_CHARS;
  const text = typeof markdown === "string" ? markdown : "";
  const chars = text.length;
  // Count lines like editors: empty string => 0 lines; trailing newline still counts last empty
  const lines = text.length === 0 ? 0 : text.split(/\r\n|\r|\n/).length;

  /** @type {SpecBudgetWarning[]} */
  const warnings: SpecBudgetWarning[] = [];

  if (lines > maxLines) {
    warnings.push({
      code: "max-lines",
      message: `Spec has ${lines} lines (budget ${maxLines}). Split or trim detail for agent focus.`,
      actual: lines,
      limit: maxLines,
    });
  }

  if (chars > maxChars) {
    warnings.push({
      code: "max-chars",
      message: `Spec has ${chars} characters (budget ${maxChars}). Prefer shorter specs + linked research files.`,
      actual: chars,
      limit: maxChars,
    });
  }

  return {
    ok: warnings.length === 0,
    lines,
    chars,
    warnings,
  };
}
