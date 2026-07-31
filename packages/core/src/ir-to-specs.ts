/**
 * Page IR (v0) → section.spec.md writer + behavior bridge.
 *
 * Capture IR is CtrlC-owned JSON. Specs are React rebuild contracts
 * (never HTML dumps). SectionPack registration is part of rebuild guidance.
 */

import fs from "node:fs";
import path from "node:path";
import {
  behaviorFromSpec,
  type InteractionModel,
  type SpecToBehaviorInput,
} from "./spec-to-behavior";
import type { BehaviorBriefSpec } from "./types";

/** Supported interaction models on IR sections / specs. */
export type IrInteractionModel = InteractionModel;

/** One asset reference after materialization under public/ (or similar). */
export type PageIrAsset = {
  role?: string;
  kind?: string;
  path?: string;
  localPath?: string;
  url?: string;
  alt?: string;
};

/** Computed / extracted style triple for the appearance table. */
export type PageIrStyle = {
  element?: string;
  property?: string;
  value?: string;
};

/**
 * Styles from capture (`Record<prop, value>`) or expanded triples.
 * Compatible with `@ctrlc/capture` PageIRSection.styles.
 */
export type PageIrStyles = Record<string, string> | PageIrStyle[];

/** Responsive note row. */
export type PageIrResponsive = {
  breakpoint?: string | number;
  changes?: string;
};

/**
 * Default viewport widths (px) required in every section spec responsive matrix.
 * Mobile / tablet / desktop.
 */
export const DEFAULT_BREAKPOINTS = [390, 768, 1440] as const;

export type DefaultBreakpoint = (typeof DEFAULT_BREAKPOINTS)[number];

/**
 * Empty responsive matrix rows for 390 / 768 / 1440.
 * Optional `changes` map fills known notes per breakpoint.
 */
export function defaultResponsiveRows(
  changes?: Partial<Record<DefaultBreakpoint | number | string, string>>,
): PageIrResponsive[] {
  return DEFAULT_BREAKPOINTS.map((bp) => ({
    breakpoint: bp,
    changes: (changes?.[bp] ?? "").trim(),
  }));
}

/**
 * Ensure IR responsive notes include 390 / 768 / 1440.
 * Existing rows for those breakpoints are kept; missing ones are injected.
 * Extra non-default breakpoints are preserved after the defaults.
 */
export function ensureResponsiveMatrix(
  rows?: PageIrResponsive[] | null,
): PageIrResponsive[] {
  const existing = Array.isArray(rows) ? rows.filter(Boolean) : [];
  const byKey = new Map<string, PageIrResponsive>();
  for (const r of existing) {
    if (r.breakpoint == null || r.breakpoint === "") continue;
    const key = String(r.breakpoint).trim();
    if (!byKey.has(key)) byKey.set(key, r);
  }

  const out: PageIrResponsive[] = [];
  const used = new Set<string>();

  for (const bp of DEFAULT_BREAKPOINTS) {
    const key = String(bp);
    const found = byKey.get(key);
    if (found) {
      out.push({
        breakpoint: found.breakpoint ?? bp,
        changes: found.changes ?? "",
      });
      used.add(key);
    } else {
      out.push({ breakpoint: bp, changes: "" });
    }
  }

  for (const r of existing) {
    if (r.breakpoint == null || r.breakpoint === "") continue;
    const key = String(r.breakpoint).trim();
    if (used.has(key)) continue;
    out.push(r);
    used.add(key);
  }

  return out;
}

/** Markdown table body rows for a responsive matrix (may include extras). */
export function formatResponsiveTableRows(rows: PageIrResponsive[]): string {
  return rows
    .map(
      (r) =>
        `| ${escapeCell(String(r.breakpoint ?? ""))} | ${escapeCell(r.changes || "")} |`,
    )
    .join("\n");
}

/** Extra matrix rows only (beyond DEFAULT_BREAKPOINTS), for templates that hardcode 390/768/1440. */
export function formatExtraResponsiveTableRows(rows: PageIrResponsive[]): string {
  const defaults = new Set(DEFAULT_BREAKPOINTS.map(String));
  const extras = rows.filter(
    (r) => r.breakpoint != null && !defaults.has(String(r.breakpoint).trim()),
  );
  return extras.length ? formatResponsiveTableRows(extras) : "";
}

