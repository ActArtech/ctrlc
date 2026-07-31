/**
 * Page IR golden + fixture metadata tests (no Playwright / no browser).
 * Usage: npm run test -w @ctrlc/capture
 */

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "..");
const fixturesDir = path.join(pkgRoot, "fixtures");
const sampleIrPath = path.join(fixturesDir, "sample-ir.json");
const sampleHtmlPath = path.join(fixturesDir, "sample-page.html");
const distIndex = path.join(pkgRoot, "dist/index.js");
const srcIndex = path.join(pkgRoot, "src/index.ts");

const INTERACTION_MODELS = new Set([
  "static",
  "click",
  "scroll",
  "hover",
  "time",
  "hybrid",
]);
const ASSET_KINDS = new Set(["image", "video", "font", "other"]);

async function loadCapture() {
  if (fs.existsSync(distIndex)) {
    return import(pathToFileURL(distIndex).href);
  }
  const api = await import("tsx/esm/api");
  api.register();
  return import(pathToFileURL(srcIndex).href);
}

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error(`  FAIL  ${msg}`);
    failed++;
  } else {
    console.log(`  ok    ${msg}`);
  }
}

/**
 * Lightweight schema check for Page IR v1 (mirrors packages/capture/src/ir.ts).
 * @param {unknown} ir
 */
function validatePageIrShape(ir) {
  assert(ir != null && typeof ir === "object", "IR is object");
  const o = /** @type {Record<string, unknown>} */ (ir);

  assert(o.schemaVersion === 1, "schemaVersion === 1");
  assert(typeof o.sourceUrl === "string" && o.sourceUrl.length > 0, "sourceUrl string");
  assert(typeof o.capturedAt === "string" && o.capturedAt.length > 0, "capturedAt string");

  const vp = /** @type {Record<string, unknown>} */ (o.viewport || {});
  assert(typeof vp.width === "number" && vp.width > 0, "viewport.width");
  assert(typeof vp.height === "number" && vp.height > 0, "viewport.height");

  assert(Array.isArray(o.sections), "sections is array");
  assert(Array.isArray(o.assets), "assets is array");
  assert(o.tokens != null && typeof o.tokens === "object", "tokens object");

  const tokens = /** @type {Record<string, unknown>} */ (o.tokens);
  assert(Array.isArray(tokens.colors), "tokens.colors array");
  assert(Array.isArray(tokens.fonts), "tokens.fonts array");

  const sections = /** @type {Record<string, unknown>[]} */ (o.sections);
  const ids = new Set();
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    assert(typeof s.id === "string" && s.id.length > 0, `sections[${i}].id`);
    assert(typeof s.label === "string" && s.label.length > 0, `sections[${i}].label`);
    assert(
      INTERACTION_MODELS.has(/** @type {string} */ (s.interactionModel)),
      `sections[${i}].interactionModel valid (${s.interactionModel})`,
    );
    assert(!ids.has(s.id), `sections[${i}].id unique (${s.id})`);
    ids.add(s.id);
  }

  const assets = /** @type {Record<string, unknown>[]} */ (o.assets);
  for (let i = 0; i < assets.length; i++) {
    const a = assets[i];
    assert(typeof a.url === "string" && a.url.length > 0, `assets[${i}].url`);
    assert(ASSET_KINDS.has(/** @type {string} */ (a.kind)), `assets[${i}].kind`);
  }

  return { sections, ids };
}

/**
 * Stub path: build a minimal IR from fixture HTML metadata (no browser).
 * Uses data-section / aria-label landmarks only.
 * @param {string} html
 * @param {typeof import("../src/index.ts")} mod
 */
function buildIrFromFixtureHtml(html, mod) {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : undefined;

  /** @type {{ label: string, dataSection: string }[]} */
  const found = [];
  const landmarkRe =
    /<(header|footer|section|nav|main)\b([^>]*)>/gi;
  let m;
  while ((m = landmarkRe.exec(html)) !== null) {
    const attrs = m[2] || "";
    const aria = attrs.match(/aria-label\s*=\s*["']([^"']+)["']/i);
    const data = attrs.match(/data-section\s*=\s*["']([^"']+)["']/i);
    if (!aria && !data) continue;
    const label = (aria?.[1] || data?.[1] || m[1]).trim();
    found.push({
      label,
      dataSection: (data?.[1] || label).trim(),
    });
  }

  const labels = found.map((f) => f.label);
  const ids = mod.uniqueSectionIds(labels);

  /** @type {import("../src/ir.ts").PageIRSection[]} */
  const sections = found.map((f, i) => ({
    id: ids[i],
    label: f.label,
    interactionModel: "static",
    selector: f.dataSection
      ? `[data-section="${f.dataSection}"]`
      : undefined,
  }));

  return {
    schemaVersion: mod.PAGE_IR_SCHEMA_VERSION,
    sourceUrl: "file://fixtures/sample-page.html",
    capturedAt: "2026-07-31T00:00:00.000Z",
    viewport: { width: 1440, height: 900 },
    title,
    sections,
    tokens: { colors: [], fonts: [] },
    assets: [],
    notes: ["stub IR from fixture HTML landmarks (no Playwright)"],
  };
}

