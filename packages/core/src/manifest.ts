/**
 * Section pack config helpers and the Northline demo manifest.
 *
 * Host apps supply their own SectionPackConfig. The demo config points at
 * paths under examples/next-demo (relative to that app root as cwd).
 */

import type {
  BehaviorBriefSpec,
  PackRecipe,
  PackVariables,
  SectionPackConfig,
  SectionPackEntry,
} from "./types";
import { DEMO_BEHAVIOR_BRIEFS } from "./behavior-briefs";

const DEMO_CSS = "src/styles/sections.css";
const DEMO_CONTENT = "src/content/home.ts";
const DEMO_SHARED = [
  "src/components/sections/shared/Reveal.tsx",
  "src/components/sections/shared/SectionShell.tsx",
  "src/lib/utils.ts",
] as const;

/** Shared utility selectors for the Northline demo design system. */
export const DEMO_SHARED_UTIL_SELECTORS = [
  ".nl-btn",
  ".nl-container",
  ".nl-tag",
  ".nl-h2",
  ".nl-section",
  ".nl-reveal",
  ".nl-link-quiet",
  ".nl-heading-block",
  ".nl-badge",
] as const;

/** Default generic shared utils when host does not override. */
export const DEFAULT_SHARED_UTIL_SELECTORS = [
  ".btn",
  ".container",
  ".tag",
  ".heading",
  ".section",
  ".reveal",
  ".badge",
] as const;

export const DEMO_DEFAULT_VARIABLES: PackVariables = {
  productName: "Northline",
  tagline: "Operations clarity for growing teams",
  demoHref: "/demo",
  email: "hello@northline.example",
  primaryCta: "Book a demo",
};

const DEMO_SECTIONS: SectionPackEntry[] = [
  {
    id: "promo",
    label: "Promo bar",
    description: "Top announcement strip with icon, label, and CTA link.",
    componentPath: "src/components/sections/PromoBar.tsx",
    componentExport: "PromoBar",
    contentKeys: ["promoBar"],
    contentModulePath: DEMO_CONTENT,
    cssSelectors: [".nl-promo"],
    cssModulePath: DEMO_CSS,
    relatedPaths: [...DEMO_SHARED],
    tags: ["chrome", "cta", "announcement"],
    promptRole: "Top-of-site promo / announcement bar component",
  },
  {
    id: "header",
    label: "Site header",
    description: "Sticky header with nav, mobile drawer, and primary CTA.",
    componentPath: "src/components/sections/SiteHeader.tsx",
    componentExport: "SiteHeader",
    contentKeys: ["siteMeta", "nav"],
    contentModulePath: DEMO_CONTENT,
    cssSelectors: [".nl-header", ".nl-nav", ".nl-drawer", ".nl-burger", ".nl-logo"],
    cssModulePath: DEMO_CSS,
    relatedPaths: [...DEMO_SHARED],
    tags: ["chrome", "nav", "responsive"],
    promptRole: "Marketing site navigation header",
  },
  {
    id: "hero",
    label: "Hero",
    description: "Primary hero with headline, body, CTAs, and optional media.",
    componentPath: "src/components/sections/HeroSection.tsx",
    componentExport: "HeroSection",
    contentKeys: ["hero"],
    contentModulePath: DEMO_CONTENT,
    cssSelectors: [".nl-hero"],
    cssModulePath: DEMO_CSS,
    relatedPaths: [...DEMO_SHARED],
    tags: ["hero", "media", "cta"],
    promptRole: "Landing page hero section with media and CTAs",
  },
  {
    id: "features",
    label: "Features",
    description: "Multi-up product feature cards with hover affordance.",
    componentPath: "src/components/sections/FeaturesSection.tsx",
    componentExport: "FeaturesSection",
    contentKeys: ["features"],
    contentModulePath: DEMO_CONTENT,
    cssSelectors: [".nl-features", ".nl-feature-card"],
    cssModulePath: DEMO_CSS,
    relatedPaths: [...DEMO_SHARED],
    tags: ["features", "cards"],
    promptRole: "Product feature grid section",
  },
  {
    id: "cta",
    label: "Contact CTA",
    description: "Centered conversion card with demo CTA.",
    componentPath: "src/components/sections/CtaSection.tsx",
    componentExport: "CtaSection",
    contentKeys: ["cta"],
    contentModulePath: DEMO_CONTENT,
    cssSelectors: [".nl-cta"],
    cssModulePath: DEMO_CSS,
    relatedPaths: [...DEMO_SHARED],
    tags: ["cta", "contact"],
    promptRole: "Contact / demo CTA section",
  },
  {
    id: "footer",
    label: "Site footer",
    description: "Multi-column footer with brand, links, and socials.",
    componentPath: "src/components/sections/SiteFooter.tsx",
    componentExport: "SiteFooter",
    contentKeys: ["footer", "siteMeta"],
    contentModulePath: DEMO_CONTENT,
    cssSelectors: [".nl-footer"],
    cssModulePath: DEMO_CSS,
    relatedPaths: [...DEMO_SHARED],
    tags: ["chrome", "footer"],
    promptRole: "Marketing site footer",
  },
];