function changesForBreakpoint(
  rows: PageIrResponsive[],
  bp: number,
): string {
  const hit = rows.find((r) => String(r.breakpoint).trim() === String(bp));
  return hit?.changes?.trim() || "";
}

/**
 * Map capture `section.text` → content slots for the spec table / scaffold.
 */
export function contentSlotsFromIrText(
  text?: PageIrSection["text"] | null,
): Record<string, string> {
  if (!text || typeof text !== "object") return {};
  const slots: Record<string, string> = {};
  const headings = Array.isArray(text.headings)
    ? text.headings.map(String).filter(Boolean)
    : [];
  const paragraphs = Array.isArray(text.paragraphs)
    ? text.paragraphs.map(String).filter(Boolean)
    : [];
  const listItems = Array.isArray(text.listItems)
    ? text.listItems.map(String).filter(Boolean)
    : [];
  const ctas = Array.isArray(text.ctas) ? text.ctas : [];

  if (text.eyebrow) slots.eyebrow = String(text.eyebrow);
  if (headings[0]) slots.title = headings[0];
  if (headings.length > 1) slots.subtitle = headings.slice(1, 3).join(" · ");
  if (paragraphs.length) slots.body = paragraphs.slice(0, 3).join("\n\n");
  if (listItems.length) {
    slots.listItems = listItems
      .slice(0, 12)
      .map((x) => `- ${x}`)
      .join("\n");
  }

  const primary =
    ctas.find((c) => String(c?.role || "") === "primary") || ctas[0];
  const secondary =
    ctas.find((c) => String(c?.role || "") === "secondary") ||
    (ctas.length > 1 ? ctas[1] : undefined);
  if (primary?.label) {
    slots.primaryCta = String(primary.label);
    if (primary.href) slots.primaryCtaHref = String(primary.href);
  }
  if (secondary?.label) {
    slots.secondaryCta = String(secondary.label);
    if (secondary.href) slots.secondaryCtaHref = String(secondary.href);
  }
  if (ctas.length > 2) {
    slots.otherCtas = ctas
      .slice(2, 8)
      .map((c) =>
        c?.href ? `${c.label || ""} (${c.href})` : String(c?.label || ""),
      )
      .filter(Boolean)
      .join("; ");
  }
  return slots;
}

/** Markdown block describing structured IR text for builders. */
export function formatStructuredTextBlock(
  text?: PageIrSection["text"] | null,
): string {
  if (!text || typeof text !== "object") {
    return "_(no structured text on IR — fill slots from recon or legacy textSample)_";
  }
  const lines: string[] = [];
  if (text.eyebrow) lines.push(`- **eyebrow:** ${text.eyebrow}`);
  if (Array.isArray(text.headings) && text.headings.length) {
    lines.push("- **headings:**");
    for (const h of text.headings.slice(0, 12)) lines.push(`  - ${h}`);
  }
  if (Array.isArray(text.paragraphs) && text.paragraphs.length) {
    lines.push("- **paragraphs:**");
    for (const p of text.paragraphs.slice(0, 8)) lines.push(`  - ${p}`);
  }
  if (Array.isArray(text.listItems) && text.listItems.length) {
    lines.push("- **listItems:**");
    for (const li of text.listItems.slice(0, 16)) lines.push(`  - ${li}`);
  }
  if (Array.isArray(text.ctas) && text.ctas.length) {
    lines.push("- **ctas:**");
    for (const c of text.ctas.slice(0, 12)) {
      const role = c?.role ? ` [${c.role}]` : "";
      const href = c?.href ? ` → \`${c.href}\`` : "";
      lines.push(`  - ${c?.label || "(unnamed)"}${role}${href}`);
    }
  }
  if (Array.isArray(text.labels) && text.labels.length) {
    lines.push(`- **labels:** ${text.labels.slice(0, 10).join("; ")}`);
  }
  return lines.length
    ? lines.join("\n")
    : "_(empty structured text)_";
}

/**
 * One section in Page IR v0.
 * Compatible with `@ctrlc/capture` PageIRSection (+ optional enrichments).
 */
