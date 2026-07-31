/**
 * Brand / pack variable substitution for prompt packs.
 * Placeholders use `{{name}}` syntax. Defaults are generic or injected via config.
 */

import type { PackVariables } from "./types";

export type { PackVariables };

/** Well-known brand keys (present in generic defaults). */
export const DEFAULT_PACK_VAR_KEYS = [
  "productName",
  "tagline",
  "demoHref",
  "email",
  "primaryCta",
] as const;

export type DefaultPackVarKey = (typeof DEFAULT_PACK_VAR_KEYS)[number];

/**
 * Neutral defaults when no host config supplies brand tokens.
 * Host apps inject product-specific values via SectionPackConfig.defaultVariables.
 * The Northline demo sets its own defaults in createDemoSectionPackConfig().
 */
export function getDefaultPackVariables(): PackVariables {
  return {
    productName: "Acme",
    tagline: "Ship clearer pages faster",
    demoHref: "/demo",
    email: "hello@example.com",
    primaryCta: "Book a demo",
  };
}

/**
 * Parse query overrides: `var.productName=Acme&var.tagline=Hello`
 * Only keys matching `var.<name>` are collected; empty names are ignored.
 */
export function parseVarQueryParams(
  searchParams: URLSearchParams,
): Partial<PackVariables> {
  const out: Partial<PackVariables> = {};
  for (const [key, value] of searchParams.entries()) {
    if (!key.startsWith("var.")) continue;
    const name = key.slice(4).trim();
    if (!name) continue;
    out[name] = value;
  }
  return out;
}

/** Defaults merged with optional overrides (overrides win). */
export function mergePackVariables(
  overrides?: Partial<PackVariables> | null,
  base?: PackVariables | null,
): PackVariables {
  const root = base ? { ...base } : getDefaultPackVariables();
  if (!overrides) return root;
  const merged: PackVariables = { ...root };
  for (const [k, v] of Object.entries(overrides)) {
    if (v == null) continue;
    merged[k] = String(v);
  }
  return merged;
}

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

/**
 * Replace `{{var}}` placeholders. Unknown keys are left unchanged.
 */
export function applyPackVariables(
  text: string,
  vars: PackVariables,
): string {
  if (!text) return text;
  return text.replace(PLACEHOLDER_RE, (match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return vars[key] ?? match;
    }
    return match;
  });
}

/** Markdown "Brand context" block for multi-section (and optional single) packs. */
export function formatBrandContextMarkdown(vars: PackVariables): string {
  const preferred = [
    "productName",
    "tagline",
    "demoHref",
    "email",
    "primaryCta",
  ];
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const key of preferred) {
    if (!(key in vars)) continue;
    seen.add(key);
    lines.push(`- **${key}:** ${vars[key]}`);
  }
  const skip = new Set(["sectionId", "sectionLabel", ...seen]);
  for (const key of Object.keys(vars).sort()) {
    if (skip.has(key)) continue;
    lines.push(`- **${key}:** ${vars[key]}`);
  }

  return `## Brand context
Use these brand tokens when adapting copy, CTAs, and routes. Placeholders like \`{{productName}}\` in this pack resolve to the values below.

${lines.join("\n")}
`;
}

/**
 * Prepend brand context after the first markdown H1 (or at the top if none).
 * Does not run `{{var}}` replacement (call `applyPackVariables` after).
 * Skips inject if a "## Brand context" heading already exists.
 */
export function injectBrandContext(
  markdown: string,
  vars: PackVariables,
): string {
  if (!markdown) return formatBrandContextMarkdown(vars);
  if (/^##\s+Brand context\b/m.test(markdown)) {
    return markdown;
  }
  const block = formatBrandContextMarkdown(vars).trimEnd();
  const h1 = markdown.match(/^#\s[^\n]*\n/);
  if (h1 && h1.index === 0) {
    const rest = markdown.slice(h1[0].length).replace(/^\n+/, "");
    return `${h1[0]}\n${block}\n\n${rest}`;
  }
  return `${block}\n\n${markdown}`;
}

/**
 * Full pipeline for agent markdown: optional brand inject + `{{var}}` replace.
 * Single packs should pass sectionId/sectionLabel in vars; multi packs use injectBrand.
 */
export function applyPromptVariablePipeline(
  markdown: string,
  vars: PackVariables,
  options?: { injectBrand?: boolean },
): string {
  let out = markdown;
  if (options?.injectBrand) {
    out = injectBrandContext(out, vars);
  }
  return applyPackVariables(out, vars);
}
