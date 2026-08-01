/**
 * Canonical CLI help lines for `CtrlC` commands.
 * Keep printHelp() in sync by importing COMMAND_HELP_LINES.
 */

/** @typedef {{ name: string; summary: string; experimental?: boolean }} CommandHelp */

/**
 * All known commands (stable + experimental placeholders).
 * @type {CommandHelp[]}
 */
export const COMMANDS = [
  { name: "validate", summary: "Validate SectionPackConfig (structure + optional paths)" },
  { name: "list", summary: "List section ids (and recipes) from config" },
  { name: "pack", summary: "Build one section pack; write --out or stdout" },
  {
    name: "pack-multi",
    summary: "Build multi-section pack (ids or --recipe <id>)",
  },
  { name: "graph", summary: "Section dependency graph (mermaid; optional --json / --md)" },
  { name: "scan", summary: "Discover src/components/sections/*.tsx; draft config JSON" },
  { name: "snapshot", summary: "Build all packs; write .ctrlc/snapshots/<id>.json" },
  { name: "watch", summary: "Watch section sources; rebuild on change (optional --snapshot)" },
  { name: "library", summary: "Export section library (NL + code pack + meta) for agent context" },
  { name: "schema", summary: "Print SectionPackConfig JSON Schema (draft-07) to stdout" },
  { name: "init-clone", summary: "Scaffold React/Next section host + research dirs + SectionPack + skill" },
  { name: "register", summary: "Upsert section into .ctrlc/registry.json (auto-merged into config)" },
  { name: "specs-from-ir", summary: "Page IR JSON → docs/research/components/<id>.spec.md (+ topology)" },
  { name: "register-from-spec", summary: "Register section from section.spec.md (id + component path inferred)" },
  { name: "qa", summary: "Validate + list sections + npm run build (use --skip-build to skip; --no-build alias)" },
  { name: "capture", summary: "Page recon -> Page IR + screenshot (scope=page; optional playwright)" },
  {
    name: "materialize-assets",
    summary: "Download IR assets into public/ with stable names + localPath",
  },
  {
    name: "tokens-from-ir",
    summary: "Extract design tokens from Page IR → tokens.css + DESIGN_TOKENS.md",
  },
  {
    name: "register-from-ir",
    summary: "Emit .ctrlc/registry.json + landing-core recipe from Page IR",
  },
  {
    name: "baseline",
    summary: "Copy or capture full-page screenshot baselines for visual QA",
  },
  {
    name: "plan-parallel",
    summary: "Build parallel section plan from docs/research/components/*.spec.md",
  },
  {
    name: "visual-diff",
    summary: "Compare two PNG screenshots (optional peers: pngjs + pixelmatch)",
  },
  {
    name: "pipeline",
    summary: "Orchestrate capture + IR post-process (assets, tokens, registry, specs)",
  },
  {
    name: "adapt-ir",
    summary: "External capture / file-map JSON → CtrlC Page IR (adapter only)",
  },
  {
    name: "hygienize-ir",
    summary: "Drop noise sections, dedupe, assign short ids (hero/pricing/faq) on IR",
  },
  {
    name: "scaffold-from-ir",
    summary: "IR → React section stubs + home.ts content keys + page.tsx order",
  },
  {
    name: "doctor",
    summary: "Environment health check (Node, core, capture, playwright, demos)",
  },
];

/**
 * Formatted help lines for the Commands section of printHelp().
 * @type {string[]}
 */
export const COMMAND_HELP_LINES = COMMANDS.map((c) => {
  const pad = c.name.padEnd(22);
  const tag = c.experimental ? " [experimental]" : "";
  return `  ${pad}${c.summary}${tag}`;
});

/**
 * Capture-pipeline commands loaded dynamically from sibling modules.
 * Kept even when no longer tagged experimental so run() can dispatch them.
 * @type {string[]}
 */
export const PIPELINE_COMMANDS = [
  "materialize-assets",
  "tokens-from-ir",
  "register-from-ir",
  "baseline",
  "plan-parallel",
  "hygienize-ir",
  "scaffold-from-ir",
  "visual-diff",
  "pipeline",
  "adapt-ir",
  "doctor",
];

/**
 * @deprecated use PIPELINE_COMMANDS
 * @type {string[]}
 */
export const EXPERIMENTAL_COMMANDS = PIPELINE_COMMANDS;