export type PageIrSection = {
  id: string;
  label?: string;
  description?: string;
  /** scroll | click | hover | time | hybrid | static */
  interactionModel?: IrInteractionModel | string;
  order?: number;
  selector?: string;
  boundingBox?: { x?: number; y?: number; width?: number; height?: number };
  /** Short free-text sample of visible copy (legacy / summary) */
  textSample?: string;
  /**
   * Structured section copy from capture (preferred).
   * headings, paragraphs, listItems, ctas — not one giant blob.
   */
  text?: {
    eyebrow?: string;
    headings?: string[];
    paragraphs?: string[];
    listItems?: string[];
    ctas?: Array<{ label?: string; href?: string; role?: string }>;
    labels?: string[];
  };
  /** Slot → text map (eyebrow, title, body, CTAs, ...) */
  content?: Record<string, string>;
  /** Semantic DOM outline (text block) */
  structure?: string;
  /** DOM child tag hints from capture */
  childrenHints?: string[];
  assets?: PageIrAsset[];
  styles?: PageIrStyles;
  states?: Record<string, string>;
  responsive?: PageIrResponsive[];
  tags?: string[];
  /** Optional pre-drafted NL brief fields */
  whatItIs?: string;
  function?: string;
  behaviorNotes?: string[];
  motionNotes?: string[];
  layoutNotes?: string[];
  colorNotes?: string[];
  typeNotes?: string[];
  responsiveNotes?: string[];
  a11yNotes?: string[];
  influenceNotes?: string[];
  rebuildNotes?: string[];
};

/**
 * Page IR v0 root document.
 * Compatible with `@ctrlc/capture` PageIR; also accepts nested `pages[0].sections`.
 */
export type PageIR = {
  schemaVersion?: number | string;
  sourceUrl?: string;
  scope?: "page" | "site" | "section" | string;
  capturedAt?: string;
  title?: string;
  viewport?: { width?: number; height?: number };
  sections?: PageIrSection[];
  /** Page-level assets (capture writes these at root) */
  assets?: PageIrAsset[];
  tokens?: {
    colors?: string[];
    fonts?: string[];
    cssVariables?: Record<string, string>;
  };
  notes?: string[];
  pages?: Array<{
    url?: string;
    sourceUrl?: string;
    sections?: PageIrSection[];
  }>;
};

export type WriteSectionSpecsFromIROptions = {
  /** Override template markdown (defaults to embedded section.spec.md) */
  template?: string;
  /** Load template from this path when `template` is not set */
  templatePath?: string;
  /** Only write these section ids (default: all) */
  sectionIds?: string[];
  /** Overwrite existing <id>.spec.md files (default true) */
  force?: boolean;
};

export type WrittenSectionSpec = {
  id: string;
  label: string;
  path: string;
  interactionModel: string;
};

export type WriteSectionSpecsFromIRResult = {
  outDir: string;
  written: WrittenSectionSpec[];
  skipped: string[];
};

export type WriteTopologyFromIROptions = {
  /** Existing PAGE_TOPOLOGY.md path; created when missing */
  topologyPath: string;
  sourceUrl?: string;
  scope?: string;
  /** Replace entire file when true; else update/append section table */
  force?: boolean;
};

const DEFAULT_REBUILD_GUIDANCE = [
  "React component only - never ship HTML dump as the product.",
  "Register SectionPack config + SectionBoundary after the component builds.",
  "Verify describe + prompt exports before marking the section done.",
];

