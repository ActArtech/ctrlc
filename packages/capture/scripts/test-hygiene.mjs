/**
 * IR hygiene tests (junk drop, dedupe, semantic short ids).
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "..");
const distIndex = path.join(pkgRoot, "dist/index.js");
const srcIndex = path.join(pkgRoot, "src/index.ts");

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

const {
  isJunkSection,
  dedupeSections,
  assignStableIds,
  hygienizeSections,
  hygienizePageIR,
  PAGE_IR_SCHEMA_VERSION,
} = await loadCapture();

console.log("@ctrlc/capture IR hygiene tests\n");

// --- junk ---
assert(
  isJunkSection({
    id: "div",
    label: "div",
    interactionModel: "static",
    selector: "body > div:nth-of-type(9)",
    textSample: "",
    boundingBox: { x: 0, y: 0, width: 100, height: 0 },
  }),
  "empty tiny div is junk",
);

assert(
  !isJunkSection({
    id: "header",
    label: "header",
    interactionModel: "hybrid",
    selector: "header",
    textSample: "Northline Features Pricing Sign in Start for free",
    boundingBox: { x: 0, y: 0, width: 1200, height: 64 },
  }),
  "header landmark kept",
);

assert(
  isJunkSection({
    id: "x",
    label: "div",
    interactionModel: "static",
    selector: "div.foo",
    textSample: "hi",
    boundingBox: { x: 0, y: 0, width: 20, height: 10 },
  }),
  "tiny short div is junk",
);

// --- dedupe ---
const { sections: deduped, removed } = dedupeSections([
  {
    id: "a",
    label: "Pricing",
    interactionModel: "static",
    textSample:
      "Simple Transparent Pricing Choose the plan that fits Free Pro Max",
    selector: "div",
  },
  {
    id: "b",
    label: "Simple Transparent Pricing",
    interactionModel: "hybrid",
    textSample:
      "Simple Transparent Pricing Choose the plan that fits Free Pro Max",
    selector: "section",
  },
]);
assert(removed >= 1, "dedupe removes near-duplicate");
assert(deduped.length === 1, "one pricing section remains");
assert(deduped[0].selector === "section", "prefer landmark/section over div");

// --- semantic ids ---
const withIds = assignStableIds([
  {
    id: "ship-analytics-that-teams-actually-open",
    label: "Ship analytics that teams actually open",
    interactionModel: "hybrid",
    textSample:
      "Your professional presentation workspace Ship analytics that teams actually open",
    selector: "section",
  },
  {
    id: "simple-transparent-pricing",
    label: "Simple, Transparent Pricing",
    interactionModel: "hybrid",
    textSample: "Simple, Transparent Pricing Choose the plan Free Pro Max",
    selector: "section",
  },
  {
    id: "frequently-asked-questions",
    label: "Frequently Asked Questions",
    interactionModel: "hybrid",
    textSample: "Frequently Asked Questions Still have questions?",
    selector: "section",
  },
  {
    id: "header-long",
    label: "header",
    interactionModel: "hybrid",
    textSample: "Northline Sign in Start for free",
    selector: "header.site-header",
  },
]);

const ids = withIds.map((s) => s.id);
assert(ids.includes("hero"), `hero id present (${ids.join(",")})`);
assert(ids.includes("pricing"), "pricing id present");
assert(ids.includes("faq"), "faq id present");
assert(ids.includes("header"), "header id present");
assert(
  withIds.find((s) => s.id === "pricing")?.label.includes("Pricing"),
  "pricing keeps full title label",
);

// --- full pipeline (noisy landing IR) ---
const messy = [
  {
    id: "div",
    label: "div",
    interactionModel: "static",
    selector: "div",
    textSample: "",
    boundingBox: { x: 0, y: 0, width: 10, height: 2 },
  },
  {
    id: "header",
    label: "header",
    interactionModel: "hybrid",
    selector: "header",
    textSample: "Northline Features Pricing",
  },
  {
    id: "main-navigation",
    label: "Main navigation",
    interactionModel: "hybrid",
    selector: "nav",
    textSample: "Features Showcase Pricing",
  },
  {
    id: "dup-header",
    label: "header",
    interactionModel: "hybrid",
    selector: "div",
    textSample: "Northline Features Pricing",
  },
  {
    id: "see-it-in-action",
    label: "See It In Action",
    interactionModel: "hybrid",
    selector: "section",
    textSample: "See It In Action Watch demo",
  },
  {
    id: "simple-transparent-pricing",
    label: "Simple, Transparent Pricing",
    interactionModel: "hybrid",
    selector: "section",
    textSample: "Simple, Transparent Pricing Free Pro Max",
  },
];

const { sections: clean, dropped, deduped: dcount } = hygienizeSections(messy);
assert(dropped >= 1, "pipeline drops empty div");
assert(dcount >= 1, "pipeline dedupes header clone");
assert(
  !clean.some((s) => s.id === "div" || s.label === "div"),
  "no bare div section left",
);
assert(
  clean.some((s) => s.id === "pricing"),
  "pricing short id",
);
assert(clean.some((s) => s.id === "demo" || s.id === "see-it-in-action" || s.id.includes("action") || s.id === "demo"), "demo/action section present");

const ir = hygienizePageIR({
  schemaVersion: PAGE_IR_SCHEMA_VERSION,
  sourceUrl: "https://example.com",
  capturedAt: new Date().toISOString(),
  viewport: { width: 1440, height: 900 },
  sections: messy,
  tokens: { colors: [], fonts: [] },
  assets: [],
});
assert(Array.isArray(ir.notes) && ir.notes.some((n) => /hygiene/i.test(n)), "notes mention hygiene");
assert(ir.sections.length < messy.length, "IR section count reduced");

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall ok");
