/**
 * Unit tests for vertical-slice pack builder (no test framework).
 *
 * Imports TypeScript sources via Node strip-types (Node >= 22 / engines >= 24).
 *
 * Usage:
 *   npm run test:slices
 *   node --experimental-strip-types scripts/test-slice-pack.mjs
 *
 * Exit 0 on success, 1 on failure.
 */

import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

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

function assertMatch(hay, re, msg) {
  assert(typeof hay === "string" && re.test(hay), msg);
}

async function loadPackModule() {
  const rel = "src/lib/vertical-slice/build-slice-pack.ts";
  const abs = path.join(ROOT, rel);
  // Strip-types resolves .ts; ensure cwd is project root for safeRead paths
  process.chdir(ROOT);
  return import(pathToFileURL(abs).href);
}

async function loadManifestModule() {
  const abs = path.join(ROOT, "src/lib/vertical-slice/slice-manifest.ts");
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
  console.log("test-slice-pack: loading modules...\n");

  let packMod;
  let manifestMod;
  try {
    packMod = await loadPackModule();
    manifestMod = await loadManifestModule();
  } catch (e) {
    console.error("Failed to import pack modules.");
    console.error(
      "Requires Node >= 22 with --experimental-strip-types (engines: >=24).",
    );
    console.error(e);
    process.exit(1);
  }

  const {
    extractContentKeys,
    extractCssBySelectors,
    parseCssBlocks,
    hashSliceSurfaces,
    buildSlicePack,
    formatSliceForCopy,
    COPY_FORMATS,
    resolveImportSpecifier,
    buildImportGraph,
  } = packMod;

  const { getSliceEntry, listSliceIds } = manifestMod;

  // -------------------------------------------------------------------------
  console.log("extractContentKeys");
  // -------------------------------------------------------------------------
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
    assert(!out.includes('export const other'), "excludes other export");

    const missing = extractContentKeys(src, ["nope"]);
    assertIncludes(missing, "missing export: nope", "notes missing key");

    const empty = extractContentKeys(src, []);
    assertIncludes(empty, "no content keys", "empty keys message");
  }

  // -------------------------------------------------------------------------
  console.log("\nextractCssBySelectors / parseCssBlocks");
  // -------------------------------------------------------------------------
  {
    const css = `
:root { --fuel-green: #0f0; }
.fuel-btn { color: red; }
.fuel-btn--primary { color: blue; }
.fuel-hero { padding: 1rem; }
.fuel-hero__title { font-size: 2rem; }
@media (min-width: 768px) {
  .fuel-hero { padding: 2rem; }
}
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
.fuel-hero__anim { animation: fade-in 1s; }
.unrelated { display: none; }
`;
    const blocks = parseCssBlocks(css);
    assert(blocks.length >= 5, `parsed ${blocks.length} css blocks`);

    const extract = extractCssBySelectors(css, [".fuel-hero"], {
      extraScanText: 'className="fuel-btn fuel-btn--primary"',
    });
    assertIncludes(extract, ":root", "includes design tokens");
    assertIncludes(extract, ".fuel-hero", "includes section selector");
    assertIncludes(extract, ".fuel-hero__title", "includes BEM element");
    assertIncludes(extract, "@media", "keeps related media query");
    assertIncludes(extract, "fade-in", "pulls referenced keyframes");
    assertIncludes(extract, ".fuel-btn", "pulls shared util from scan text");
    assert(!extract.includes(".unrelated"), "drops unrelated rules");

    const none = extractCssBySelectors(css, [".nope-class"]);
    assertIncludes(none, "No matching rules", "no-match message");
  }

  // -------------------------------------------------------------------------
  console.log("\nhashSliceSurfaces");
  // -------------------------------------------------------------------------
  {
    const a = hashSliceSurfaces("c", "d", "s");
    const b = hashSliceSurfaces("c", "d", "s");
    const c = hashSliceSurfaces("c", "d", "S");
    assertEq(a, b, "hash is stable for same inputs");
    assert(a !== c, "hash changes when css changes");
    assertEq(a.length, 64, "sha256 hex length 64");
    assertEq(a, expectedHash("c", "d", "s"), "matches node:crypto reference");
  }

  // -------------------------------------------------------------------------
  console.log("\nresolveImportSpecifier / buildImportGraph");
  // -------------------------------------------------------------------------
  {
    assertEq(
      resolveImportSpecifier("@/lib/utils", "src/components/fuel/sections/X.tsx"),
      "src/lib/utils",
      "@/ resolves to src/",
    );
    assertEq(
      resolveImportSpecifier("./Reveal", "src/components/fuel/shared/X.tsx"),
      "src/components/fuel/shared/Reveal",
      "relative import resolves",
    );
    assertEq(
      resolveImportSpecifier("react", "src/x.tsx"),
      null,
      "package import is null",
    );

    const graph = buildImportGraph(
      `import React from "react";\nimport { cn } from "@/lib/utils";\nexport { x } from "./y";\n`,
      "src/components/fuel/sections/HeroSection.tsx",
    );
    assert(graph.edges.length >= 2, "detects import edges");
    assert(
      graph.projectDeps.includes("src/lib/utils"),
      "projectDeps includes @/lib/utils",
    );
  }

  // -------------------------------------------------------------------------
  console.log("\nCOPY_FORMATS");
  // -------------------------------------------------------------------------
  {
    for (const f of [
      "component",
      "content",
      "css",
      "template",
      "prompt",
      "prompt-short",
      "cursor-rule",
      "json",
      "zip",
    ]) {
      assert(COPY_FORMATS.includes(f), `COPY_FORMATS includes ${f}`);
    }
  }

  // -------------------------------------------------------------------------
  console.log("\nbuildSlicePack + formatSliceForCopy (hero)");
  // -------------------------------------------------------------------------
  {
    const ids = listSliceIds();
    assert(ids.length > 0, `manifest has ${ids.length} slices`);

    const entry = getSliceEntry("hero");
    assert(Boolean(entry), "hero manifest entry exists");

    if (entry) {
      const pack = buildSlicePack(entry);

      assertEq(pack.id, "hero", "pack id is hero");
      assert(pack.component.length > 50, "component source loaded");
      assert(pack.content.includes("export const") || pack.content.length > 10, "content extracted");
      assert(pack.css.length > 20, "css extracted");
      assertEq(
        pack.contentHash,
        hashSliceSurfaces(pack.component, pack.content, pack.css),
        "contentHash matches surfaces",
      );
      assertEq(pack.contentHash.length, 64, "contentHash is sha256 hex");
      assert(Array.isArray(pack.fileTree) && pack.fileTree.length > 0, "fileTree populated");
      assert(pack.byteSizes.component > 0, "byteSizes.component > 0");
      assert(pack.importGraph.entry.includes("Hero"), "importGraph entry path");

      // Formats
      assertEq(
        formatSliceForCopy(pack, "component"),
        pack.component,
        "format component",
      );
      assertEq(formatSliceForCopy(pack, "css"), pack.css, "format css");
      assertEq(
        formatSliceForCopy(pack, "prompt"),
        pack.promptMarkdown,
        "format prompt",
      );
      assertEq(
        formatSliceForCopy(pack, "prompt-short"),
        pack.promptShortMarkdown,
        "format prompt-short",
      );
      assertEq(
        formatSliceForCopy(pack, "cursor-rule"),
        pack.cursorRuleMarkdown,
        "format cursor-rule",
      );

      const rule = pack.cursorRuleMarkdown;
      assertMatch(rule, /^---\n/, "cursor-rule has frontmatter start");
      assertIncludes(rule, "description:", "cursor-rule description field");
      assertIncludes(rule, "contentHash:", "cursor-rule contentHash field");
      assertIncludes(rule, `sliceId: ${pack.id}`, "cursor-rule sliceId");
      assertIncludes(rule, "alwaysApply: false", "cursor-rule alwaysApply");
      assertIncludes(rule, "globs:", "cursor-rule globs");
      assertIncludes(rule, "Drop-in template", "cursor-rule template section");
      assertIncludes(rule, pack.contentHash, "cursor-rule embeds hash");

      const jsonText = formatSliceForCopy(pack, "json");
      const json = JSON.parse(jsonText);
      assertEq(json.contentHash, pack.contentHash, "json includes contentHash");
      assert(typeof json.cursorRuleMarkdown === "string", "json includes cursorRuleMarkdown");
      assertEq(json.id, "hero", "json id");
    }
  }

  // -------------------------------------------------------------------------
  console.log("\nbuildSlicePack smoke (all manifest ids)");
  // -------------------------------------------------------------------------
  {
    for (const id of listSliceIds()) {
      const entry = getSliceEntry(id);
      if (!entry) {
        assert(false, `${id}: missing entry`);
        continue;
      }
      try {
        const pack = buildSlicePack(entry);
        assert(
          pack.contentHash.length === 64 &&
            pack.cursorRuleMarkdown.includes("contentHash:"),
          `${id}: hash + cursor-rule ok`,
        );
      } catch (e) {
        assert(false, `${id}: build failed - ${e.message}`);
      }
    }
  }

  // -------------------------------------------------------------------------
  console.log("\nzip store + slice/multi zip packs");
  // -------------------------------------------------------------------------
  {
    const zipStoreAbs = path.join(ROOT, "src/lib/vertical-slice/zip-store.ts");
    const zipBuildAbs = path.join(
      ROOT,
      "src/lib/vertical-slice/build-slice-zip.ts",
    );
    const multiAbs = path.join(
      ROOT,
      "src/lib/vertical-slice/multi-slice-pack.ts",
    );
    const { buildStoreZip, crc32 } = await import(pathToFileURL(zipStoreAbs).href);
    const { buildSliceZip, buildMultiSliceZip } = await import(
      pathToFileURL(zipBuildAbs).href,
    );
    const { buildMultiSlicePack, MULTI_COPY_FORMATS } = await import(
      pathToFileURL(multiAbs).href,
    );

    assert(MULTI_COPY_FORMATS.includes("zip"), "MULTI_COPY_FORMATS includes zip");

    // ISO HDLC check vector
    const sample = new TextEncoder().encode("123456789");
    assertEq(crc32(sample) >>> 0, 0xcbf43926, "crc32 check vector 123456789");

    const tiny = buildStoreZip([
      { path: "a/readme.txt", data: "hello" },
      { path: "a/meta.json", data: '{"ok":true}' },
    ]);
    assert(tiny.byteLength > 50, "store zip non-empty");
    // Local file header signature PK\x03\x04
    assertEq(tiny[0], 0x50, "zip local sig P");
    assertEq(tiny[1], 0x4b, "zip local sig K");
    assertEq(tiny[2], 0x03, "zip local sig 03");
    assertEq(tiny[3], 0x04, "zip local sig 04");

    const entry = getSliceEntry("hero");
    if (entry) {
      const pack = buildSlicePack(entry);
      const zip = buildSliceZip(pack);
      assert(zip.byteLength > 100, "slice zip non-empty");
      assertMatch(zip.filename, /^slice-hero-[a-f0-9]{8}\.zip$/, "slice zip filename");
      assertEq(zip.rootDir, "slice-hero", "slice zip rootDir");
      assert(zip.entryCount >= 5, "slice zip has core entries");
      assertEq(zip.bytes[0], 0x50, "slice zip starts with PK");

      const multi = buildMultiSlicePack(["hero", "faq"]);
      const mzip = buildMultiSliceZip(multi);
      assert(mzip.byteLength > 100, "multi zip non-empty");
      assertMatch(
        mzip.filename,
        /^multi-hero-faq-[a-f0-9]{8}\.zip$/,
        "multi zip filename",
      );
      assertEq(mzip.rootDir, "multi-hero-faq", "multi zip rootDir");
      assert(mzip.entryCount >= 10, "multi zip has nested slice files");
    }
  }

  // -------------------------------------------------------------------------
  console.log(`\ntest-slice-pack: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