/** Embedded fallback when monorepo template is not on disk. */
export const DEFAULT_SECTION_SPEC_TEMPLATE = `# Section spec: \`{{id}}\`

> Contract between recon/capture and the React builder.
> Fill before building. Builders must not guess missing values.

## Meta

| Field | Value |
|-------|--------|
| **id** | \`{{id}}\` |
| **label** | {{label}} |
| **Source URL** | {{sourceUrl}} |
| **Scope** | {{scope}} |
| **INTERACTION MODEL** | {{interactionModel}} |
| **Priority** | P0 / P1 / P2 |

## Structure

DOM outline (semantic):

\`\`\`text
{{structure}}
\`\`\`

## Content (real text)

| Slot | Text |
|------|------|
{{contentRows}}

## Structured text (from IR)

Headings, paragraphs, lists, and CTAs extracted during capture (preferred over a single blob).

{{structuredText}}

## Text sample (summary)

{{textSample}}

## Assets (local paths after download)

| Role | Path |
|------|------|
{{assetRows}}

## Appearance (computed / IR)

| Element | Property | Value |
|---------|----------|-------|
{{styleRows}}

## States

### Default

{{stateDefault}}

### Hover

{{stateHover}}

### Active / selected tab

{{stateActive}}

### Scrolled (if any)

{{stateScrolled}}

### Reduced motion

{{stateReducedMotion}}

### Responsive

Capture notes at **390**, **768**, and **1440** width (plus any extra breakpoints the source uses).

| Breakpoint | Changes |
|------------|---------|
| 390 | {{responsive390}} |
| 768 | {{responsive768}} |
| 1440 | {{responsive1440}} |
{{responsiveRows}}

## Behavior (for SectionPack NL brief)

| Field | Draft |
|-------|--------|
| whatItIs | {{whatItIs}} |
| function | {{function}} |
| behavior | {{behavior}} |
| motion | {{motion}} |
| layout | {{layout}} |
| color | {{color}} |
| type | {{type}} |
| responsive | {{responsive}} |
| a11y | {{a11y}} |
| influences | {{influences}} |
| rebuildGuidance | {{rebuildGuidance}} |

## SectionPack registration

\`\`\`ts
{
  id: "{{id}}",
  label: "{{label}}",
  description: "{{description}}",
  componentPath: "src/components/sections/{{Pascal}}.tsx",
  componentExport: "{{Pascal}}",
  contentModulePath: "src/content/home.ts",
  contentKeys: ["{{camel}}"],
  cssModulePath: "src/styles/sections.css",
  cssSelectors: [".{{class}}"],
  tags: [],
  promptRole: "{{label}}",
}
\`\`\`

## Builder checklist

- [ ] React component only (no HTML dump)
- [ ] Real content and assets
- [ ] Interaction model matches live page
- [ ] \`tsc\` / build clean
- [ ] \`SectionBoundary\` id matches config
- [ ] describe + prompt exports work
`;

/**
 * Normalize id → PascalCase (hero-banner → HeroBanner).
 */
export function pascalFromId(id: string): string {
  return id
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}

/**
 * Normalize id → camelCase content key (hero-banner → heroBanner).
 */
export function camelFromId(id: string): string {
  const p = pascalFromId(id);
  return p ? p.charAt(0).toLowerCase() + p.slice(1) : id;
}

/**
 * Collect sections from a Page IR document (root or pages[]).
 */
export function listIrSections(ir: PageIR | null | undefined): PageIrSection[] {
  if (!ir || typeof ir !== "object") return [];
  const root = Array.isArray(ir.sections) ? ir.sections : [];
  const fromPages = (ir.pages ?? []).flatMap((p) =>
    Array.isArray(p?.sections) ? p.sections : [],
  );
  const combined = [...root, ...fromPages].filter(
    (s): s is PageIrSection =>
      !!s && typeof s === "object" && typeof s.id === "string" && s.id.length > 0,
  );

  // Stable order: explicit order field, else document order
  return combined
    .map((s, i) => ({ s, i, order: typeof s.order === "number" ? s.order : i }))
    .sort((a, b) => a.order - b.order || a.i - b.i)
    .map(({ s }) => s);
}

/**
 * Map an IR section into SpecToBehaviorInput then BehaviorBriefSpec.
 */
export function behaviorFromIRSection(
  section: PageIrSection,
): BehaviorBriefSpec {
  const input = irSectionToSpecInput(section);
  return behaviorFromSpec(input);
}

/**
 * Convert IR section → SpecToBehaviorInput (for register / tests).
 */
