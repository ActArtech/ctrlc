import fs from "node:fs";
import path from "node:path";
import {
  defineSectionPackConfig,
  mergeSectionRegistry,
  type SectionPackConfig,
  type SectionPackRegistryFile,
} from "@ctrlc/core";

/**
 * Host SectionPack config for the Northline demo homepage.
 * Paths are relative to the example app root (process.cwd() when running next).
 *
 * Runtime additions from `ctrlc register` live in `.ctrlc/registry.json`
 * and are merged by {@link getSectionPackConfig}.
 */
const baseSectionPackConfig = defineSectionPackConfig({
  defaultVariables: {
    productName: "Northline",
    tagline: "Product analytics that stay out of your way",
    demoHref: "#demo",
    email: "hello@northline.example",
    primaryCta: "Start free trial",
  },
  sharedUtilSelectors: [".nl-btn", ".nl-container", ".nl-tag"],
  recipes: [
    {
      id: "landing-core",
      label: "Landing core",
      description: "Header, hero, features, how it works, and primary CTA",
      sectionIds: ["header", "hero", "features", "how-it-works", "cta"],
    },
    {
      id: "full-home",
      label: "Full home",
      description: "All homepage sections in order",
      sectionIds: [
        "promo",
        "header",
        "hero",
        "features",
        "how-it-works",
        "cta",
        "footer",
      ],
    },
  ],
  sections: [
    {
      id: "promo",
      label: "Promo bar",
      description: "Top announcement strip linking to product news.",
      componentPath: "src/components/sections/PromoBar.tsx",
      componentExport: "PromoBar",
      contentModulePath: "src/content/home.ts",
      contentKeys: ["promoBar"],
      cssModulePath: "src/styles/demo.css",
      cssSelectors: [".nl-promo"],
      tags: ["chrome", "announcement", "cta"],
      promptRole: "Top-of-site promo / announcement bar",
      behavior: {
        id: "promo",
        whatItIs: "A full-width announcement bar above the sticky header.",
        function:
          "Surface one high-priority product message and deep-link into the page.",
        behavior: [
          "Entire row is one link.",
          "Hover brightens text and nudges the arrow right.",
        ],
        motion: ["Arrow translate on hover (~0.2s)."],
        layout: ["Centered flex row with small icon dot + label + arrow."],
        color: ["Near-black strip, light text, indigo accent dot."],
        type: ["~0.88rem body weight."],
        responsive: ["Text can wrap; keep centered alignment."],
        a11y: ["Link name comes from the visible label."],
        influences: ["Content from promoBar; stacks above header."],
        rebuildGuidance: ["One message only; keep full-row hit target."],
      },
    },
    {
      id: "header",
      label: "Site header",
      description: "Sticky marketing header with nav links and primary CTA.",
      componentPath: "src/components/sections/SiteHeader.tsx",
      componentExport: "SiteHeader",
      contentModulePath: "src/content/home.ts",
      contentKeys: ["header", "siteMeta"],
      cssModulePath: "src/styles/demo.css",
      cssSelectors: [".nl-header", ".nl-logo", ".nl-nav"],
      tags: ["chrome", "nav"],
      promptRole: "Marketing site sticky header",
      behavior: {
        id: "header",
        whatItIs: "Sticky top navigation with logo, links, and CTA.",
        function:
          "Route users through product areas while keeping trial CTA visible.",
        behavior: [
          "Sticky to top with frosted background.",
          "Desktop shows nav links; CTA always visible.",
        ],
        motion: ["Minimal; no mega menu in this demo."],
        layout: ["Space-between row; logo left, CTA right."],
        color: ["Light translucent bar over page background."],
        type: ["Logo heavy weight; nav medium weight."],
        responsive: ["Nav hidden below 768px; CTA remains."],
        a11y: ["Primary nav landmark; links have clear labels."],
        influences: ["header + siteMeta content keys."],
        rebuildGuidance: ["Keep sticky CTA; avoid burying primary action."],
      },
    },
    {
      id: "hero",
      label: "Hero",
      description: "Primary hero with headline, CTAs, stats, and insight panel.",
      componentPath: "src/components/sections/Hero.tsx",
      componentExport: "Hero",
      contentModulePath: "src/content/home.ts",
      contentKeys: ["hero"],
      cssModulePath: "src/styles/demo.css",
      cssSelectors: [".nl-hero"],
      tags: ["hero", "cta", "stats"],
      promptRole: "Landing page hero with dual CTAs and social metrics",
      behavior: {
        id: "hero",
        whatItIs:
          "Two-column hero with copy/CTAs/stats and a dark insight card.",
        function: "Explain Northline value and convert to trial or walkthrough.",
        behavior: [
          "Primary and secondary CTAs.",
          "Three metric tiles under copy.",
          "Right panel shows sample live briefing metrics.",
        ],
        motion: ["Button hover lift; static panel."],
        layout: ["CSS grid; stacks on small screens."],
        color: ["Light page bg; indigo accent; dark gradient panel."],
        type: ["Large tight tracking headline; muted subtitle."],
        responsive: ["Single column below ~900px."],
        a11y: ["One h1; panel labeled as complementary content."],
        influences: ["hero content; shared .nl-btn / .nl-tag utilities."],
        rebuildGuidance: [
          "Keep answer-first messaging; preserve dual CTA hierarchy.",
        ],
      },
    },
    {
      id: "features",
      label: "Features",
      description: "Three-up feature cards explaining product pillars.",
      componentPath: "src/components/sections/Features.tsx",
      componentExport: "Features",
      contentModulePath: "src/content/home.ts",
      contentKeys: ["features"],
      cssModulePath: "src/styles/demo.css",
      cssSelectors: [".nl-features", ".nl-feature-card"],
      tags: ["features", "cards"],
      promptRole: "Product feature grid section",
      behavior: {
        id: "features",
        whatItIs: "Section heading plus three equal feature cards.",
        function: "Communicate product pillars after the hero.",
        behavior: ["Cards lift slightly on hover with accent border."],
        motion: ["Hover translate and shadow."],
        layout: ["Three-column grid on desktop; stack on mobile."],
        color: ["White cards on soft page bg; indigo icon tiles."],
        type: ["Compact card titles; muted body."],
        responsive: ["1 col mobile, 3 col from 768px."],
        a11y: ["Articles for each card; numbered icons decorative."],
        influences: ["features content module."],
        rebuildGuidance: ["Keep three pillars clear; avoid wall of text."],
      },
    },
    {
      id: "how-it-works",
      label: "How it works",
      description: "Three-step path from stack connect to shared briefing.",
      componentPath: "src/components/sections/HowItWorks.tsx",
      componentExport: "HowItWorks",
      contentModulePath: "src/content/home.ts",
      contentKeys: ["howItWorks"],
      cssModulePath: "src/styles/demo.css",
      cssSelectors: [".nl-how", ".nl-how__step"],
      tags: ["how-it-works", "steps", "process"],
      promptRole: "Product process / how-it-works steps section",
      behavior: {
        id: "how-it-works",
        whatItIs:
          "Numbered three-step section explaining the Northline workflow.",
        function:
          "Bridge feature understanding to conversion by showing the path from connect to shared briefing.",
        behavior: [
          "Ordered list of three equal steps.",
          "Step cards lift border/shadow on hover; no navigation inside steps.",
        ],
        motion: ["Hover border and shadow only."],
        layout: [
          "Heading block then three-column step grid on desktop; stack on mobile.",
          "Each step: round number badge + title + body.",
        ],
        color: ["Elevated cards; indigo soft number badges."],
        type: ["Compact step titles; muted body copy."],
        responsive: ["1 col mobile, 3 col from 768px."],
        a11y: ["Use ordered list semantics; numbers are decorative via aria-hidden."],
        influences: ["howItWorks content key; shared .nl-tag / .nl-container."],
        rebuildGuidance: [
          "Keep three clear steps; avoid burying the path in dense prose.",
        ],
      },
    },
    {
      id: "cta",
      label: "CTA band",
      description: "Conversion band with trial CTA and trust note.",
      componentPath: "src/components/sections/Cta.tsx",
      componentExport: "Cta",
      contentModulePath: "src/content/home.ts",
      contentKeys: ["cta"],
      cssModulePath: "src/styles/demo.css",
      cssSelectors: [".nl-cta"],
      tags: ["cta", "conversion"],
      promptRole: "Mid/lower page conversion band",
      behavior: {
        id: "cta",
        whatItIs: "Full-width indigo gradient card with title, body, and CTA.",
        function: "Convert readers after they understand features.",
        behavior: ["Single primary action; trust note under body."],
        motion: ["Button hover only."],
        layout: ["Two-column on wide screens; stacked on small."],
        color: ["Indigo gradient; white primary button."],
        type: ["Bold section title; soft body text."],
        responsive: ["CTA button full-row on small screens via wrap."],
        a11y: ["Section has clear heading; button is a link."],
        influences: ["cta content key."],
        rebuildGuidance: ["One action; keep high contrast on gradient."],
      },
    },
    {
      id: "footer",
      label: "Site footer",
      description: "Closing brand blurb, links, and legal line.",
      componentPath: "src/components/sections/SiteFooter.tsx",
      componentExport: "SiteFooter",
      contentModulePath: "src/content/home.ts",
      contentKeys: ["footer"],
      cssModulePath: "src/styles/demo.css",
      cssSelectors: [".nl-footer"],
      tags: ["chrome", "footer"],
      promptRole: "Marketing site footer",
      behavior: {
        id: "footer",
        whatItIs: "Simple footer with brand, nav links, and legal copy.",
        function: "Provide secondary navigation and brand closure.",
        behavior: ["Static links; no accordion."],
        motion: ["None required."],
        layout: ["Two-column grid on desktop."],
        color: ["Light surface with muted text."],
        type: ["Brand bold; legal small muted."],
        responsive: ["Stacks on small screens."],
        a11y: ["Footer landmark; nav labeled."],
        influences: ["footer content key."],
        rebuildGuidance: ["Keep lightweight; do not turn into a mega footer."],
      },
    },
  ],
});

/** Static base config (demo sections). Prefer getSectionPackConfig() in the API. */
export const sectionPackConfig = baseSectionPackConfig;

/**
 * Config used by the SectionPack API: base demo + optional registry.json.
 */
export function getSectionPackConfig(): SectionPackConfig {
  const regPath = path.join(process.cwd(), ".ctrlc", "registry.json");
  if (!fs.existsSync(regPath)) return baseSectionPackConfig;
  try {
    const reg = JSON.parse(
      fs.readFileSync(regPath, "utf8"),
    ) as SectionPackRegistryFile;
    return mergeSectionRegistry(baseSectionPackConfig, reg);
  } catch {
    return baseSectionPackConfig;
  }
}

export default sectionPackConfig;