const DEMO_RECIPES: PackRecipe[] = [
  {
    id: "landing-core",
    label: "Landing core",
    description:
      "Core marketing landing: chrome, hero, features, CTA, and footer.",
    sectionIds: ["promo", "header", "hero", "features", "cta", "footer"],
  },
  {
    id: "conversion",
    label: "Conversion funnel",
    description: "Hero + features + CTA for a tight conversion path.",
    sectionIds: ["hero", "features", "cta"],
  },
  {
    id: "chrome",
    label: "Site chrome",
    description: "Promo, header, and footer only.",
    sectionIds: ["promo", "header", "footer"],
  },
  {
    id: "full-home",
    label: "Full home",
    description: "All homepage sections in site order.",
    sectionIds: ["promo", "header", "hero", "features", "cta", "footer"],
  },
];

function defaultResolveComponentImport(entry: SectionPackEntry): string {
  const path = entry.componentPath.replace(/\\/g, "/");
  if (path.startsWith("src/")) {
    return `@/${path.slice(4).replace(/\.tsx?$/, "")}`;
  }
  return `@/${path.replace(/\.tsx?$/, "")}`;
}

/**
 * Demo SectionPackConfig for brand Northline.
 * Paths are relative to examples/next-demo when that app is the cwd.
 */
export function createDemoSectionPackConfig(
  overrides?: Partial<SectionPackConfig>,
): SectionPackConfig {
  const sections = DEMO_SECTIONS.map((entry) => {
    const behavior: BehaviorBriefSpec | undefined =
      DEMO_BEHAVIOR_BRIEFS[entry.id];
    return behavior ? { ...entry, behavior } : { ...entry };
  });

  const base: SectionPackConfig = {
    sections,
    recipes: DEMO_RECIPES.map((r) => ({ ...r, sectionIds: [...r.sectionIds] })),
    defaultVariables: { ...DEMO_DEFAULT_VARIABLES },
    sharedUtilSelectors: [...DEMO_SHARED_UTIL_SELECTORS],
    resolveComponentImport: defaultResolveComponentImport,
    behaviorSpecs: { ...DEMO_BEHAVIOR_BRIEFS },
  };

  if (!overrides) return base;

  return {
    ...base,
    ...overrides,
    defaultVariables: {
      ...base.defaultVariables,
      ...(overrides.defaultVariables ?? {}),
    },
    behaviorSpecs: {
      ...base.behaviorSpecs,
      ...(overrides.behaviorSpecs ?? {}),
    },
    sections: overrides.sections ?? base.sections,
    recipes: overrides.recipes ?? base.recipes,
    sharedUtilSelectors:
      overrides.sharedUtilSelectors ?? base.sharedUtilSelectors,
  };
}

/** Alias matching package contract naming. */
export const createDemoConfig = createDemoSectionPackConfig;

/** Ordered demo section ids (promo through footer). */
export const DEMO_SECTION_IDS = DEMO_SECTIONS.map((s) => s.id);

export function getSectionEntry(
  config: SectionPackConfig,
  id: string,
): SectionPackEntry | undefined {
  return config.sections.find((s) => s.id === id);
}

export function listSectionIds(config: SectionPackConfig): string[] {
  return config.sections.map((s) => s.id);
}

export function listSectionEntries(
  config: SectionPackConfig,
): SectionPackEntry[] {
  return [...config.sections];
}

/** Index sections by id for O(1) lookup. */
export function indexSections(
  config: SectionPackConfig,
): Map<string, SectionPackEntry> {
  return new Map(config.sections.map((s) => [s.id, s]));
}

/**
 * Default import path resolver used when config does not supply one.
 * `@/` maps from `src/` project paths.
 */
export function resolveDefaultComponentImport(entry: SectionPackEntry): string {
  return defaultResolveComponentImport(entry);
}

/** Lightweight summary for list endpoints (no file bodies). */
export function summarizeSectionEntry(entry: SectionPackEntry) {
  return {
    id: entry.id,
    label: entry.label,
    description: entry.description,
    tags: entry.tags,
    componentPath: entry.componentPath,
    componentExport: entry.componentExport,
    contentKeys: entry.contentKeys,
    contentModulePath: entry.contentModulePath ?? null,
    cssSelectors: entry.cssSelectors,
    relatedCount: entry.relatedPaths?.length ?? 0,
    promptRole: entry.promptRole,
    previewImage: entry.previewImage,
    thumbnail: entry.thumbnail,
  };
}