export function irSectionToSpecInput(section: PageIrSection): SpecToBehaviorInput {
  const label = section.label || section.id;
  const slots = {
    ...contentSlotsFromIrText(section.text),
    ...(section.content ?? {}),
  };
  const textHint: string[] = [];
  if (slots.title) textHint.push(`Title: ${truncate(slots.title, 100)}`);
  if (slots.body) textHint.push(`Body: ${truncate(slots.body, 120)}`);
  if (slots.primaryCta) textHint.push(`Primary CTA: ${slots.primaryCta}`);
  if (slots.listItems) {
    textHint.push(`List: ${truncate(slots.listItems.replace(/\n/g, " "), 120)}`);
  }
  if (!textHint.length && section.textSample) {
    textHint.push(`Text sample: ${truncate(section.textSample, 160)}`);
  }
  const contentHints = Object.entries(slots)
    .filter(([, v]) => v)
    .slice(0, 8)
    .map(([k, v]) => `${k}: ${truncate(String(v), 80)}`);

  const structureHint =
    section.structure ||
    (section.childrenHints?.length
      ? `children: ${section.childrenHints.join(", ")}`
      : section.selector
        ? `selector: ${section.selector}`
        : undefined);

  return {
    id: section.id,
    label,
    description: section.description,
    interactionModel: section.interactionModel || "static",
    whatItIs: section.whatItIs,
    function: section.function,
    behaviorNotes: section.behaviorNotes?.length
      ? section.behaviorNotes
      : textHint.length
        ? textHint
        : undefined,
    motionNotes: section.motionNotes,
    layoutNotes: section.layoutNotes?.length
      ? section.layoutNotes
      : structureHint
        ? [`Structure from IR: ${truncate(structureHint, 120)}`]
        : undefined,
    colorNotes: section.colorNotes,
    typeNotes: section.typeNotes,
    responsiveNotes: (() => {
      if (section.responsiveNotes?.length) return section.responsiveNotes;
      const matrix = ensureResponsiveMatrix(section.responsive);
      const filled = matrix.filter((r) => (r.changes || "").trim());
      if (filled.length) {
        return filled.map(
          (r) =>
            `${r.breakpoint}: ${r.changes || "match IR responsive notes"}`,
        );
      }
      return [
        "Document desktop (1440), tablet (768), and mobile (390) layouts from recon.",
      ];
    })(),
    a11yNotes: section.a11yNotes,
    influenceNotes: section.influenceNotes,
    rebuildNotes: section.rebuildNotes?.length
      ? section.rebuildNotes
      : [
          ...DEFAULT_REBUILD_GUIDANCE,
          ...(contentHints.length
            ? [`Content slots from IR: ${contentHints.join("; ")}`]
            : []),
        ],
  };
}

/**
 * Render one section.spec.md body from IR + template.
 */
export function renderSectionSpecMarkdown(
  section: PageIrSection,
  ir: PageIR,
  template: string,
): string {
  const id = section.id;
  const label = section.label || id;
  const model = String(section.interactionModel || "static").toLowerCase();
  const sourceUrl = ir.sourceUrl || ir.pages?.[0]?.sourceUrl || ir.pages?.[0]?.url || "";
  const scope = ir.scope || "page";
  const description =
    section.description ||
    `Section "${label}" rebuilt as a React component for the target page.`;

  const content = {
    ...contentSlotsFromIrText(section.text),
    ...(section.content ?? {}),
  };
  if (section.textSample && !content.title && !content.body && !content.other) {
    // Legacy IR: only textSample present
    content.other = section.textSample;
  }

  const slotOrder = [
    "eyebrow",
    "title",
    "subtitle",
    "body",
    "listItems",
    "primaryCta",
    "primaryCtaHref",
    "secondaryCta",
    "secondaryCtaHref",
    "otherCtas",
    "other",
  ];
  const slotKeys = [
    ...slotOrder.filter((k) => content[k] != null && String(content[k]).trim()),
    ...Object.keys(content).filter(
      (k) => !slotOrder.includes(k) && String(content[k] ?? "").trim(),
    ),
  ];
  const contentRows =
    slotKeys.length > 0
      ? slotKeys
          .map((k) => `| ${k} | ${escapeCell(content[k] ?? "")} |`)
          .join("\n")
      : "| eyebrow | |\n| title | |\n| body | |\n| listItems | |\n| primaryCta | |\n| secondaryCta | |\n| other | |";

  const structuredBlock = formatStructuredTextBlock(section.text);

  const assets =
    section.assets?.length
      ? section.assets
      : Array.isArray(ir.assets)
        ? ir.assets
        : [];
  const assetRows =
    assets.length > 0
      ? assets
          .map((a) => {
            const role = a.role || a.kind || "asset";
            const p = a.path || a.localPath || a.url || "";
            return `| ${escapeCell(role)} | \`${escapeCell(p)}\` |`;
          })
          .join("\n")
      : "| image | `public/images/...` |\n| video | `public/videos/...` |\n| icon | `src/components/icons/...` |";

  const styleRows = formatStyleRows(section.styles);

  const states = section.states ?? {};
  // F4: always inject 390 / 768 / 1440 responsive matrix rows when missing
  const responsiveMatrix = ensureResponsiveMatrix(section.responsive);
  const responsive390 = escapeCell(changesForBreakpoint(responsiveMatrix, 390));
  const responsive768 = escapeCell(changesForBreakpoint(responsiveMatrix, 768));
  const responsive1440 = escapeCell(changesForBreakpoint(responsiveMatrix, 1440));
  // Templates that hardcode the three rows use extras only; empty is fine.
  const responsiveRows = formatExtraResponsiveTableRows(responsiveMatrix);

  const brief = behaviorFromIRSection(section);
  const listOrDash = (arr: string[] | undefined) =>
    arr?.length ? arr.map((x) => `- ${x}`).join(" ") : "-";

  const structureBlock =
    section.structure?.trim() ||
    (section.childrenHints?.length
      ? `section${section.selector ? ` (${section.selector})` : ""}\n${section.childrenHints.map((h) => `  ${h}`).join("\n")}`
      : section.selector
        ? `section ${section.selector}\n  ...`
        : "section\n  header?\n  ...");

  const vars: Record<string, string> = {
    id,
    label,
    description: escapeCell(description),
    sourceUrl,
    scope: String(scope),
    interactionModel: model,
    structure: structureBlock,
    contentRows,
    structuredText: structuredBlock,
    textSample: section.textSample?.trim() || "(none)",
    assetRows,
    styleRows,
    stateDefault: states.default || states.Default || "(styles / visibility)",
    stateHover: states.hover || states.Hover || "",
    stateFocus: states.focus || states.Focus || "",
    stateActive: states.active || states.selected || states.Active || "",
    stateOpenClosed:
      states.open || states.closed || states.openClosed || states.Open || "",
    stateLoading: states.loading || states.Loading || "",
    stateError: states.error || states.Error || "",
    stateScrolled: states.scrolled || states.Scrolled || "",
    stateReducedMotion:
      states.reducedMotion ||
      states["reduced-motion"] ||
      states.ReducedMotion ||
      "",
    responsive390,
    responsive768,
    responsive1440,
    responsiveRows,
    whatItIs: escapeCell(brief.whatItIs),
    function: escapeCell(brief.function),
    behavior: listOrDash(brief.behavior),
    motion: listOrDash(brief.motion),
    layout: listOrDash(brief.layout),
    color: listOrDash(brief.color),
    type: listOrDash(brief.type),
    responsive: listOrDash(brief.responsive),
    a11y: listOrDash(brief.a11y),
    influences: listOrDash(brief.influences),
    rebuildGuidance: listOrDash(brief.rebuildGuidance),
    Pascal: pascalFromId(id),
    camel: camelFromId(id),
    class: id,
  };

  return applyTemplate(template, vars).replace(/\r\n/g, "\n");
}

