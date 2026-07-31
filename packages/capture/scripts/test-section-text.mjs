/**
 * Structured section text model tests.
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "..");
const distIndex = path.join(pkgRoot, "dist/index.js");

async function loadCapture() {
  if (fs.existsSync(distIndex)) {
    return import(pathToFileURL(distIndex).href);
  }
  const api = await import("tsx/esm/api");
  api.register();
  return import(pathToFileURL(path.join(pkgRoot, "src/index.ts")).href);
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
  normalizeSectionText,
  synthesizeTextSample,
  contentSlotsFromSectionText,
  ensureSectionTextFields,
  isEmptySectionText,
} = await loadCapture();

console.log("@ctrlc/capture section text model tests\n");

const raw = {
  eyebrow: "  Your assistant  ",
  headings: ["Distill research into slides", "Distill research into slides"],
  paragraphs: ["Upload a PDF.", "Export PPTX."],
  listItems: ["Macro frame", "BBB sweet-spot"],
  ctas: [
    { label: "Try Free", href: "#start", role: "primary" },
    { label: "Watch Demo", href: "#demo", role: "secondary" },
    { label: "Try Free", href: "#start", role: "primary" },
  ],
};

const t = normalizeSectionText(raw);
assert(t, "normalize returns model");
assert(t.headings.length === 1, "dedupe headings");
assert(t.ctas.length === 2, "dedupe ctas");
assert(t.eyebrow === "Your assistant", "trim eyebrow");
assert(!isEmptySectionText(t), "not empty");

const sample = synthesizeTextSample(t, 200);
assert(sample.includes("Distill"), "sample has heading");
assert(sample.includes("Try Free"), "sample has cta");
assert(sample.length <= 200, "sample capped");

const slots = contentSlotsFromSectionText(t);
assert(slots.title === "Distill research into slides", "slot title");
assert(slots.eyebrow === "Your assistant", "slot eyebrow");
assert(slots.body.includes("Upload"), "slot body");
assert(slots.listItems.includes("Macro frame"), "slot list");
assert(slots.primaryCta === "Try Free", "slot primary cta");
assert(slots.secondaryCta === "Watch Demo", "slot secondary cta");
assert(slots.primaryCtaHref === "#start", "slot cta href");

const section = ensureSectionTextFields({
  id: "hero",
  label: "Hero",
  interactionModel: "click",
  text: raw,
});
assert(section.text?.headings?.[0], "ensure keeps text");
assert(section.textSample?.includes("Distill"), "ensure synthesizes sample");

assert(isEmptySectionText(normalizeSectionText({})), "empty model");
assert(
  isEmptySectionText(
    normalizeSectionText({ headings: [], paragraphs: [], listItems: [], ctas: [] }),
  ),
  "empty arrays",
);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall ok");
