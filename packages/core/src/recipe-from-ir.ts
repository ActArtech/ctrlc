/**
 * D11 - Infer PackRecipe presets from Page IR section order / roles.
 */

import {
  listIrSections,
  parsePageIR,
  type PageIR,
  type PageIrSection,
} from "./ir-to-specs";
import type { PackRecipe } from "./types";

/**
 * Infer named recipes from IR section order.
 *
 * Always emits at least `landing-core` with ordered section ids.
 * When there are more than 6 sections, also emits `landing-full`.
 * CTA / footer-like ids are called out in recipe descriptions.
 */
export function inferRecipesFromIR(ir: PageIR | unknown): PackRecipe[] {
  const doc = normalizeIR(ir);
  const sections = listIrSections(doc);
  const ids = sections.map((s) => s.id);

  if (ids.length === 0) {
    return [
      {
        id: "landing-core",
        label: "Landing core",
        description:
          "Core landing composition (no sections in IR yet - empty recipe).",
        sectionIds: [],
      },
    ];
  }

  const roleNotes = describeRoleHints(sections);
  const roleSuffix = roleNotes.length
    ? ` Includes ${roleNotes.join(", ")}.`
    : "";

  const recipes: PackRecipe[] = [
    {
      id: "landing-core",
      label: "Landing core",
      description: `Ordered sections from Page IR (${ids.length}).${roleSuffix}`,
      sectionIds: [...ids],
    },
  ];

  if (ids.length > 6) {
    recipes.push({
      id: "landing-full",
      label: "Landing full",
      description: `Full page composition with all ${ids.length} IR sections.${roleSuffix}`,
      sectionIds: [...ids],
    });
  }

  return recipes;
}

function describeRoleHints(sections: PageIrSection[]): string[] {
  const notes: string[] = [];
  const hasCta = sections.some((s) => isCtaLike(s));
  const hasFooter = sections.some((s) => isFooterLike(s));
  const hasHero = sections.some((s) => isHeroLike(s));
  const hasNav = sections.some((s) => isNavLike(s));

  if (hasHero) notes.push("hero");
  if (hasNav) notes.push("nav/header");
  if (hasCta) notes.push("cta");
  if (hasFooter) notes.push("footer");
  return notes;
}

function isCtaLike(s: PageIrSection): boolean {
  const id = s.id.toLowerCase();
  const label = String(s.label || "").toLowerCase();
  return (
    /\bcta\b/.test(id) ||
    id.includes("call-to-action") ||
    id.includes("get-started") ||
    /\bcta\b/.test(label) ||
    /call to action/i.test(label)
  );
}

function isFooterLike(s: PageIrSection): boolean {
  const id = s.id.toLowerCase();
  const label = String(s.label || "").toLowerCase();
  return id.includes("footer") || label.includes("footer");
}

function isHeroLike(s: PageIrSection): boolean {
  const id = s.id.toLowerCase();
  const label = String(s.label || "").toLowerCase();
  return id.includes("hero") || label.includes("hero");
}

function isNavLike(s: PageIrSection): boolean {
  const id = s.id.toLowerCase();
  const label = String(s.label || "").toLowerCase();
  return (
    id.includes("nav") ||
    id.includes("header") ||
    label.includes("nav") ||
    label.includes("header")
  );
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