/**
 * Write `docs/research/components/<id>.spec.md` for each IR section.
 *
 * @param ir Page IR document
 * @param outDir Absolute or relative directory for specs (usually .../docs/research/components)
 */
export function writeSectionSpecsFromIR(
  ir: PageIR,
  outDir: string,
  options: WriteSectionSpecsFromIROptions = {},
): WriteSectionSpecsFromIRResult {
  const absOut = path.resolve(outDir);
  fs.mkdirSync(absOut, { recursive: true });

  const template = resolveTemplate(options);
  const sections = listIrSections(ir);
  const filter =
    options.sectionIds?.length && new Set(options.sectionIds.map(String));
  const force = options.force !== false;

  /** @type {WrittenSectionSpec[]} */
  const written: WrittenSectionSpec[] = [];
  /** @type {string[]} */
  const skipped: string[] = [];

  for (const section of sections) {
    if (filter && !filter.has(section.id)) continue;
    const filePath = path.join(absOut, `${section.id}.spec.md`);
    if (!force && fs.existsSync(filePath)) {
      skipped.push(section.id);
      continue;
    }
    const md = renderSectionSpecMarkdown(section, ir, template);
    fs.writeFileSync(filePath, md.endsWith("\n") ? md : md + "\n", "utf8");
    written.push({
      id: section.id,
      label: section.label || section.id,
      path: filePath,
      interactionModel: String(section.interactionModel || "static").toLowerCase(),
    });
  }

  return { outDir: absOut, written, skipped };
}

/**
 * Create or update PAGE_TOPOLOGY.md section table from IR order.
 */
