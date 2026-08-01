/**
 * Unit tests for @ctrlc/core SectionPack builder (no test framework).
 *
 * Usage:
 *   npm test -w @ctrlc/core
 *   node --experimental-strip-types scripts/test-pack.mjs
 *
 * Exit 0 on success, 1 on failure.
 */

import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  unlinkSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "..");

/** Remove empty legacy Slice / non-canonical stub modules (idempotent). */
function removeLegacyStubs() {
  const stubs = [
    "build-slice-pack.ts",
    "multi-slice-pack.ts",
    "slice-manifest.ts",
    "build-slice-zip.ts",
    "build-pack.ts",
    "multi-pack.ts",
    "multi.ts",
    "behavior.ts",
    "config.ts",
    "extract.ts",
    "format.ts",
    "build-pack-zip.ts",
    "extract.test.ts",
  ];
  const srcDir = path.join(PKG_ROOT, "src");
  for (const name of stubs) {
    const p = path.join(srcDir, name);
    if (existsSync(p)) {
      try {
        unlinkSync(p);
      } catch {
        /* ignore lock races */
      }
    }
  }
}

removeLegacyStubs();

// Drop accidental empty helper left by agent runs (idempotent).
{
  const stray = path.join(PKG_ROOT, "scripts", "_run-build-test.mjs");
  if (existsSync(stray)) {
    try {
      unlinkSync(stray);
    } catch {
      /* ignore */
    }
  }
}

let failed = 0;
let passed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  ok  ${msg}`);
  } else {
    failed++;
    console.error(`  x   ${msg}`);
  }
}

function assertEq(actual, expected, msg) {
  const ok = Object.is(actual, expected);
  if (ok) {
    passed++;
    console.log(`  ok  ${msg}`);
  } else {
    failed++;
    console.error(`  x   ${msg}`);
    console.error(`      expected: ${JSON.stringify(expected)}`);
    console.error(`      actual:   ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(hay, needle, msg) {
  assert(typeof hay === "string" && hay.includes(needle), msg);
}

async function loadCore() {
  const abs = path.join(PKG_ROOT, "src/index.ts");
  return import(pathToFileURL(abs).href);
}

function expectedHash(component, content, css) {
  return createHash("sha256")
    .update(component, "utf8")
    .update("\0", "utf8")
    .update(content, "utf8")
    .update("\0", "utf8")
    .update(css, "utf8")
    .digest("hex");
}