console.log("@ctrlc/capture IR fixture tests\n");

// --- fixtures exist ---
assert(fs.existsSync(sampleIrPath), "fixtures/sample-ir.json exists");
assert(fs.existsSync(sampleHtmlPath), "fixtures/sample-page.html exists");

const raw = fs.readFileSync(sampleIrPath, "utf8");
let golden;
try {
  golden = JSON.parse(raw);
  assert(true, "sample-ir.json parses as JSON");
} catch (e) {
  assert(false, `sample-ir.json parse: ${e}`);
  golden = null;
}

if (golden) {
  console.log("\ngolden IR shape\n");
  const { sections } = validatePageIrShape(golden);
  assert(sections.length >= 4, "golden has >= 4 sections (header/hero/features/cta)");

  const html = fs.readFileSync(sampleHtmlPath, "utf8");
  assert(/data-section=["']header["']/.test(html), "html has data-section=header");
  assert(/data-section=["']hero["']/.test(html), "html has data-section=hero");
  assert(/data-section=["']features["']/.test(html), "html has data-section=features");
  assert(/data-section=["']cta["']/.test(html), "html has data-section=cta");
  assert(/aria-label=["']Hero["']/.test(html), "html has aria-label Hero landmark");
}

// --- pure helpers + stub capture path ---
const mod = await loadCapture();
const { uniqueSectionIds, PAGE_IR_SCHEMA_VERSION, writeIr } = mod;

console.log("\nuniqueSectionIds on sample labels\n");
const sampleLabels = [
  "Site header",
  "Hero",
  "Features",
  "Call to action",
  "Site footer",
];
const sampleIds = uniqueSectionIds(sampleLabels);
assert(sampleIds.length === 5, "5 unique ids");
assert(sampleIds[0] === "site-header", "site-header");
assert(sampleIds[1] === "hero", "hero");
assert(sampleIds[2] === "features", "features");
assert(sampleIds[3] === "call-to-action", "call-to-action");
assert(sampleIds[4] === "site-footer", "site-footer");
assert(new Set(sampleIds).size === sampleIds.length, "no id collisions");

if (golden?.sections) {
  const goldenLabels = golden.sections.map((s) => s.label);
  const recomputed = uniqueSectionIds(goldenLabels);
  for (let i = 0; i < golden.sections.length; i++) {
    assert(
      recomputed[i] === golden.sections[i].id ||
        golden.sections[i].id.startsWith(recomputed[i].split("-")[0]),
      `golden section id aligns with uniqueSectionIds (${golden.sections[i].id})`,
    );
  }
  // Stronger: exact match when golden ids were produced by same helper
  const exact = uniqueSectionIds(goldenLabels);
  assert(
    exact.every((id, i) => id === golden.sections[i].id),
    "golden section ids === uniqueSectionIds(labels)",
  );
}

console.log("\nstub IR from fixture HTML (no Playwright)\n");
const html = fs.readFileSync(sampleHtmlPath, "utf8");
const stub = buildIrFromFixtureHtml(html, mod);
assert(stub.schemaVersion === PAGE_IR_SCHEMA_VERSION, "stub schemaVersion matches package");
assert(stub.title === "CtrlC Sample Capture Page", "stub title from HTML");
assert(stub.sections.length >= 4, "stub found >= 4 landmarks");
const stubIds = stub.sections.map((s) => s.id);
assert(new Set(stubIds).size === stubIds.length, "stub section ids unique");
assert(
  stub.sections.some((s) => /hero/i.test(s.id) || /hero/i.test(s.label)),
  "stub includes hero landmark",
);

// writeIr round-trip (temp dir under fixtures/.tmp-test)
const tmpDir = path.join(fixturesDir, ".tmp-ir-write");
try {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  const { irPath } = writeIr(tmpDir, stub);
  assert(fs.existsSync(irPath), "writeIr writes ir.json");
  const round = JSON.parse(fs.readFileSync(irPath, "utf8"));
  assert(round.schemaVersion === 1, "round-trip schemaVersion");
  assert(round.sections.length === stub.sections.length, "round-trip section count");
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// Live capture (optional): skip when Playwright missing
console.log("\nlive capture (optional)\n");
const pw = await mod.tryLoadPlaywright();
if (!pw) {
  console.log("  skip  Playwright not installed (unit tests do not require it)");
} else {
  console.log("  info  Playwright present; live capture not invoked in unit tests");
}

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall ok");