export function writeTopologyFromIR(
  ir: PageIR,
  options: WriteTopologyFromIROptions,
): { path: string; created: boolean; sectionCount: number } {
  const topologyPath = path.resolve(options.topologyPath);
  fs.mkdirSync(path.dirname(topologyPath), { recursive: true });

  const sections = listIrSections(ir);
  const sourceUrl =
    options.sourceUrl || ir.sourceUrl || ir.pages?.[0]?.url || "(set URL)";
  const scope = options.scope || ir.scope || "page";

  const tableLines = [
    "| # | id | Interaction model | Notes |",
    "|---|-----|-------------------|-------|",
    ...sections.map((s, i) => {
      const model = String(s.interactionModel || "static").toLowerCase();
      const notes = escapeCell(s.label && s.label !== s.id ? s.label : "");
      return `| ${i + 1} | ${s.id} | ${model} | ${notes} |`;
    }),
  ];

  const exists = fs.existsSync(topologyPath);
  if (!exists || options.force) {
    const body = [
      `# Page topology`,
      ``,
      `**Source:** ${sourceUrl}  `,
      `**Scope:** ${scope}`,
      ``,
      `## Sections (top → bottom)`,
      ``,
      ...tableLines,
      ``,
      `## Overlays / sticky`,
      ``,
      `-`,
      ``,
      `## Assembly notes`,
      ``,
      `- Specs: \`docs/research/components/<id>.spec.md\``,
      `- Rebuild as React + register SectionPack (never HTML dump product).`,
      ``,
    ].join("\n");
    fs.writeFileSync(topologyPath, body, "utf8");
    return { path: topologyPath, created: !exists, sectionCount: sections.length };
  }

  // Update existing: replace section table between header and next ## or end
  let text = fs.readFileSync(topologyPath, "utf8");
  const tableBlock = tableLines.join("\n");
  const sectionHeaderRe =
    /(##\s*Sections[^\n]*\n)([\s\S]*?)(?=\n##\s|\n?$)/i;
  if (sectionHeaderRe.test(text)) {
    text = text.replace(sectionHeaderRe, `$1\n${tableBlock}\n`);
  } else {
    text =
      text.trimEnd() +
      `\n\n## Sections (top → bottom)\n\n${tableBlock}\n`;
  }
  fs.writeFileSync(topologyPath, text.endsWith("\n") ? text : text + "\n", "utf8");
  return { path: topologyPath, created: false, sectionCount: sections.length };
}

/**
 * Parse JSON text into PageIR (throws on invalid JSON).
 */
export function parsePageIR(json: string): PageIR {
  const data = JSON.parse(json) as PageIR;
  if (!data || typeof data !== "object") {
    throw new Error("Page IR must be a JSON object");
  }
  return data;
}

/**
 * Load Page IR from a file path.
 */
export function loadPageIR(filePath: string): PageIR {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Page IR not found: ${abs}`);
  }
  return parsePageIR(fs.readFileSync(abs, "utf8"));
}

function resolveTemplate(options: WriteSectionSpecsFromIROptions): string {
  if (options.template) return options.template;
  if (options.templatePath) {
    const abs = path.resolve(options.templatePath);
    if (fs.existsSync(abs)) {
      return fs.readFileSync(abs, "utf8");
    }
  }
  return DEFAULT_SECTION_SPEC_TEMPLATE;
}

/** Normalize capture Record styles or triple arrays into markdown table rows. */
function formatStyleRows(styles: PageIrStyles | undefined): string {
  if (!styles) {
    return "| root | background | |\n| root | padding | |\n| title | font-size | |\n| title | font-family | |\n| title | color | |";
  }
  if (Array.isArray(styles)) {
    if (!styles.length) {
      return "| root | background | |\n| root | padding | |\n| title | font-size | |\n| title | font-family | |\n| title | color | |";
    }
    return styles
      .map(
        (s) =>
          `| ${escapeCell(s.element || "root")} | ${escapeCell(s.property || "")} | ${escapeCell(s.value || "")} |`,
      )
      .join("\n");
  }
  // capture: Record<cssProperty, value>
  const entries = Object.entries(styles);
  if (!entries.length) {
    return "| root | background | |\n| root | padding | |\n| title | font-size | |\n| title | font-family | |\n| title | color | |";
  }
  return entries
    .map(
      ([property, value]) =>
        `| root | ${escapeCell(property)} | ${escapeCell(value)} |`,
    )
    .join("\n");
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    vars[key] != null ? vars[key] : "",
  );
}

function escapeCell(s: string): string {
  return String(s ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
}

function truncate(s: string, n: number): string {
  const t = String(s).replace(/\s+/g, " ").trim();
  return t.length <= n ? t : t.slice(0, n - 1) + "...";
}
