/**
 * Natural-language behavior briefs for section packs.
 * Describes purpose, motion, interaction, layout, color, and multi-file influences
 * so agents can rebuild a section without (or alongside) raw code.
 */

import type {
  BehaviorBriefSpec,
  FileTreeEntry,
  ImportGraph,
  SectionPack,
  SectionPackEntry,
} from "./types";

export type { BehaviorBriefSpec };

/** Hand-authored behavioral truth for the Northline demo sections. */
export const DEMO_BEHAVIOR_BRIEFS: Record<string, BehaviorBriefSpec> = {
  promo: {
    id: "promo",
    whatItIs:
      "A full-width top announcement bar that sits above the sticky header.",
    function:
      "Surface a single high-priority product message and route users to a deep link with one click.",
    behavior: [
      "Entire bar is one clickable link (not separate text + button).",
      "Hover slightly lightens/darkens the background and nudges the arrow right.",
      "Does not collapse or dismiss; always visible at document top.",
    ],
    motion: [
      "Arrow translate-x micro-interaction on hover (~0.25s ease).",
      "No entrance animation required; static chrome.",
    ],
    layout: [
      "Full bleed horizontal strip.",
      "Content centered with flex, gap ~0.65rem, horizontal page gutter padding.",
      "Icon 18px, label single line, trailing arrow.",
    ],
    color: [
      "Near-black background.",
      "White text; optional tinted icon.",
      "Hover slightly lifts background.",
    ],
    type: [
      "0.88rem medium weight body, slight letter-spacing.",
      "Not uppercase; sentence-style product message.",
    ],
    responsive: [
      "Label may wrap or truncate on very small screens; keep icon + arrow.",
      "Same vertical padding across breakpoints.",
    ],
    a11y: [
      "Link must have clear accessible name from the label text.",
      "Icon decorative (empty alt).",
    ],
    influences: [
      "Content from home `promoBar` (href, label, icon URL).",
      "Sits above SiteHeader; stack order is promo then header.",
    ],
    rebuildGuidance: [
      "Keep one primary message only.",
      "Preserve full-row hit target and dark high-contrast chrome.",
    ],
  },
  header: {
    id: "header",
    whatItIs:
      "Sticky marketing navigation with links, auth/demo actions, and a mobile drawer.",
    function:
      "Let users discover product areas while keeping Book a demo always available.",
    behavior: [
      "Sticky to top; gains border/shadow after slight scroll.",
      "Desktop: primary nav links visible in the bar.",
      "Mobile: burger opens right drawer; body scroll locks while open.",
    ],
    motion: [
      "Drawer slides from right (~0.3s ease).",
      "Burger lines morph to X when open.",
      "Backdrop fade over page content.",
    ],
    layout: [
      "Fixed height ~72px.",
      "Logo left; nav center/flex; actions right (Login, Book a demo, burger).",
      "Drawer full-height panel ~360px max width.",
    ],
    color: [
      "Translucent warm off-white with blur when sticky.",
      "Ink text; accent badges for NEW when used.",
      "Primary CTA is solid near-black button.",
    ],
    type: [
      "0.92rem medium nav labels.",
      "Uppercase micro-labels inside drawer sections when present.",
    ],
    responsive: [
      "Desktop nav hidden below ~960px; burger shown.",
      "Demo CTA remains on smallest widths.",
    ],
    a11y: [
      "aria-expanded on menu triggers and burger.",
      "Drawer aria-hidden when closed.",
      "Keyboard operable buttons for menus.",
    ],
    influences: [
      "siteMeta for logo name, login URL, demo href.",
      "Shared nl-btn / nl-badge styles.",
    ],
    rebuildGuidance: [
      "Keep nav data-driven when a site map exists.",
      "Preserve sticky behavior and mobile scroll lock.",
    ],
  },
  hero: {
    id: "hero",
    whatItIs:
      "Primary landing hero with headline, body, CTAs, and optional product media.",
    function:
      "Communicate the brand promise and convert via Book a demo / secondary links.",
    behavior: [
      "Staggered reveal on load/scroll for title, body, actions, media.",
      "Primary solid CTA plus optional ghost secondary actions.",
      "Media starts as poster + play; click may swap to embed with autoplay.",
    ],
    motion: [
      "Reveal: fade up ~28px over 0.7s with stagger delays (80-280ms).",
      "Optional slow ken-burns on background poster.",
      "Play control centered over thumb; no autoplay until user gesture.",
    ],
    layout: [
      "Min height ~92dvh / max 900px, vertically centered content.",
      "Max content width ~1180px with page gutters.",
      "Headline max ~14ch; body max ~48ch.",
    ],
    color: [
      "Warm paper background.",
      "Ink headline with optional gradient accent line.",
      "Media overlay gradients keep text readable.",
    ],
    type: [
      "Display font clamp ~2.5-5.2rem, tight leading ~0.98.",
      "Body ~1-1.125rem, soft ink.",
    ],
    responsive: [
      "Headline can go full width on mobile.",
      "CTA row wraps; media stays full width of content column.",
    ],
    a11y: [
      "h1 with id for skip/anchor.",
      "Play control has aria-label when media is interactive.",
    ],
    influences: [
      "Content from `hero` export (copy, poster, CTAs).",
      "Reveal + shared primitives.",
      "nl-btn primary/ghost language used site-wide.",
    ],
    rebuildGuidance: [
      "Keep clear hierarchy: rating/eyebrow, title, body, CTAs, media.",
      "Preserve click-to-play media (no silent autoplay with sound).",
    ],
  },
  features: {
    id: "features",
    whatItIs: "Multi-up product feature cards with hover lift and soft glow.",
    function: "Explain core product pillars and deep-link into product routes.",
    behavior: [
      "Each card is a full-card link when href is present.",
      "Optional soft badge (e.g. For operators).",
      "Hover lifts card and strengthens border/shadow.",
    ],
    motion: [
      "Reveal stagger per card (~90ms).",
      "Hover translateY(-6px) + shadow.",
    ],
    layout: [
      "3-column grid with 1rem gap (demo default).",
      "Cards min-height ~280px, flex column, CTA at bottom.",
      "Section heading left-aligned with tag Features.",
    ],
    color: [
      "White cards on paper bg, light border.",
      "Hover border mixes brand accent.",
      "CTA text deep accent color.",
    ],
    type: [
      "Card titles ~1.35rem display.",
      "Body soft ink line-height 1.55.",
    ],
    responsive: ["Stack to 1 column under ~960px."],
    a11y: ["Links must include title text; avoid empty cards."],
    influences: [
      "Content `features`.",
      "Reveal + section heading shared.",
    ],
    rebuildGuidance: [
      "Maintain full-card hit targets.",
      "Keep equal visual weight across cards.",
    ],
  },
  cta: {
    id: "cta",
    whatItIs: "Centered contact/demo CTA card.",
    function: "Convert interested visitors into a demo booking.",
    behavior: ["Single primary button to /demo (or mailto if configured)."],
    motion: ["Reveal on enter; button hover lift via shared button styles."],
    layout: [
      "Large rounded card, centered text, max body ~46ch.",
      "Generous padding clamp 2-3.5rem.",
    ],
    color: [
      "White card, soft accent radial corner, soft shadow.",
      "Primary dark CTA button.",
    ],
    type: [
      "Centered section heading.",
      "Body soft ink.",
    ],
    responsive: ["Card full width of container with gutters."],
    a11y: ["Heading hierarchy; clear button name."],
    influences: ["Content `cta`.", "Shared button language."],
    rebuildGuidance: [
      "One clear CTA; avoid form complexity unless product requires it.",
    ],
  },
  footer: {
    id: "footer",
    whatItIs: "Dark multi-column footer with brand, link groups, socials, and credit.",
    function: "Site-wide navigation exhaust and legal/contact endpoints.",
    behavior: [
      "Link columns from content or site map.",
      "Social links open new tab.",
    ],
    motion: ["None beyond link hover color."],
    layout: [
      "Brand column + dynamic columns grid.",
      "Bottom bar: socials left, credit right.",
    ],
    color: [
      "Near-black background.",
      "Muted white text; hover to full white.",
      "Uppercase micro titles at reduced opacity.",
    ],
    type: [
      "0.92rem link lists.",
      "0.75rem tracked column titles.",
    ],
    responsive: ["Stack columns under ~960px; brand full width."],
    a11y: ["nav-like lists; external links with relnoopener."],
    influences: [
      "footer + siteMeta content exports.",
      "Appears on home and inner marketing pages.",
    ],
    rebuildGuidance: ["Keep data-driven columns when possible."],
  },
};