async function main() {
  console.log("test-pack: loading @ctrlc/core...\n");

  let core;
  try {
    core = await loadCore();
  } catch (e) {
    console.error("Failed to import package sources.");
    console.error(
      "Requires Node >= 22 with --experimental-strip-types (engines: >=20).",
    );
    console.error(e);
    process.exit(1);
  }

  const {
    extractContentKeys,
    extractCssBySelectors,
    parseCssBlocks,
    hashPackSurfaces,
    buildSectionPack,
    formatPackForCopy,
    COPY_FORMATS,
    MULTI_COPY_FORMATS,
    resolveImportSpecifier,
    buildImportGraph,
    createDemoSectionPackConfig,
    DEMO_SECTION_IDS,
    listSectionIds,
    getSectionEntry,
    validateRecipe,
    validateMultiSectionIds,
    buildMultiSectionPack,
    buildMultiSectionPackAsync,
    buildSectionPacksParallel,
    formatMultiPackForCopy,
    buildSectionGraph,
    formatSectionGraphMarkdown,
    formatSectionGraphMermaid,
    normalizeSectionIds,
    parseIdsParam,
    mergePackVariables,
    applyPackVariables,
    getDefaultPackVariables,
    buildSectionZip,
    buildMultiSectionZip,
    buildStoreZip,
    crc32,
    buildBehaviorBriefMarkdown,
    DEMO_BEHAVIOR_BRIEFS,
    PackCache,
    getCachedSectionPack,
    packSourceMtimeKey,
    packContentHashKey,
    DEFAULT_PACK_CACHE_MAX,
    buildRecipePack,
    defineSectionPackConfig,
    validateSectionPackConfig,
    validateBehaviorBrief,
    assertConfigShape,
    getConfigSchema,
    SUPPORTED_SCHEMA_VERSION,
    analyzeSectionSources,
    draftBehaviorBrief,
    enrichConfigWithDraftBriefs,
    diffSectionPacks,
    formatPackDiffMarkdown,
    snapshotSectionPack,
    compareSectionSources,
  } = core;

  console.log("extractContentKeys");
  {
    const src = `
export const hero = {
  title: "Hello",
  nested: { a: 1, b: [2, 3] },
} as const;

export const other = "skip me";

export const faq = [
  { q: "Why?", a: "Because { nested }" },
];
`;
    const out = extractContentKeys(src, ["hero", "faq"]);
    assertIncludes(out, "export const hero", "includes hero export");
    assertIncludes(out, "nested: { a: 1, b: [2, 3] }", "keeps nested object");
    assertIncludes(out, "export const faq", "includes faq export");
    assert(!out.includes("export const other"), "excludes other export");

    const missing = extractContentKeys(src, ["nope"]);
    assertIncludes(missing, "missing export: nope", "notes missing key");

    const empty = extractContentKeys(src, []);
    assertIncludes(empty, "no content keys", "empty keys message");
  }

  console.log("\nextractCssBySelectors / parseCssBlocks");
  {
    const css = `
:root { --accent: #0f0; }
.btn { color: red; }
.btn--primary { color: blue; }
.nl-hero { padding: 1rem; }
.nl-hero__title { font-size: 2rem; }
@media (min-width: 768px) {
  .nl-hero { padding: 2rem; }
}
@keyframes hero-in { from { opacity: 0; } to { opacity: 1; } }
.nl-hero { animation: hero-in 0.5s; }
`;
    const blocks = parseCssBlocks(css);
    assert(blocks.length >= 4, "parses multiple CSS blocks");

    const extracted = extractCssBySelectors(css, [".nl-hero"], {
      sharedUtilSelectors: [".btn"],
      extraScanText: 'className="btn btn--primary"',
    });
    assertIncludes(extracted, ".nl-hero", "includes section selector");
    assertIncludes(extracted, ".nl-hero__title", "includes BEM element");
    assertIncludes(extracted, "@media", "keeps nested media rules");
    assertIncludes(extracted, "hero-in", "includes related keyframes");
    assertIncludes(extracted, ".btn", "pulls shared util when scanned");
    assertIncludes(extracted, ":root", "includes design tokens");
  }

  console.log("\nhashPackSurfaces");
  {
    const h = hashPackSurfaces("a", "b", "c");
    assertEq(h, expectedHash("a", "b", "c"), "stable sha256 of three surfaces");
    assert(h.length === 64, "hex length 64");
  }

  console.log("\nimport graph");
  {
    assertEq(
      resolveImportSpecifier("@/lib/utils", "src/components/X.tsx"),
      "src/lib/utils",
      "resolves @/ to src/",
    );
    assertEq(
      resolveImportSpecifier("./shared/Reveal", "src/components/sections/Hero.tsx"),
      "src/components/sections/shared/Reveal",
      "resolves relative import",
    );
    assertEq(resolveImportSpecifier("react", "src/x.tsx"), null, "packages stay null");

    const graph = buildImportGraph(
      `import React from "react";\nimport { cn } from "@/lib/utils";\nexport { x } from "./y";\nconst z = import("./dyn");\n`,
      "src/components/A.tsx",
    );
    assert(graph.edges.length >= 3, "detects import edges");
    assert(graph.projectDeps.includes("src/lib/utils"), "lists @/ project deps");
  }

  console.log("\nvariables");
  {
    const defaults = getDefaultPackVariables();
    assert(defaults.productName, "has productName default");
    assertEq(defaults.productName, "Acme", "generic default brand");
    const merged = mergePackVariables({ productName: "Northline" });
    assertEq(merged.productName, "Northline", "override wins");
    const applied = applyPackVariables("Hello {{productName}}", merged);
    assertEq(applied, "Hello Northline", "replaces placeholders");
    const left = applyPackVariables("{{unknown}}", merged);
    assertEq(left, "{{unknown}}", "unknown placeholders kept");
  }

  console.log("\ndemo config / recipes");
  {
    const config = createDemoSectionPackConfig();
    assertEq(listSectionIds(config).length, 6, "demo has 6 sections");
    assertEq(config.sections.length, 6, "createDemoSectionPackConfig section count === 6");
    assertEq(
      DEMO_SECTION_IDS.join(","),
      "promo,header,hero,features,cta,footer",
      "demo ids order",
    );
    assert(getSectionEntry(config, "hero"), "hero entry exists");
    assertEq(config.defaultVariables.productName, "Northline", "Northline brand vars");

    const typed = defineSectionPackConfig(config);
    assertEq(typed.sections.length, 6, "defineSectionPackConfig identity");

    const okRecipe = validateRecipe(config, "landing-core");
    assert(okRecipe.ok === true, "landing-core recipe valid");
    if (okRecipe.ok) {
      assertEq(okRecipe.ids.length, 6, "landing-core has 6 ids");
    }

    const bad = validateRecipe(config, "nope");
    assert(bad.ok === false && bad.status === 404, "unknown recipe 404");

    const multiOk = validateMultiSectionIds(config, ["hero", "cta", "hero"]);
    assert(multiOk.ok === true, "multi ids valid");
    if (multiOk.ok) {
      assertEq(multiOk.ids.join(","), "hero,cta", "dedupes multi ids");
    }

    const multiBad = validateMultiSectionIds(config, ["nope"]);
    assert(multiBad.ok === false, "unknown multi id fails");

    assertEq(
      normalizeSectionIds([" a ", "a", "", "b"]).join(","),
      "a,b",
      "normalizeSectionIds",
    );
    assertEq(
      parseIdsParam("hero, cta features").join(","),
      "hero,cta,features",
      "parseIdsParam",
    );

    const recipePack = buildRecipePack(config, "conversion", { cwd: PKG_ROOT });
    assert(!("error" in recipePack), "buildRecipePack success");
    if (!("error" in recipePack)) {
      assertEq(recipePack.ids.join(","), "hero,features,cta", "recipe pack ids");
    }
  }

  console.log("\nCOPY_FORMATS");
  {
    for (const f of [
      "describe",
      "prompt",
      "prompt-short",
      "zip",
      "json",
      "cursor-rule",
      "component",
      "content",
      "css",
      "template",
    ]) {
      assert(COPY_FORMATS.includes(f), `COPY_FORMATS has ${f}`);
    }
    for (const f of ["prompt", "prompt-short", "describe", "json", "zip"]) {
      assert(MULTI_COPY_FORMATS.includes(f), `MULTI_COPY_FORMATS has ${f}`);
    }
  }

  console.log("\nbehavior briefs");
  {
    assert(DEMO_BEHAVIOR_BRIEFS.hero, "hero brief exists");
    const entry = {
      id: "hero",
      label: "Hero",
      description: "Primary hero",
      componentPath: "src/components/sections/HeroSection.tsx",
      componentExport: "HeroSection",
      contentKeys: ["hero"],
      cssSelectors: [".nl-hero"],
      cssModulePath: "src/styles/sections.css",
      tags: ["hero"],
      promptRole: "Landing hero",
    };
    const md = buildBehaviorBriefMarkdown(entry, {
      id: "hero",
      label: "Hero",
      tags: ["hero"],
      contentHash: "abc",
      fileTree: [{ path: entry.componentPath, role: "component", bytes: 10 }],
      importGraph: { entry: entry.componentPath, edges: [], projectDeps: [] },
    });
    assertIncludes(md, "Natural language", "brief title");
    assertIncludes(md, "hero", "includes section id");
    assert(md.trim().length > 0, "describe format non-empty for hero");
    assert(!/vertical slice/i.test(md), "no vertical slice string");
  }

  console.log("\nanalyzeSectionSources + draftBehaviorBrief");
  {
    const sampleCss = `
.panel { display: flex; gap: 1rem; max-width: 720px; text-align: center; }
.panel--sticky { position: sticky; top: 0; background: #0d0d0d; color: rgb(255,255,255); }
.panel { transition: transform 0.2s ease; }
@keyframes panel-in { from { opacity: 0; } to { opacity: 1; } }
.panel-anim { animation: panel-in 0.5s ease; }
:root { --panel-accent: #abc; }
.panel { color: var(--panel-accent); }
`;
    const sampleComponent = `
import { useState } from "react";
import { cn } from "@/lib/utils";
export function PromoPanel() {
  const [open, setOpen] = useState(false);
  return (
    <section className="panel" onClick={() => setOpen(!open)}>
      <button type="button" aria-expanded={open}>Toggle</button>
    </section>
  );
}
`;
    const entry = {
      id: "promo-panel",
      label: "Promo Panel",
      description: "A promotional panel with sticky chrome.",
      componentPath: "src/components/PromoPanel.tsx",
      componentExport: "PromoPanel",
      contentKeys: [],
      cssSelectors: [".panel"],
      cssModulePath: "src/styles/panel.css",
      tags: ["promo"],
      promptRole: "Surface a promo message",
    };

    const analysis = analyzeSectionSources({
      componentSource: sampleComponent,
      cssSource: sampleCss,
      entry,
    });
    assert(
      analysis.signals.layout.includes("flex"),
      "analyze detects flex from sample css",
    );
    assert(
      analysis.draft.layout?.some((l) => /flex/i.test(l)),
      "draft layout mentions flex",
    );
    assert(
      analysis.signals.motion.length > 0,
      "analyze detects motion signals",
    );
    assert(
      analysis.signals.interaction.includes("onClick") ||
        analysis.signals.interaction.includes("local-state"),
      "analyze detects interaction",
    );
    assert(
      analysis.signals.imports.some((s) => s.includes("react") || s.includes("@/lib")),
      "analyze lists imports as influence candidates",
    );
    assert(
      analysis.signals.color.includes("hex") ||
        analysis.signals.color.includes("css-vars-use"),
      "analyze detects color tokens",
    );

    // Draft fills whatItIs from label/description when missing hand brief
    const drafted = draftBehaviorBrief(entry, {
      componentSource: sampleComponent,
      cssSource: sampleCss,
    });
    assert(
      typeof drafted.brief.whatItIs === "string" &&
        drafted.brief.whatItIs.trim().length > 0,
      "draft fills whatItIs from label/description if missing",
    );
    assertIncludes(
      drafted.brief.whatItIs,
      "promotional panel",
      "whatItIs uses entry description",
    );
    assert(drafted.brief.layout.some((l) => /flex/i.test(l)), "draft layout has flex");
    assert(drafted.usedAnalysis === true, "draft used analysis for unknown id");
    // F5: drafted brief always mentions reduced-motion
    assert(
      drafted.brief.motion.some((l) =>
        /reduced[- ]?motion|prefers-reduced-motion/i.test(l),
      ) ||
        drafted.brief.a11y.some((l) =>
          /reduced[- ]?motion|prefers-reduced-motion/i.test(l),
        ),
      "drafted brief contains reduced-motion mention",
    );

    // Hand-authored fields win over auto-draft
    const handWins = draftBehaviorBrief(
      {
        ...entry,
        behavior: {
          id: "promo-panel",
          whatItIs: "Hand authored identity only.",
          function: "Hand function.",
          behavior: ["Hand behavior only."],
          motion: ["Hand motion."],
          layout: ["Hand layout, not flex mention."],
          color: ["Hand color."],
          type: ["Hand type."],
          responsive: ["Hand responsive."],
          a11y: ["Hand a11y."],
          influences: ["Hand influences."],
          rebuildGuidance: ["Hand rebuild."],
        },
      },
      { componentSource: sampleComponent, cssSource: sampleCss },
    );
    assertEq(
      handWins.brief.whatItIs,
      "Hand authored identity only.",
      "hand-authored whatItIs wins over draft",
    );
    assertEq(
      handWins.brief.layout[0],
      "Hand layout, not flex mention.",
      "hand-authored layout wins over draft",
    );

    // DEMO registry still wins for known ids when no entry.behavior
    const heroDraft = draftBehaviorBrief(
      {
        id: "hero",
        label: "Hero",
        description: "Should not replace hand registry whatItIs",
        componentPath: "x.tsx",
        componentExport: "Hero",
        contentKeys: [],
        cssSelectors: [".x"],
        cssModulePath: "x.css",
        tags: ["hero"],
        promptRole: "r",
      },
      {
        componentSource: sampleComponent,
        cssSource: sampleCss,
      },
    );
    assertEq(
      heroDraft.brief.whatItIs,
      DEMO_BEHAVIOR_BRIEFS.hero.whatItIs,
      "DEMO_BEHAVIOR_BRIEFS override auto-draft when present",
    );

    const enriched = enrichConfigWithDraftBriefs(
      {
        sections: [entry],
      },
      {},
    );
    assert(
      enriched.sections[0].behavior &&
        enriched.sections[0].behavior.whatItIs.trim().length > 0,
      "enrichConfigWithDraftBriefs fills missing behavior",
    );

    // describe still non-empty after draft (unknown section, no registry)
    const md = buildBehaviorBriefMarkdown(
      entry,
      {
        id: entry.id,
        label: entry.label,
        tags: entry.tags,
        contentHash: "draft-test",
        fileTree: [],
        importGraph: { entry: entry.componentPath, edges: [], projectDeps: [] },
      },
      { resolvedBehavior: drafted.brief },
    );
    assert(
      typeof md === "string" && md.trim().length > 0,
      "describe still non-empty after draft",
    );
    assertIncludes(md, "promo-panel", "draft describe includes section id");
    assertIncludes(md, "Flexbox", "draft describe includes flex layout note");
  }

  console.log("\nvalidateSectionPackConfig");
  {
    const config = createDemoSectionPackConfig();
    const structure = validateSectionPackConfig(config, {
      cwd: PKG_ROOT,
      checkPaths: false,
    });
    assert(structure.ok === true, "demo structure validates");
    assertEq(structure.errors.length, 0, "no structure errors");

    const missingPaths = validateSectionPackConfig(config, {
      cwd: PKG_ROOT,
      checkPaths: true,
    });
    assert(missingPaths.ok === false, "demo paths fail against package root");
    assert(
      missingPaths.errors.some((e) => e.code.startsWith("path.")),
      "reports missing path errors",
    );

    const briefOk = validateBehaviorBrief(DEMO_BEHAVIOR_BRIEFS.hero, "hero");
    assertEq(
      briefOk.filter((i) => i.level === "error").length,
      0,
      "hero behavior brief fields complete",
    );

    const briefBad = validateBehaviorBrief(
      { id: "x", whatItIs: "", function: "f", behavior: [], motion: [], layout: [], color: [], type: [], responsive: [], a11y: [], influences: [], rebuildGuidance: [] },
      "x",
    );
    assert(briefBad.some((i) => i.level === "error"), "empty brief fields fail");

    const dup = validateSectionPackConfig(
      {
        sections: [
          {
            id: "hero",
            label: "A",
            description: "d",
            componentPath: "a.tsx",
            componentExport: "A",
            contentKeys: [],
            cssSelectors: [".x"],
            cssModulePath: "a.css",
            tags: [],
            promptRole: "r",
            behavior: DEMO_BEHAVIOR_BRIEFS.hero,
          },
          {
            id: "hero",
            label: "B",
            description: "d",
            componentPath: "b.tsx",
            componentExport: "B",
            contentKeys: [],
            cssSelectors: [".x"],
            cssModulePath: "b.css",
            tags: [],
            promptRole: "r",
            behavior: DEMO_BEHAVIOR_BRIEFS.hero,
          },
        ],
      },
      { checkPaths: false, requireBehaviorBrief: false },
    );
    assert(dup.ok === false, "duplicate ids fail");
    assert(
      dup.errors.some((e) => e.code === "section.duplicate_id"),
      "duplicate id code",
    );

    const missingVersion = validateSectionPackConfig(
      {
        sections: [
          {
            id: "solo",
            label: "Solo",
            description: "d",
            componentPath: "a.tsx",
            componentExport: "A",
            contentKeys: [],
            cssSelectors: [".x"],
            cssModulePath: "a.css",
            tags: [],
            promptRole: "r",
          },
        ],
      },
      { checkPaths: false, requireBehaviorBrief: false },
    );
    assert(
      missingVersion.ok === true,
      "schemaVersion missing is ok (treated as 1)",
    );
    assert(
      !missingVersion.errors.some((e) => e.code.includes("schemaVersion")),
      "no schemaVersion error when missing",
    );

    const unsupported = validateSectionPackConfig(
      {
        schemaVersion: 99,
        sections: [
          {
            id: "solo",
            label: "Solo",
            description: "d",
            componentPath: "a.tsx",
            componentExport: "A",
            contentKeys: [],
            cssSelectors: [".x"],
            cssModulePath: "a.css",
            tags: [],
            promptRole: "r",
          },
        ],
      },
      { checkPaths: false, requireBehaviorBrief: false },
    );
    assert(unsupported.ok === false, "schemaVersion > 1 fails");
    assert(
      unsupported.errors.some((e) => e.code === "config.schemaVersion_unsupported"),
      "unsupported schemaVersion code",
    );
  }

  console.log("\nassertConfigShape / getConfigSchema");
  {
    assertEq(SUPPORTED_SCHEMA_VERSION, 1, "SUPPORTED_SCHEMA_VERSION === 1");

    const schema = getConfigSchema();
    assert(schema && typeof schema === "object", "getConfigSchema returns object");
    assertEq(schema.title, "SectionPackConfig", "schema title");
    assert(
      schema.properties && schema.properties.schemaVersion,
      "schema has schemaVersion property",
    );
    assert(
      schema.definitions && schema.definitions.SectionPackEntry,
      "schema has SectionPackEntry definition",
    );

    const shapeOk = assertConfigShape(createDemoSectionPackConfig());
    assert(shapeOk.ok === true, "demo config passes assertConfigShape");
    assertEq(shapeOk.errors.length, 0, "demo shape has no errors");

    const missingVersionShape = assertConfigShape({
      sections: [
        {
          id: "solo",
          label: "Solo",
          description: "d",
          componentPath: "a.tsx",
          componentExport: "A",
          contentKeys: [],
          cssSelectors: [".x"],
          cssModulePath: "a.css",
          tags: [],
          promptRole: "r",
        },
      ],
    });
    assert(
      missingVersionShape.ok === true,
      "assertConfigShape: schemaVersion missing ok",
    );

    const badSections = assertConfigShape({ sections: "not-an-array" });
    assert(badSections.ok === false, "assertConfigShape: invalid sections type fails");
    assert(
      badSections.errors.some((e) => e.includes("sections")),
      "assertConfigShape reports sections type error",
    );

    const badEntry = assertConfigShape({
      sections: [{ id: 123, label: "x" }],
    });
    assert(badEntry.ok === false, "assertConfigShape: invalid section field types fail");
    assert(
      badEntry.errors.some((e) => e.includes("id") || e.includes("must be a string")),
      "assertConfigShape reports section field type errors",
    );
  }

  console.log("\nbuildSectionPack (temp fixture)");
  {
    const dir = mkdtempSync(path.join(tmpdir(), "CtrlC-core-"));
    try {
      mkdirSync(path.join(dir, "src/components/sections"), { recursive: true });
      mkdirSync(path.join(dir, "src/content"), { recursive: true });
      mkdirSync(path.join(dir, "src/styles"), { recursive: true });
      mkdirSync(path.join(dir, "src/lib"), { recursive: true });

      writeFileSync(
        path.join(dir, "src/components/sections/HeroSection.tsx"),
        `import { cn } from "@/lib/utils";\nexport function HeroSection() {\n  return <section className="nl-hero btn">Hero</section>;\n}\n`,
      );
      writeFileSync(
        path.join(dir, "src/content/home.ts"),
        `export const hero = { title: "Northline" } as const;\nexport const skip = 1;\n`,
      );
      writeFileSync(
        path.join(dir, "src/styles/sections.css"),
        `:root { --x: 1; }\n.btn { color: red; }\n.nl-hero { padding: 1rem; }\n.nl-hero__title { font-size: 2rem; }\n`,
      );
      writeFileSync(
        path.join(dir, "src/lib/utils.ts"),
        `export function cn(...a) { return a.join(" "); }\n`,
      );

      const entry = {
        id: "hero",
        label: "Hero",
        description: "Primary hero",
        componentPath: "src/components/sections/HeroSection.tsx",
        componentExport: "HeroSection",
        contentKeys: ["hero"],
        contentModulePath: "src/content/home.ts",
        cssSelectors: [".nl-hero"],
        cssModulePath: "src/styles/sections.css",
        relatedPaths: ["src/lib/utils.ts"],
        tags: ["hero", "cta"],
        promptRole: "Landing hero",
      };

      const pack = buildSectionPack(entry, {
        cwd: dir,
        sharedUtilSelectors: [".btn"],
        defaultVariables: { productName: "Northline" },
      });

      assertEq(pack.id, "hero", "pack id");
      assertIncludes(pack.component, "HeroSection", "component source");
      assertIncludes(pack.content, "export const hero", "content extract");
      assert(!pack.content.includes("export const skip"), "content excludes other");
      assertIncludes(pack.css, ".nl-hero", "css extract");
      assertIncludes(pack.css, ".btn", "shared util from component scan");
      assertEq(
        pack.contentHash,
        hashPackSurfaces(pack.component, pack.content, pack.css),
        "contentHash matches surfaces",
      );
      assert(pack.fileTree.length >= 3, "fileTree has entries");
      assertIncludes(pack.promptMarkdown, "Section pack", "prompt header");
      assertIncludes(pack.promptShortMarkdown, "Section", "short prompt");
      assertIncludes(pack.behaviorBriefMarkdown, "hero", "describe present");
      assert(
        typeof pack.behaviorBriefMarkdown === "string" &&
          pack.behaviorBriefMarkdown.trim().length > 0,
        "describe format non-empty for hero pack",
      );
      assertIncludes(pack.cursorRuleMarkdown, "sectionId: hero", "cursor rule");
      assertIncludes(pack.templateSnippet, "HeroSection", "template");
      assert(
        pack.importGraph.projectDeps.includes("src/lib/utils"),
        "import graph @/ dep",
      );
      assert(pack.related["src/lib/utils.ts"], "related files loaded");

      const surfaces = [
        pack.promptMarkdown,
        pack.promptShortMarkdown,
        pack.behaviorBriefMarkdown,
        pack.cursorRuleMarkdown,
      ].join("\n");
      assert(!/vertical slice/i.test(surfaces), "no vertical slice phrasing");

      const prompt = formatPackForCopy(pack, "prompt", null, {
        defaultVariables: {
          productName: "Northline",
          tagline: "Go",
          demoHref: "/d",
          email: "e",
          primaryCta: "Book",
        },
      });
      assertIncludes(prompt, "Section pack", "formatPackForCopy prompt");

      const describeCopy = formatPackForCopy(pack, "describe");
      assert(
        typeof describeCopy === "string" && describeCopy.trim().length > 0,
        "formatPackForCopy describe non-empty for hero",
      );
      assertIncludes(describeCopy, "hero", "describe copy mentions hero");

      const json = formatPackForCopy(pack, "json");
      const parsed = JSON.parse(json);
      assertEq(parsed.id, "hero", "json format id");
      assert(parsed.contentHash, "json has contentHash");

      const zip = buildSectionZip(pack);
      assert(zip.bytes.byteLength > 50, "zip has bytes");
      assertIncludes(zip.filename, "section-hero-", "zip filename");
      assertEq(zip.rootDir, "section-hero", "zip rootDir");
      assertEq(zip.bytes[0], 0x50, "zip PK signature byte0");
      assertEq(zip.bytes[1], 0x4b, "zip PK signature byte1");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  console.log("\nmulti pack + zip");
  {
    const config = createDemoSectionPackConfig();
    const multi = buildMultiSectionPack(config, ["hero", "cta"], {
      cwd: PKG_ROOT,
      recipeId: "conversion",
      recipeLabel: "Conversion funnel",
    });
    assertEq(multi.ids.join(","), "hero,cta", "multi ids");
    assertEq(multi.packs.length, 2, "two packs");
    assert(multi.promptMarkdown.includes("Multi section pack"), "multi prompt");
    assert(multi.behaviorBriefMarkdown.includes("Section"), "multi briefs");
    assertEq(multi.recipeId, "conversion", "recipe id stamped");
    assert(typeof multi.builtAt === "string" && multi.builtAt.length > 10, "multi builtAt ISO");
    assert(typeof multi.buildMs === "number" && multi.buildMs >= 0, "multi buildMs number");
    assertEq(multi.generatedAt, multi.builtAt, "generatedAt matches builtAt");

    const batch = buildSectionPacksParallel(config, ["hero", "cta"], {
      cwd: PKG_ROOT,
    });
    assertEq(batch.length, 2, "buildSectionPacksParallel length");
    assertEq(batch[0].id, "hero", "parallel batch order hero first");

    const asyncMulti = await buildMultiSectionPackAsync(config, ["hero", "cta"], {
      cwd: PKG_ROOT,
    });
    assertEq(asyncMulti.ids.join(","), "hero,cta", "async multi ids");
    assert(typeof asyncMulti.buildMs === "number", "async multi buildMs");

    const multiFmt = formatMultiPackForCopy(
      multi,
      "prompt-short",
      { productName: "Northline" },
      { defaultVariables: config.defaultVariables },
    );
    assertIncludes(multiFmt, "Northline", "multi vars applied");

    const mzip = buildMultiSectionZip(multi);
    assert(mzip.bytes.byteLength > 50, "multi zip bytes");
    assertIncludes(mzip.filename, "multi-", "multi zip name");
  }

  console.log("\nsection dependency graph");
  {
    const config = createDemoSectionPackConfig();
    const graph = buildSectionGraph(config, { cwd: PKG_ROOT });
    assert(graph.nodes.length >= 6, `demo graph nodes >= 6 (got ${graph.nodes.length})`);
    assertEq(graph.nodes.length, 6, "demo graph has exactly 6 nodes");
    const ids = graph.nodes.map((n) => n.id);
    assert(ids.includes("hero"), "graph has hero node");
    assert(ids.includes("footer"), "graph has footer node");

    const sharedCss = graph.edges.filter((e) => e.kind === "shared-css");
    assert(sharedCss.length > 0, "shared css creates edges");
    assert(
      sharedCss.every((e) => e.detail && e.detail.includes("sections.css")),
      "shared-css edges reference css path",
    );

    const sharedContent = graph.edges.filter((e) => e.kind === "shared-content");
    assert(sharedContent.length > 0, "shared content creates edges");

    const recipeEdges = graph.edges.filter((e) => e.kind === "recipe");
    assert(recipeEdges.length > 0, "recipe membership edges present");

    assertIncludes(graph.mermaid, "graph LR", "mermaid graph LR");
    assertIncludes(graph.mermaid, "hero", "mermaid mentions hero");
    assertIncludes(graph.mermaid, "shared-css", "mermaid labels shared-css");

    const md = formatSectionGraphMarkdown(graph);
    assertIncludes(md, "Section dependency graph", "md title");
    assertIncludes(md, "```mermaid", "md mermaid fence");
    assertIncludes(md, "shared-css", "md mentions shared-css");
    assert(!/vertical slice/i.test(md), "graph md no vertical slice");

    const m2 = formatSectionGraphMermaid(graph);
    assertIncludes(m2, "graph LR", "formatSectionGraphMermaid LR");
  }

  console.log("\nzip-store primitives");
  {
    const data = new TextEncoder().encode("hi");
    const c = crc32(data);
    assert(typeof c === "number", "crc32 number");
    const z = buildStoreZip([{ path: "a.txt", data: "hello" }]);
    assert(z.byteLength > 30, "store zip size");
  }

  console.log("\npack cache");
  {
    assertEq(DEFAULT_PACK_CACHE_MAX, 64, "default max entries 64");
    const cache = new PackCache({ maxEntries: 2 });
    assertEq(cache.max, 2, "custom max");
    assertEq(cache.size, 0, "empty size");

    let builds = 0;
    const makePack = (id, hash) => {
      builds++;
      return {
        id,
        label: id,
        description: "",
        tags: [],
        promptRole: "",
        files: {},
        component: `// ${id}`,
        content: "",
        css: "",
        related: {},
        promptMarkdown: "",
        promptShortMarkdown: "",
        behaviorBriefMarkdown: "",
        cursorRuleMarkdown: "",
        templateSnippet: "",
        generatedAt: new Date().toISOString(),
        contentHash: hash,
        fileTree: [],
        byteSizes: {
          component: 0,
          content: 0,
          css: 0,
          related: 0,
          prompt: 0,
          promptShort: 0,
          totalFiles: 0,
          files: {},
        },
        importGraph: { entry: "", edges: [], projectDeps: [] },
      };
    };

    const a = getCachedSectionPack("a", () => makePack("a", "h1"), {
      cache,
      key: "k-a",
    });
    assertEq(a.id, "a", "first build returns pack");
    assertEq(builds, 1, "builder ran once");

    const a2 = getCachedSectionPack("a", () => makePack("a", "h1"), {
      cache,
      key: "k-a",
    });
    assertEq(a2, a, "second get is cache hit (same ref)");
    assertEq(builds, 1, "builder not re-run on hit");

    getCachedSectionPack("b", () => makePack("b", "h2"), {
      cache,
      key: "k-b",
    });
    getCachedSectionPack("c", () => makePack("c", "h3"), {
      cache,
      key: "k-c",
    });
    assertEq(cache.size, 2, "evicts to max entries");
    assert(!cache.has("k-a"), "oldest key evicted");
    assert(cache.has("k-c"), "newest key kept");

    cache.invalidate("k-c");
    assert(!cache.has("k-c"), "invalidate one key");
    cache.invalidate();
    assertEq(cache.size, 0, "invalidate all");

    const hashKey = packContentHashKey("hero", "abc123");
    assertEq(hashKey, "hero#abc123", "contentHash key shape");

    const config = createDemoSectionPackConfig();
    const entry = getSectionEntry(config, "hero");
    assert(entry, "hero entry exists");
    const mKey = packSourceMtimeKey(entry, PKG_ROOT);
    assert(mKey.startsWith("hero|"), "mtime key starts with id");
    assertIncludes(mKey, entry.componentPath, "mtime key includes component path");

    const noCache = getCachedSectionPack("x", () => makePack("x", "hx"), {
      cache: null,
      key: "k-x",
    });
    assertEq(noCache.id, "x", "null cache still builds");
  }

  console.log("\npack diff + snapshot");
  {
    const dir = mkdtempSync(path.join(tmpdir(), "CtrlC-diff-"));
    try {
      mkdirSync(path.join(dir, "src/components/sections"), { recursive: true });
      mkdirSync(path.join(dir, "src/content"), { recursive: true });
      mkdirSync(path.join(dir, "src/styles"), { recursive: true });

      const componentPath = "src/components/sections/HeroSection.tsx";
      const contentPath = "src/content/home.ts";
      const cssPath = "src/styles/sections.css";

      writeFileSync(
        path.join(dir, componentPath),
        `export function HeroSection() {\n  return <section className="nl-hero">Hero</section>;\n}\n`,
      );
      writeFileSync(
        path.join(dir, contentPath),
        `export const hero = { title: "Northline" } as const;\n`,
      );
      writeFileSync(
        path.join(dir, cssPath),
        `.nl-hero { padding: 1rem; }\n`,
      );

      const entry = {
        id: "hero",
        label: "Hero",
        description: "Primary hero",
        componentPath,
        componentExport: "HeroSection",
        contentKeys: ["hero"],
        contentModulePath: contentPath,
        cssSelectors: [".nl-hero"],
        cssModulePath: cssPath,
        tags: ["hero", "cta"],
        promptRole: "Landing hero",
      };

      const packA = buildSectionPack(entry, { cwd: dir });
      const packB = buildSectionPack(entry, { cwd: dir });

      const same = diffSectionPacks(packA, packB);
      assertEq(same.contentHashChanged, false, "same pack contentHash unchanged");
      assertEq(same.componentChanged, false, "same pack component unchanged");
      assertEq(same.contentChanged, false, "same pack content unchanged");
      assertEq(same.cssChanged, false, "same pack css unchanged");
      assertEq(same.fileTreeAdded.length, 0, "same pack no file adds");
      assertEq(same.fileTreeRemoved.length, 0, "same pack no file removes");
      assertIncludes(same.summary, "no changes", "same pack summary");

      const sameMd = formatPackDiffMarkdown(same);
      assertIncludes(sameMd, "SectionPack diff", "diff markdown title");
      assertIncludes(sameMd, "no changes", "diff markdown summary");

      // Mutate component source and rebuild -> componentChanged
      writeFileSync(
        path.join(dir, componentPath),
        `export function HeroSection() {\n  return <section className="nl-hero">Hero mutated</section>;\n}\n`,
      );
      const packMut = buildSectionPack(entry, { cwd: dir });
      const mut = diffSectionPacks(packA, packMut);
      assertEq(mut.componentChanged, true, "mutated component string -> componentChanged");
      assertEq(mut.contentHashChanged, true, "mutated component -> contentHashChanged");
      assertEq(mut.contentChanged, false, "content surface still same");
      assertEq(mut.cssChanged, false, "css surface still same");
      assertIncludes(mut.summary, "component", "mut summary mentions component");

      const mutMd = formatPackDiffMarkdown(mut);
      assertIncludes(mutMd, "| component | yes |", "diff md marks component changed");

      // Snapshot
      const snap = snapshotSectionPack(packA);
      assertEq(snap.id, "hero", "snapshot id");
      assert(typeof snap.contentHash === "string" && snap.contentHash.length === 64, "snapshot has contentHash");
      assertEq(snap.contentHash, packA.contentHash, "snapshot contentHash matches pack");
      assert(Array.isArray(snap.tags), "snapshot tags array");
      assert(typeof snap.generatedAt === "string", "snapshot generatedAt");
      assert(typeof snap.byteSizes.totalFiles === "number", "snapshot byteSizes");
      // JSON serializable
      const snapJson = JSON.stringify(snap);
      const snapParsed = JSON.parse(snapJson);
      assertEq(snapParsed.contentHash, snap.contentHash, "snapshot JSON round-trip");

      // compareSectionSources: no baseline -> unchanged report
      const baseCmp = compareSectionSources(entry, { cwd: dir });
      assertEq(baseCmp.id, "hero", "compare id");
      assertEq(baseCmp.changed, false, "no baseline -> changed false");
      assertEq(baseCmp.hashChanged, false, "no previousHash -> hashChanged false");
      assertEq(baseCmp.contentHash, packMut.contentHash, "compare hash matches rebuilt pack");

      const matchCmp = compareSectionSources(entry, {
        cwd: dir,
        previousHash: packMut.contentHash,
      });
      assertEq(matchCmp.changed, false, "matching previousHash -> unchanged");
      assertEq(matchCmp.hashChanged, false, "matching previousHash -> hashChanged false");

      const driftCmp = compareSectionSources(entry, {
        cwd: dir,
        previousHash: packA.contentHash,
      });
      assertEq(driftCmp.changed, true, "stale previousHash -> changed");
      assertEq(driftCmp.hashChanged, true, "stale previousHash -> hashChanged");
      assertIncludes(driftCmp.summary, "contentHash", "drift summary");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // --- Page IR → section specs ---
  {
    console.log("\nir-to-specs");
    const {
      writeSectionSpecsFromIR,
      writeTopologyFromIR,
      behaviorFromIRSection,
      listIrSections,
      pascalFromId,
      camelFromId,
      DEFAULT_BREAKPOINTS,
      defaultResponsiveRows,
      ensureResponsiveMatrix,
    } = core;

    assertEq(pascalFromId("hero-banner"), "HeroBanner", "pascalFromId hero-banner");
    assertEq(camelFromId("hero-banner"), "heroBanner", "camelFromId hero-banner");

    // F4: breakpoint constants + helpers
    assert(
      Array.isArray(DEFAULT_BREAKPOINTS) && DEFAULT_BREAKPOINTS.length === 3,
      "DEFAULT_BREAKPOINTS has 3 entries",
    );
    assertEq(
      DEFAULT_BREAKPOINTS.join(","),
      "390,768,1440",
      "DEFAULT_BREAKPOINTS are 390 / 768 / 1440",
    );
    const defaultRows = defaultResponsiveRows();
    assertEq(defaultRows.length, 3, "defaultResponsiveRows length 3");
    assertEq(String(defaultRows[0].breakpoint), "390", "default row 390");
    const filled = ensureResponsiveMatrix([{ breakpoint: 768, changes: "stack" }]);
    assertEq(filled.length, 3, "ensureResponsiveMatrix fills missing breakpoints");
    assert(
      filled.some((r) => String(r.breakpoint) === "390"),
      "ensureResponsiveMatrix injects 390",
    );
    assert(
      filled.some((r) => String(r.breakpoint) === "768" && r.changes === "stack"),
      "ensureResponsiveMatrix keeps existing 768 notes",
    );

    const ir = {
      schemaVersion: 1,
      sourceUrl: "https://example.com/",
      capturedAt: new Date().toISOString(),
      viewport: { width: 1440, height: 900 },
      sections: [
        {
          id: "hero",
          label: "Hero",
          interactionModel: "scroll",
          textSample: "Ship faster with React sections",
          styles: { background: "#0a0a0a", color: "#fff" },
          childrenHints: ["h1", "p", "a"],
        },
        {
          id: "cta",
          label: "CTA",
          interactionModel: "click",
          textSample: "Get started",
        },
      ],
      tokens: { colors: ["#0a0a0a"], fonts: ["Inter"] },
      assets: [{ url: "https://example.com/a.png", kind: "image", localPath: "public/images/a.png" }],
    };

    assertEq(listIrSections(ir).length, 2, "listIrSections count");

    const brief = behaviorFromIRSection(ir.sections[0]);
    assertEq(brief.id, "hero", "behaviorFromIRSection id");
    assert(
      brief.rebuildGuidance.some((l) => /React/i.test(l)),
      "rebuild guidance mentions React",
    );
    assert(
      brief.behavior.some((l) => /INTERACTION MODEL:\s*scroll/i.test(l)),
      "behavior notes include interaction model",
    );
    // F5: IR-derived scroll brief includes reduced-motion guidance
    assert(
      brief.motion.some((l) =>
        /reduced[- ]?motion|prefers-reduced-motion/i.test(l),
      ) ||
        brief.a11y.some((l) =>
          /reduced[- ]?motion|prefers-reduced-motion/i.test(l),
        ),
      "IR scroll brief contains reduced-motion guidance",
    );

    const dir = mkdtempSync(path.join(tmpdir(), "CtrlC-ir-specs-"));
    try {
      const outDir = path.join(dir, "docs", "research", "components");
      const result = writeSectionSpecsFromIR(ir, outDir);
      assertEq(result.written.length, 2, "wrote 2 specs");
      const heroPath = path.join(outDir, "hero.spec.md");
      assert(existsSync(heroPath), "hero.spec.md exists");
      const md = readFileSync(heroPath, "utf8");
      assertIncludes(md, "hero", "spec includes id");
      assertIncludes(md, "scroll", "spec includes interaction model");
      assertIncludes(md, "Ship faster", "spec includes text sample");
      assertIncludes(md, "React component only", "spec rebuild guidance");
      assertIncludes(md, "SectionPack", "spec mentions SectionPack");
      assertIncludes(md, "src/components/sections/Hero.tsx", "registration path");
      // F4: written spec always includes breakpoint matrix 390 / 768 / 1440
      assertIncludes(md, "390", "written spec includes 390 breakpoint");
      assertIncludes(md, "768", "written spec includes 768 breakpoint");
      assertIncludes(md, "1440", "written spec includes 1440 breakpoint");
      assert(
        /\|\s*390\s*\|/.test(md) &&
          /\|\s*768\s*\|/.test(md) &&
          /\|\s*1440\s*\|/.test(md),
        "written spec responsive table has 390 / 768 / 1440 rows",
      );

      const topoPath = path.join(dir, "docs", "research", "PAGE_TOPOLOGY.md");
      const topo = writeTopologyFromIR(ir, { topologyPath: topoPath });
      assertEq(topo.sectionCount, 2, "topology section count");
      assert(existsSync(topoPath), "PAGE_TOPOLOGY.md exists");
      const topoMd = readFileSync(topoPath, "utf8");
      assertIncludes(topoMd, "| 1 | hero | scroll |", "topology table hero");
      assertIncludes(topoMd, "| 2 | cta | click |", "topology table cta");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // --- B5 tokens-from-ir / D10 registry / D11 recipes ---
  {
    console.log("\ntokens-from-ir + ir-to-registry + recipe-from-ir");
    const {
      extractTokensFromIR,
      writeTokensFromIR,
      registryFromIR,
      writeRegistryFromIR,
      sectionEntryFromIRSection,
      inferRecipesFromIR,
    } = core;

    assert(typeof extractTokensFromIR === "function", "extractTokensFromIR export");
    assert(typeof writeTokensFromIR === "function", "writeTokensFromIR export");
    assert(typeof registryFromIR === "function", "registryFromIR export");
    assert(typeof writeRegistryFromIR === "function", "writeRegistryFromIR export");
    assert(typeof inferRecipesFromIR === "function", "inferRecipesFromIR export");

    const fixtureIR = {
      schemaVersion: 1,
      sourceUrl: "https://example.com/landing",
      sections: [
        {
          id: "hero",
          label: "Hero",
          interactionModel: "scroll",
          selector: ".hero",
          textSample: "Ship faster with React sections",
          styles: {
            background: "#0a0a0a",
            color: "#ffffff",
            "font-family": "Inter, system-ui, sans-serif",
          },
        },
        {
          id: "features",
          label: "Features",
          interactionModel: "static",
          textSample: "Feature grid",
          styles: [
            { element: "root", property: "background-color", value: "#111111" },
            { element: "title", property: "color", value: "rgb(255, 255, 255)" },
          ],
        },
        {
          id: "cta",
          label: "CTA",
          interactionModel: "click",
          textSample: "Get started today",
        },
        {
          id: "footer",
          label: "Footer",
          interactionModel: "static",
        },
      ],
      tokens: {
        colors: ["#0a0a0a", "#3b82f6"],
        fonts: ["Inter"],
        cssVariables: {
          "--color-bg": "#0a0a0a",
          "--color-accent": "#3b82f6",
          "--font-sans": "Inter",
        },
      },
    };

    const tokens = extractTokensFromIR(fixtureIR);
    assert(tokens.colors.length >= 2, "extractTokensFromIR colors >= 2");
    assert(
      tokens.colors.some((c) => /#0a0a0a/i.test(c)),
      "includes IR token color #0a0a0a",
    );
    assert(
      tokens.colors.some((c) => /#3b82f6/i.test(c)),
      "includes IR token color #3b82f6",
    );
    assert(
      tokens.fonts.some((f) => /Inter/i.test(f)),
      "includes Inter font",
    );
    assert(
      tokens.cssVariables["--color-bg"] === "#0a0a0a",
      "preserves cssVariables keys from IR",
    );
    assertIncludes(tokens.css, ":root", "css has :root");
    assertIncludes(tokens.css, "--color-bg", "css has --color-bg");
    // B5b semantic curation (--ts-* roles)
    assert(tokens.semantic && typeof tokens.semantic === "object", "semantic roles object");
    assert(!!tokens.semantic.bg, "semantic.bg set");
    assert(!!tokens.semantic.accent, "semantic.accent set");
    assert(!!tokens.semantic.ink, "semantic.ink set");
    assertIncludes(tokens.css, "--ts-bg", "css has --ts-bg");
    assertIncludes(tokens.css, "--ts-accent", "css has --ts-accent");
    assertIncludes(tokens.css, "--ts-ink", "css has --ts-ink");
    assertIncludes(tokens.css, "--ts-font", "css has --ts-font");
    assert(
      tokens.cssVariables["--ts-bg"] != null,
      "cssVariables includes --ts-bg",
    );
    assert(
      tokens.cssVariables["--color-accent"] === "#3b82f6",
      "preserves IR --color-accent",
    );
    // IR --color-accent should seed accent role when name matches
    assert(
      /#3b82f6/i.test(tokens.semantic.accent) ||
        /#3b82f6/i.test(tokens.cssVariables["--ts-accent"] || ""),
      "accent role uses brand blue from IR",
    );
    assert(
      tokens.theme === "dark" || tokens.theme === "light" || tokens.theme === "unknown",
      "theme detected",
    );
    assertIncludes(
      tokens.designTokensMarkdown,
      "Design tokens",
      "markdown title",
    );
    assertIncludes(
      tokens.designTokensMarkdown,
      "Semantic roles",
      "markdown semantic section",
    );
    assertIncludes(
      tokens.designTokensMarkdown,
      "| Variable | Value |",
      "markdown CSS vars table",
    );

    // Dedup: same color from tokens + section styles
    const colorsLower = tokens.colors.map((c) => c.toLowerCase());
    assertEq(
      colorsLower.filter((c) => c === "#0a0a0a").length,
      1,
      "dedupes #0a0a0a",
    );

    // Top-N cap
    const manyColors = {
      tokens: {
        colors: Array.from({ length: 30 }, (_, i) => `#${String(i).padStart(6, "0")}`),
        fonts: ["Inter", "Roboto", "Georgia", "Menlo", "Arial", "Courier New"],
      },
    };
    const capped = extractTokensFromIR(manyColors, { maxColors: 5, maxFonts: 3 });
    assertEq(capped.colors.length, 5, "maxColors caps palette");
    assertEq(capped.fonts.length, 3, "maxFonts caps fonts");
    assertIncludes(capped.css, "--ts-bg", "capped still has semantic --ts-bg");

    // Custom prefix
    const pref = extractTokensFromIR(fixtureIR, { prefix: "brand" });
    assertIncludes(pref.css, "--brand-bg", "custom prefix --brand-bg");
    assert(pref.cssVariables["--brand-accent"] != null, "custom prefix accent");

    const reg = registryFromIR(fixtureIR);
    assertEq(reg.sections.length, 4, "registryFromIR 4 sections");
    assert(Array.isArray(reg.recipes) && reg.recipes.length >= 1, "has recipes");
    const landingCore = reg.recipes.find((r) => r.id === "landing-core");
    assert(!!landingCore, "landing-core recipe present");
    assertEq(
      landingCore.sectionIds.join(","),
      "hero,features,cta,footer",
      "landing-core ordered section ids",
    );
    assertIncludes(
      landingCore.description.toLowerCase(),
      "cta",
      "landing-core mentions cta",
    );
    assertIncludes(
      landingCore.description.toLowerCase(),
      "footer",
      "landing-core mentions footer",
    );

    const heroEntry = reg.sections.find((s) => s.id === "hero");
    assert(!!heroEntry, "hero entry");
    assertEq(
      heroEntry.componentPath,
      "src/components/sections/Hero.tsx",
      "hero componentPath",
    );
    assertEq(heroEntry.componentExport, "Hero", "hero export");
    assertEq(heroEntry.contentKeys[0], "hero", "hero contentKeys");
    assert(
      heroEntry.cssSelectors.includes(".hero"),
      "hero cssSelectors includes .hero",
    );
    assert(
      heroEntry.tags.includes("scroll") && heroEntry.tags.includes("from-ir"),
      "hero tags from-ir + interaction",
    );
    assert(
      /scroll/i.test(heroEntry.promptRole),
      "hero promptRole from interaction model",
    );
    assert(!!heroEntry.behavior, "hero has behavior brief");
    assertEq(
      heroEntry.cssModulePath,
      "src/styles/clone.css",
      "default css path clone.css",
    );

    const single = sectionEntryFromIRSection(fixtureIR.sections[2], {
      cssPath: "src/styles/app.css",
    });
    assertEq(single.id, "cta", "sectionEntryFromIRSection id");
    assertEq(single.cssModulePath, "src/styles/app.css", "custom css path");

    // landing-full only when > 6 sections
    const manySections = {
      sections: Array.from({ length: 7 }, (_, i) => ({
        id: `sec-${i + 1}`,
        label: `Sec ${i + 1}`,
        interactionModel: "static",
      })),
    };
    const manyRecipes = inferRecipesFromIR(manySections);
    assert(
      manyRecipes.some((r) => r.id === "landing-core"),
      "many: landing-core",
    );
    assert(
      manyRecipes.some((r) => r.id === "landing-full"),
      "many: landing-full when > 6",
    );
    assertEq(
      inferRecipesFromIR(fixtureIR).filter((r) => r.id === "landing-full")
        .length,
      0,
      "no landing-full for 4 sections",
    );

    const dir = mkdtempSync(path.join(tmpdir(), "CtrlC-tokens-reg-"));
    try {
      const written = writeTokensFromIR(fixtureIR, {
        outDir: dir,
        cssFileName: "tokens.css",
        mdFileName: "DESIGN_TOKENS.md",
      });
      assert(existsSync(written.cssPath), "tokens.css written");
      assert(existsSync(written.mdPath), "DESIGN_TOKENS.md written");
      const cssBody = readFileSync(written.cssPath, "utf8");
      assertIncludes(cssBody, ":root", "written css :root");
      assertIncludes(cssBody, "--color-accent", "written css accent var");

      const regPath = path.join(dir, ".ctrlc", "registry.json");
      const wr = writeRegistryFromIR(fixtureIR, {
        outPath: regPath,
        merge: false,
      });
      assert(existsSync(wr.path), "registry.json written");
      assertEq(wr.sectionIds.length, 4, "writeRegistry sectionIds");
      const disk = JSON.parse(readFileSync(wr.path, "utf8"));
      assertEq(disk.sections.length, 4, "disk registry sections");
      assert(
        disk.recipes.some((r) => r.id === "landing-core"),
        "disk has landing-core",
      );

      // merge keeps pre-existing unrelated section
      const existing = {
        schemaVersion: 1,
        sections: [
          {
            id: "legacy",
            label: "Legacy",
            description: "kept",
            componentPath: "src/components/sections/Legacy.tsx",
            componentExport: "Legacy",
            contentKeys: ["legacy"],
            contentModulePath: "src/content/home.ts",
            cssModulePath: "src/styles/clone.css",
            cssSelectors: [".legacy"],
            tags: ["legacy"],
            promptRole: "Legacy section",
          },
        ],
        recipes: [],
      };
      writeFileSync(regPath, JSON.stringify(existing, null, 2), "utf8");
      const merged = writeRegistryFromIR(fixtureIR, {
        outPath: regPath,
        merge: true,
      });
      assert(
        merged.sectionIds.includes("legacy"),
        "merge keeps legacy section",
      );
      assert(merged.sectionIds.includes("hero"), "merge adds hero");
      assertEq(
        merged.registry.sections.length,
        5,
        "merge 5 sections total",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // --- B6 external capture adapter ---
  {
    console.log("\nexternal-ir-adapter (B6)");
    const {
      adaptExternalCaptureToPageIR,
      loadExternalCapture,
      writeAdaptedIr,
      normalizeSectionId,
    } = core;

    assert(
      typeof adaptExternalCaptureToPageIR === "function",
      "adaptExternalCaptureToPageIR export",
    );
    assert(typeof loadExternalCapture === "function", "loadExternalCapture export");
    assert(typeof writeAdaptedIr === "function", "writeAdaptedIr export");
    assert(typeof normalizeSectionId === "function", "normalizeSectionId export");

    assertEq(
      normalizeSectionId("HeroBanner"),
      "hero-banner",
      "normalizeSectionId PascalCase",
    );
    assertEq(
      normalizeSectionId("hero_banner"),
      "hero-banner",
      "normalizeSectionId snake",
    );

    const fixturePath = path.join(
      PKG_ROOT,
      "fixtures",
      "external-capture-sample.json",
    );
    assert(existsSync(fixturePath), "external-capture-sample.json fixture exists");

    const raw = loadExternalCapture(fixturePath);
    const ir = adaptExternalCaptureToPageIR(raw, {
      capturedAt: "2026-07-31T00:00:00.000Z",
    });

    assertEq(ir.schemaVersion, 1, "adapted schemaVersion === 1");
    assert(
      Array.isArray(ir.sections) && ir.sections.length >= 5,
      "adapted sections length >= 5",
    );
    assertEq(ir.sections.length, 5, "sample has 5 sections");
    const ids = ir.sections.map((s) => s.id);
    assert(ids.includes("hero"), "adapted id hero");
    assert(ids.includes("features"), "adapted id features");
    assert(ids.includes("call-to-action"), "adapted id call-to-action");
    assert(ids.includes("site-header"), "adapted id site-header");
    assert(
      ir.sections.every((s) => typeof s.id === "string" && s.id.length > 0),
      "all section ids non-empty",
    );
    assert(
      ir.sections.every(
        (s) =>
          s.interactionModel === "static" ||
          s.interactionModel === "click" ||
          s.interactionModel === "scroll" ||
          s.interactionModel === "hover" ||
          s.interactionModel === "time" ||
          s.interactionModel === "hybrid",
      ),
      "interaction models valid",
    );
    const features = ir.sections.find((s) => s.id === "features");
    assertEq(
      features?.interactionModel,
      "static",
      "features interaction from loose 'interaction' field",
    );
    assertEq(ir.sourceUrl, "https://example.com/landing", "sourceUrl from fixture");
    assert(
      Array.isArray(ir.notes) &&
        ir.notes.some((n) => /adaptedFrom:\s*external-capture/i.test(n)),
      "notes include adaptedFrom: external-capture",
    );
    assert(
      Array.isArray(ir.tokens?.colors) && ir.tokens.colors.length >= 2,
      "tokens.colors present",
    );
    assert(
      Array.isArray(ir.assets) && ir.assets.length >= 1,
      "assets adapted (explicit + fileMap images)",
    );

    // fileMap-only invent path
    const fromMap = adaptExternalCaptureToPageIR({
      sourceUrl: "https://example.com/map-only",
      fileMap: {
        "components/sections/Hero.tsx": "export function Hero(){}",
        "components/sections/Pricing.tsx": "export function Pricing(){}",
        "components/shared/Button.tsx": "export function Button(){}",
        "public/images/banner.png": "binary",
      },
    });
    assert(
      fromMap.sections.length >= 2,
      "fileMap invents sections from components/sections/*",
    );
    const mapIds = fromMap.sections.map((s) => s.id);
    assert(mapIds.includes("hero"), "fileMap invents hero");
    assert(mapIds.includes("pricing"), "fileMap invents pricing");
    assert(
      !mapIds.includes("button"),
      "fileMap skips shared/ noise",
    );
    assert(
      fromMap.assets.some((a) => a.kind === "image"),
      "fileMap image path becomes asset",
    );

    const dir = mkdtempSync(path.join(tmpdir(), "CtrlC-adapt-ir-"));
    try {
      const outPath = path.join(dir, "adapted", "ir.json");
      const written = writeAdaptedIr(fixturePath, outPath, {
        sourceUrl: "https://override.example/",
        capturedAt: "2026-07-31T12:00:00.000Z",
      });
      assert(existsSync(written.path), "writeAdaptedIr writes file");
      assertEq(written.ir.sourceUrl, "https://override.example/", "writeAdaptedIr source override");
      const disk = JSON.parse(readFileSync(written.path, "utf8"));
      assertEq(disk.schemaVersion, 1, "disk schemaVersion");
      assertEq(disk.sections.length, 5, "disk sections length");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  console.log("\ncheckSpecBudget");
  {
    const { checkSpecBudget } = core;
    assert(typeof checkSpecBudget === "function", "checkSpecBudget exported");

    const short = checkSpecBudget("# Hero\n\nShort spec.\n");
    assert(short.ok === true, "short spec ok");
    assert(short.warnings.length === 0, "short spec no warnings");
    assert(short.lines >= 2, "short spec counts lines");
    assert(short.chars > 0, "short spec counts chars");

    const empty = checkSpecBudget("");
    assert(empty.ok === true, "empty markdown ok");
    assertEq(empty.lines, 0, "empty has 0 lines");
    assertEq(empty.chars, 0, "empty has 0 chars");

    const manyLines = Array.from({ length: 401 }, (_, i) => `line ${i}`).join("\n");
    const overLines = checkSpecBudget(manyLines);
    assert(overLines.ok === false, "401 lines fails budget");
    assert(
      overLines.warnings.some((w) => w.code === "max-lines"),
      "max-lines warning present",
    );
    assert(overLines.lines === 401, "reports 401 lines");

    const big = "x".repeat(40_001);
    const overChars = checkSpecBudget(big, { maxLines: 10_000 });
    assert(overChars.ok === false, "40001 chars fails budget");
    assert(
      overChars.warnings.some((w) => w.code === "max-chars"),
      "max-chars warning present",
    );

    const custom = checkSpecBudget("a\nb\nc\n", { maxLines: 2, maxChars: 100 });
    assert(custom.ok === false, "custom maxLines=2 fails on 4 lines");
    assert(
      custom.warnings.some((w) => w.code === "max-lines" && w.limit === 2),
      "custom limit reflected in warning",
    );
  }

  // --- C5 parallel plan from specs ---
  console.log("\nbuildParallelPlan");
  {
    const {
      buildParallelPlan,
      formatParallelPlan,
      formatParallelPlanMarkdown,
      formatParallelPlanShell,
      extractSpecId,
      batchSectionIds,
      pascalFromId,
    } = core;

    assert(typeof buildParallelPlan === "function", "buildParallelPlan exported");
    assert(typeof formatParallelPlan === "function", "formatParallelPlan exported");
    assertEq(pascalFromId("how-it-works"), "HowItWorks", "pascalFromId how-it-works");

    assertEq(
      extractSpecId("/tmp/hero.spec.md", ""),
      "hero",
      "extractSpecId from filename",
    );
    assertEq(
      extractSpecId(
        "/tmp/Section Spec Draft.md",
        "| **id** | `cta-banner` |\n",
      ),
      "cta-banner",
      "extractSpecId from Meta table when filename is not an id",
    );

    const batches2 = batchSectionIds(["a", "b", "c", "d", "e"], 2);
    assertEq(batches2.length, 3, "batchSectionIds 5 ids / 2 -> 3 batches");
    assertEq(batches2[0].join(","), "a,b", "first batch a,b");
    assertEq(batches2[2].join(","), "e", "last batch e");

    const dir = mkdtempSync(path.join(tmpdir(), "CtrlC-parallel-plan-"));
    try {
      const specsDir = path.join(dir, "docs", "research", "components");
      mkdirSync(specsDir, { recursive: true });

      const fakeSpec = (id, label) =>
        [
          `# Section spec: \`${id}\``,
          ``,
          `## Meta`,
          ``,
          `| Field | Value |`,
          `|-------|--------|`,
          `| **id** | \`${id}\` |`,
          `| **label** | ${label} |`,
          `| **INTERACTION MODEL** | static |`,
          ``,
        ].join("\n");

      writeFileSync(path.join(specsDir, "hero.spec.md"), fakeSpec("hero", "Hero"), "utf8");
      writeFileSync(
        path.join(specsDir, "features.spec.md"),
        fakeSpec("features", "Features"),
        "utf8",
      );
      writeFileSync(
        path.join(specsDir, "site-header.spec.md"),
        fakeSpec("site-header", "Header"),
        "utf8",
      );

      const plan = buildParallelPlan({
        specsDir,
        cwd: dir,
        maxAgents: 2,
      });

      assertEq(plan.sections.length, 3, "plan has 3 sections");
      assertEq(plan.maxAgents, 2, "maxAgents 2");
      assert(plan.batches.length >= 2, "at least 2 batches with maxAgents 2");
      assert(
        plan.batches.every((b) => b.length <= 2),
        "each batch length <= maxAgents",
      );

      const ids = plan.sections.map((s) => s.id);
      assert(ids.includes("hero"), "includes hero");
      assert(ids.includes("features"), "includes features");
      assert(ids.includes("site-header"), "includes site-header");
      // chrome-like first
      assertEq(ids[0], "site-header", "site-header sorted before body");

      const hero = plan.sections.find((s) => s.id === "hero");
      assert(hero, "hero section present");
      assertEq(hero.exportName, "Hero", "hero exportName");
      assertEq(
        hero.componentPath,
        "src/components/sections/Hero.tsx",
        "hero componentPath",
      );
      assertIncludes(hero.specPath, "hero.spec.md", "hero specPath");
      assertIncludes(
        hero.promptPathHint,
        "section-builder.prompt.md",
        "promptPathHint",
      );

      const flatBatchIds = plan.batches.flat();
      assertEq(flatBatchIds.length, 3, "batches cover all sections");
      assert(
        ["hero", "features", "site-header"].every((id) => flatBatchIds.includes(id)),
        "all ids appear in batches",
      );

      const md = formatParallelPlanMarkdown(plan);
      assertIncludes(md, "Parallel section build plan", "md title");
      assertIncludes(md, "hero", "md lists hero");
      assertIncludes(md, "Batch 1", "md has batches");

      const sh = formatParallelPlanShell(plan);
      assertIncludes(sh, "git worktree add", "sh documents optional worktree");
      assertIncludes(sh, "Build section: hero", "sh echoes hero");

      const jsonText = formatParallelPlan(plan, "json");
      const parsed = JSON.parse(jsonText);
      assertEq(parsed.sectionCount, 3, "json sectionCount");
      assertEq(parsed.sections.length, 3, "json sections length");
      assert(Array.isArray(parsed.batches), "json batches array");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  console.log("\nvisual-diff (F3, optional peers)");
  {
    const {
      comparePngFiles,
      compareRgbaBuffers,
      tryLoadVisualDiffLibs,
      VISUAL_DIFF_INSTALL_HINT,
    } = core;

    assert(typeof comparePngFiles === "function", "comparePngFiles exported");
    assert(
      typeof compareRgbaBuffers === "function",
      "compareRgbaBuffers exported",
    );
    assert(
      typeof tryLoadVisualDiffLibs === "function",
      "tryLoadVisualDiffLibs exported",
    );
    assert(
      typeof VISUAL_DIFF_INSTALL_HINT === "string" &&
        VISUAL_DIFF_INSTALL_HINT.includes("pngjs"),
      "VISUAL_DIFF_INSTALL_HINT mentions pngjs",
    );

    const dir = mkdtempSync(path.join(tmpdir(), "CtrlC-vdiff-"));
    try {
      const missingA = path.join(dir, "no-a.png");
      const missingB = path.join(dir, "no-b.png");
      const missingResult = await comparePngFiles(missingA, missingB);

      assert(typeof missingResult.ok === "boolean", "result has ok");
      assert(typeof missingResult.message === "string", "result has message");
      assert(
        typeof missingResult.diffRatio === "number",
        "result has diffRatio",
      );
      assert(
        typeof missingResult.diffPixels === "number",
        "result has diffPixels",
      );
      assert(
        typeof missingResult.totalPixels === "number",
        "result has totalPixels",
      );

      if (missingResult.missingDeps) {
        assert(missingResult.ok === false, "missing deps => ok false");
        assert(
          missingResult.message.includes("pngjs") ||
            missingResult.message.includes("pixelmatch") ||
            missingResult.message.includes(VISUAL_DIFF_INSTALL_HINT),
          "missing deps message has install hint",
        );
        console.log(
          "  (optional peers not installed; graceful path exercised)",
        );
      } else {
        // Peers present: missing files should fail without missingDeps
        assert(missingResult.ok === false, "missing files => ok false");
        assert(
          missingResult.missingDeps !== true,
          "file missing is not missingDeps",
        );
        assert(
          /not found/i.test(missingResult.message),
          "missing file message",
        );

        // Synthetic RGBA compare (no network)
        const w = 2;
        const h = 2;
        const solid = (r, g, b, a = 255) => {
          const buf = Buffer.alloc(w * h * 4);
          for (let i = 0; i < w * h; i++) {
            const o = i * 4;
            buf[o] = r;
            buf[o + 1] = g;
            buf[o + 2] = b;
            buf[o + 3] = a;
          }
          return buf;
        };
        const red = solid(255, 0, 0);
        const red2 = solid(255, 0, 0);
        const blue = solid(0, 0, 255);

        const same = await compareRgbaBuffers(red, red2, w, h, {
          maxDiffRatio: 0.01,
        });
        assert(same.ok === true, "identical RGBA buffers match");
        assertEq(same.diffPixels, 0, "identical: 0 diff pixels");
        assertEq(same.totalPixels, 4, "2x2 total pixels");

        const different = await compareRgbaBuffers(red, blue, w, h, {
          maxDiffRatio: 0.01,
          threshold: 0.1,
        });
        assert(different.ok === false, "red vs blue exceeds max-ratio");
        assert(different.diffPixels > 0, "red vs blue has diff pixels");
        assert(different.diffRatio > 0.01, "diff ratio > 0.01");

        // File API + outDiffPath when pngjs is available
        const loaded = await tryLoadVisualDiffLibs();
        if (loaded.ok) {
          const { PNG } = loaded.libs;
          const writeSolidPng = (filePath, r, g, b) => {
            const png = new PNG({ width: w, height: h });
            for (let i = 0; i < w * h; i++) {
              const o = i * 4;
              png.data[o] = r;
              png.data[o + 1] = g;
              png.data[o + 2] = b;
              png.data[o + 3] = 255;
            }
            writeFileSync(filePath, PNG.sync.write(png));
          };
          const aPng = path.join(dir, "a.png");
          const bPng = path.join(dir, "b.png");
          const cPng = path.join(dir, "c.png");
          const diffOut = path.join(dir, "diff.png");
          writeSolidPng(aPng, 10, 20, 30);
          writeSolidPng(bPng, 10, 20, 30);
          writeSolidPng(cPng, 200, 10, 10);

          const matchFiles = await comparePngFiles(aPng, bPng, {
            maxDiffRatio: 0.01,
          });
          assert(matchFiles.ok === true, "identical PNG files match");

          const mismatch = await comparePngFiles(aPng, cPng, {
            maxDiffRatio: 0.01,
            outDiffPath: diffOut,
          });
          assert(mismatch.ok === false, "different PNG files fail budget");
          assert(existsSync(diffOut), "writes outDiffPath");
          assert(
            typeof mismatch.diffPath === "string" &&
              mismatch.diffPath.length > 0,
            "diffPath set when outDiffPath given",
          );
        }
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  console.log("\n---");
  console.log(`passed: ${passed}`);
  console.log(`failed: ${failed}`);
  if (failed) process.exit(1);
  console.log("all good");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