/** Alias used by pack builders; demo briefs are the package default registry. */
export const BEHAVIOR_BRIEFS = DEMO_BEHAVIOR_BRIEFS;

export function getBehaviorSpec(
  id: string,
  extra?: Record<string, BehaviorBriefSpec>,
): BehaviorBriefSpec | undefined {
  return extra?.[id] ?? BEHAVIOR_BRIEFS[id];
}

function bullets(lines: string[]): string {
  return lines.map((l) => `- ${l}`).join("\n");
}

function influencesFromPack(pack: {
  fileTree: FileTreeEntry[];
  importGraph?: ImportGraph;
}): string[] {
  const lines: string[] = [];
  for (const f of pack.fileTree) {
    lines.push(`${f.role}: \`${f.path}\` (${f.bytes} bytes)`);
  }
  if (pack.importGraph?.projectDeps?.length) {
    lines.push(
      `Component imports project modules: ${pack.importGraph.projectDeps
        .map((d) => `\`${d}\``)
        .join(", ")}`,
    );
  }
  return lines;
}

export type BuildBehaviorBriefMarkdownOptions = {
  behaviorSpecs?: Record<string, BehaviorBriefSpec>;
  /**
   * Pre-resolved brief (e.g. from draftBehaviorBrief). When set, used as the
   * full spec without consulting entry.behavior / registry again.
   */
  resolvedBehavior?: BehaviorBriefSpec;
};

/**
 * Natural-language brief an agent can use to rebuild the section
 * with correct behavior, motion, styling, and multi-file context.
 *
 * Prefer passing `options.resolvedBehavior` from `draftBehaviorBrief` when
 * the entry has no complete hand-authored brief. `buildSectionPack` does this
 * automatically (hand-authored / DEMO registry fields still win per field).
 */
export function buildBehaviorBriefMarkdown(
  entry: SectionPackEntry,
  pack: Pick<
    SectionPack,
    "fileTree" | "importGraph" | "contentHash" | "tags" | "label" | "id"
  >,
  options?: BuildBehaviorBriefMarkdownOptions,
): string {
  const spec =
    options?.resolvedBehavior ??
    entry.behavior ??
    getBehaviorSpec(entry.id, options?.behaviorSpecs);
  const fileInfluences = influencesFromPack(pack);

  if (!spec) {
    return `# Natural language brief: ${entry.label} (\`${entry.id}\`)

## What this is
${entry.description}

## Role
${entry.promptRole}

## Tags
${entry.tags.map((t) => `\`${t}\``).join(", ")}

## Multi-file system / influences
${bullets(fileInfluences)}

## Rebuild request
Rebuild this section as a production React component system. Match the project's design tokens, shared primitives, and interaction quality. Prefer composition over a single giant file when multiple concerns exist (content module, CSS, hooks, shared UI).

---
_contentHash \`${pack.contentHash}\` · format=describe_
`;
  }

  return `# Natural language section brief: ${spec.whatItIs.replace(/\.$/, "")}

> Use this brief to recreate the section in another codebase or prompt an agent.
> This is **not** a raw code dump - it describes function, motion, behavior, styling, alignment, and multi-file influences.
> If you also need sources, attach the code pack (\`format=prompt\` or \`format=zip\`).

## Identity
- **Section id:** \`${entry.id}\`
- **Label:** ${entry.label}
- **Tags:** ${entry.tags.map((t) => `\`${t}\``).join(", ")}
- **contentHash:** \`${pack.contentHash}\`

## What it is
${spec.whatItIs}

## Function (why it exists)
${spec.function}

## Behavior & interaction
${bullets(spec.behavior)}

## Motion & animation
${bullets(spec.motion)}

## Layout, alignment & spacing
${bullets(spec.layout)}

## Color & surfaces
${bullets(spec.color)}

## Typography
${bullets(spec.type)}

## Responsive behavior
${bullets(spec.responsive)}

## Accessibility
${bullets(spec.a11y)}

## Multi-file system & influences
Hand-authored:
${bullets(spec.influences)}

Resolved pack surface (this section may be many files):
${bullets(fileInfluences)}

Primary selectors: ${entry.cssSelectors.map((s) => `\`${s}\``).join(", ")}
Component export: \`${entry.componentExport}\` from \`${entry.componentPath}\`
Content keys: ${entry.contentKeys.length ? entry.contentKeys.map((k) => `\`${k}\``).join(", ") : "_none_"}

## Rebuild guidance
${bullets(spec.rebuildGuidance)}

## Agent instruction (copy-ready)
Implement a section that matches this brief closely:
1. Preserve interaction model, motion character, hierarchy, and conversion intent.
2. Use a clean component + content module + scoped styles structure (multi-file is expected).
3. Match color language and surface hierarchy described above.
4. Respect alignment and spacing rhythm described above.
5. Wire real content fields rather than lorem where content keys exist.
6. Do not reduce multi-file systems into an unmaintainable single HTML dump unless explicitly asked.

---
_Natural language brief · section \`${entry.id}\` · contentHash \`${pack.contentHash}\`_
`;
}

export function buildMultiBehaviorBriefMarkdown(
  packs: SectionPack[],
  recipeLabel?: string,
): string {
  const title = recipeLabel
    ? `Natural language briefs: ${recipeLabel}`
    : `Natural language briefs: ${packs.map((p) => p.id).join(", ")}`;

  const parts = packs.map((p) => {
    const prebuilt = p.behaviorBriefMarkdown;
    if (prebuilt) return prebuilt;
    const entryLike = {
      id: p.id,
      label: p.label,
      description: p.description,
      tags: p.tags,
      promptRole: p.promptRole,
      componentPath: p.fileTree.find((f) => f.role === "component")?.path ?? "",
      componentExport: p.id,
      contentKeys: [] as string[],
      cssSelectors: [] as string[],
      cssModulePath: "",
    } satisfies SectionPackEntry;
    return buildBehaviorBriefMarkdown(entryLike, p);
  });

  return `# ${title}

This pack describes **${packs.length} sections** in natural language (function, motion, behavior, styling, alignment, multi-file influences).
Use it when you want an agent to understand *what to build* before receiving code - or instead of pasting every file.

${parts.map((b, i) => `---\n\n## Section ${i + 1}\n\n${b}`).join("\n\n")}

---
_Multi natural-language brief · ${packs.map((p) => p.id).join(" + ")}_
`;
}
