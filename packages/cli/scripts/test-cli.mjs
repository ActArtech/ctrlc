/**
 * Smoke tests for @ctrlc/cli
 *
 * - list against createDemoSectionPackConfig (core)
 * - CLI list / scan / validate --structure-only dry runs
 *
 * Usage: node packages/cli/scripts/test-cli.mjs
 *        npm run test -w @ctrlc/cli
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  fileBaseToId,
  guessExportName,
  guessContentKey,
  scanSections,
} from "../src/scan.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.resolve(__dirname, "..");
const MONO_ROOT = path.resolve(CLI_ROOT, "../..");
const BIN = path.join(CLI_ROOT, "bin/ctrlc.mjs");
const DEMO = path.join(MONO_ROOT, "examples/next-demo");
const CORE_DIST = path.join(MONO_ROOT, "packages/core/dist/index.js");

async function importCore() {
  try {
    return await import("@ctrlc/core");
  } catch {
    if (!fs.existsSync(CORE_DIST)) {
      throw new Error("Missing @ctrlc/core (build packages/core first)");
    }
    return import(pathToFileURL(CORE_DIST).href);
  }
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

function testScanHelpers() {
  console.log("\nscan helpers");
  assert(fileBaseToId("Hero.tsx") === "hero", "Hero -> hero");
  assert(fileBaseToId("SiteHeader.tsx") === "site-header", "SiteHeader -> site-header");
  assert(fileBaseToId("PromoBar.tsx") === "promo-bar", "PromoBar -> promo-bar");
  assert(fileBaseToId("CTA.tsx") === "cta", "CTA -> cta");
  assert(
    guessExportName("export function Hero() {}", "Hero.tsx") === "Hero",
    "guess export Hero",
  );
  assert(guessContentKey("Hero.tsx", "hero") === "hero", "content key hero");
  assert(guessContentKey("SiteHeader.tsx", "site-header") === "siteHeader", "content key siteHeader");
}

function runCli(args, opts = {}) {
  const r = spawnSync(process.execPath, [BIN, ...args], {
    encoding: "utf8",
    cwd: opts.cwd ?? MONO_ROOT,
    env: { ...process.env, ...opts.env },
  });
  return {
    status: r.status ?? 1,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

async function testCoreList() {
  console.log("\ncore createDemoSectionPackConfig list");
  const core = await importCore();
  const config = core.createDemoSectionPackConfig();
  const ids = core.listSectionIds(config);
  assert(ids.length === 6, `demo ids length === 6 (got ${ids.length})`);
  assert(ids.includes("hero"), "demo includes hero");
  assert(ids.includes("cta"), "demo includes cta");
  const recipes = core.listRecipeIds(config);
  assert(recipes.length >= 1, `demo has recipes (got ${recipes.length})`);
}

function testCliHelp() {
  console.log("\ncli help");
  const r = runCli(["--help"]);
  assert(r.status === 0, "help exit 0");
  assert(r.stdout.includes("CtrlC"), "help mentions CtrlC");
  assert(r.stdout.includes("validate"), "help lists validate");
  assert(r.stdout.includes("scan"), "help lists scan");
  assert(r.stdout.includes("snapshot"), "help lists snapshot");
  assert(r.stdout.includes("watch"), "help lists watch");
  assert(r.stdout.includes("library"), "help lists library");
  assert(r.stdout.includes("schema"), "help lists schema");
  assert(r.stdout.includes("graph"), "help lists graph");
  assert(r.stdout.includes("specs-from-ir"), "help lists specs-from-ir");
  assert(r.stdout.includes("register-from-spec"), "help lists register-from-spec");
  assert(r.stdout.includes("capture"), "help lists capture");
  assert(r.stdout.includes("init-clone"), "help lists init-clone");
  assert(r.stdout.includes("materialize-assets"), "help lists materialize-assets");
  assert(r.stdout.includes("tokens-from-ir"), "help lists tokens-from-ir");
  assert(r.stdout.includes("register-from-ir"), "help lists register-from-ir");
  assert(r.stdout.includes("baseline"), "help lists baseline");
  assert(r.stdout.includes("visual-diff"), "help lists visual-diff");
  assert(r.stdout.includes("plan-parallel"), "help lists plan-parallel");
  assert(r.stdout.includes("pipeline"), "help lists pipeline");
  assert(r.stdout.includes("adapt-ir"), "help lists adapt-ir");
  assert(r.stdout.includes("doctor"), "help lists doctor");
  assert(r.stdout.includes("Capture pipeline"), "help mentions capture pipeline notes");
}

function testCliPipelineDryRun() {
  console.log("\ncli pipeline --dry-run --ir fixtures/sample-ir.json");
  const sampleIr = path.join(MONO_ROOT, "packages/capture/fixtures/sample-ir.json");
  if (!fs.existsSync(sampleIr)) {
    console.log("  skip  sample-ir.json missing");
    return;
  }
  const tmp = path.join(CLI_ROOT, ".tmp-pipeline-dry-run");
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    // ignore
  }
  fs.mkdirSync(tmp, { recursive: true });

  const r = runCli([
    "pipeline",
    "--dry-run",
    "--ir",
    sampleIr,
    "--cwd",
    tmp,
  ]);
  assert(r.status === 0, `pipeline --dry-run exit 0 (stderr: ${r.stderr.slice(0, 300)})`);
  const out = `${r.stdout}\n${r.stderr}`;
  assert(
    /materialize-assets|tokens-from-ir|register-from-ir|specs-from-ir/i.test(out),
    "pipeline dry-run mentions post-process steps",
  );
  assert(
    /dry-run|planned|plan/i.test(out),
    "pipeline dry-run indicates planning mode",
  );

  const j = runCli([
    "pipeline",
    "--dry-run",
    "--ir",
    sampleIr,
    "--cwd",
    tmp,
    "--json",
  ]);
  assert(j.status === 0, "pipeline --dry-run --json exit 0");
  let data;
  try {
    data = JSON.parse(j.stdout);
  } catch (e) {
    assert(false, `pipeline dry-run json: ${e.message}\n${j.stdout.slice(0, 400)}`);
    return;
  }
  assert(data.ok === true, "pipeline dry-run json ok");
  assert(data.dryRun === true, "pipeline dry-run json dryRun");
  assert(
    Array.isArray(data.steps) && data.steps.length >= 4,
    "pipeline dry-run steps array",
  );

  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    // ignore cleanup
  }
}

function testCliSchema() {
  console.log("\ncli schema");
  const r = runCli(["schema"]);
  assert(r.status === 0, "schema exit 0");
  let data;
  try {
    data = JSON.parse(r.stdout);
  } catch (e) {
    assert(false, `schema json parse: ${e.message}\n${r.stderr}\n${r.stdout.slice(0, 400)}`);
    return;
  }
  assert(data.title === "SectionPackConfig", "schema title");
  assert(data.properties?.schemaVersion != null, "schema has schemaVersion");
  assert(data.definitions?.SectionPackEntry != null, "schema has SectionPackEntry");
  assert(Array.isArray(data.required) && data.required.includes("sections"), "schema requires sections");
}

function testCliListDemoConfig() {
  console.log("\ncli list (falls back to createDemoSectionPackConfig)");
  // From monorepo root: no host config -> demo config
  const r = runCli(["list", "--json"]);
  assert(r.status === 0, "list exit 0");
  let data;
  try {
    data = JSON.parse(r.stdout);
  } catch {
    assert(false, "list --json parses");
    return;
  }
  assert(Array.isArray(data.ids), "list json has ids");
  assert(data.ids.includes("hero"), "list includes hero");
  assert(
    String(data.configSource).includes("createDemoSectionPackConfig"),
    "list source is demo factory when no host config",
  );
}

function testCliListNextDemo() {
  console.log("\ncli list --cwd examples/next-demo");
  if (!fs.existsSync(DEMO)) {
    console.log("  skip  next-demo missing");
    return;
  }
  const r = runCli(["list", "--cwd", DEMO, "--json"]);
  assert(r.status === 0, "list next-demo exit 0");
  let data;
  try {
    data = JSON.parse(r.stdout);
  } catch (e) {
    assert(false, `list next-demo json parse: ${e.message}\n${r.stderr}\n${r.stdout.slice(0, 400)}`);
    return;
  }
  assert(data.ids?.includes("hero"), "next-demo list has hero");
  assert(data.ids?.includes("promo"), "next-demo list has promo");
  assert(
    String(data.configSource).includes("section-pack-config"),
    "next-demo loads section-pack-config",
  );
}

function testCliValidateStructure() {
  console.log("\ncli validate --structure-only");
  const r = runCli(["validate", "--structure-only", "--json"]);
  assert(r.status === 0, "validate structure-only exit 0");
  let data;
  try {
    data = JSON.parse(r.stdout);
  } catch {
    assert(false, "validate json parses");
    return;
  }
  assert(data.ok === true, "demo structure validates");
}

function testCliScan() {
  console.log("\ncli scan --cwd examples/next-demo");
  if (!fs.existsSync(DEMO)) {
    console.log("  skip  next-demo missing");
    return;
  }
  const r = runCli(["scan", "--cwd", DEMO]);
  assert(r.status === 0, "scan exit 0");
  let draft;
  try {
    draft = JSON.parse(r.stdout);
  } catch (e) {
    assert(false, `scan json: ${e.message}\n${r.stderr}`);
    return;
  }
  assert(Array.isArray(draft.sections), "scan draft has sections");
  assert(draft.sections.length >= 4, `scan found sections (got ${draft.sections.length})`);
  const ids = draft.sections.map((s) => s.id);
  assert(
    ids.some((id) => id === "hero" || id.includes("hero")),
    `scan ids include hero-like entry: ${ids.join(",")}`,
  );
  assert(
    draft.sections.every((s) => s.componentPath.endsWith(".tsx")),
    "scan component paths are .tsx (React-only)",
  );
}

function testCliPackDescribe() {
  console.log("\ncli pack hero --format describe (demo config, structure-only surfaces)");
  // Demo config paths may not exist at monorepo root; describe still builds with missing stubs
  const r = runCli(["pack", "hero", "--format", "describe"]);
  assert(r.status === 0, "pack describe exit 0");
  assert(
    r.stdout.length > 50 || r.stderr.includes("Wrote"),
    "pack describe produced output",
  );
}

function testCliPackMultiRecipe() {
  console.log("\ncli pack-multi --recipe landing-core --format describe --cwd examples/next-demo");
  if (!fs.existsSync(DEMO)) {
    console.log("  skip  next-demo missing");
    return;
  }
  const r = runCli([
    "pack-multi",
    "--recipe",
    "landing-core",
    "--format",
    "describe",
    "--cwd",
    DEMO,
  ]);
  assert(r.status === 0, `pack-multi --recipe exit 0 (stderr: ${r.stderr.slice(0, 300)})`);
  assert(r.stdout.length > 100, "pack-multi --recipe produced describe output");
  // landing-core: header, hero, features, how-it-works, cta
  assert(/hero/i.test(r.stdout), "recipe pack mentions hero");
  assert(/features/i.test(r.stdout) || /cta/i.test(r.stdout), "recipe pack mentions multi sections");

  const bad = runCli([
    "pack-multi",
    "--recipe",
    "no-such-recipe",
    "--format",
    "describe",
    "--cwd",
    DEMO,
  ]);
  assert(bad.status !== 0, "unknown recipe exits non-zero");
  assert(
    /unknown recipe|known recipes/i.test(`${bad.stdout}\n${bad.stderr}`),
    "unknown recipe mentions known recipes",
  );

  const help = runCli(["--help"]);
  assert(help.stdout.includes("--recipe"), "help documents --recipe");
  assert(
    help.stdout.includes("pack-multi --recipe landing-core") ||
      help.stdout.includes("--recipe landing-core"),
    "help example uses pack-multi --recipe landing-core",
  );
}

function testCliSnapshotNextDemo() {
  console.log("\ncli snapshot --cwd examples/next-demo");
  if (!fs.existsSync(DEMO)) {
    console.log("  skip  next-demo missing");
    return;
  }
  const tmpDir = path.join(MONO_ROOT, "packages/cli/.tmp-snapshots-test");
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
  const r = runCli([
    "snapshot",
    "--cwd",
    DEMO,
    "--out-dir",
    tmpDir,
    "--json",
  ]);
  assert(r.status === 0, `snapshot exit 0 (stderr: ${r.stderr.slice(0, 200)})`);
  let data;
  try {
    data = JSON.parse(r.stdout);
  } catch (e) {
    assert(false, `snapshot json: ${e.message}\n${r.stdout.slice(0, 400)}`);
    return;
  }
  assert(data.count >= 4, `snapshot count >= 4 (got ${data.count})`);
  assert(Array.isArray(data.snapshots), "snapshot list present");
  const hero = data.snapshots.find((s) => s.id === "hero");
  assert(hero && hero.contentHash?.length === 64, "hero snapshot has sha256 contentHash");
  assert(
    fs.existsSync(path.join(tmpDir, "hero.json")),
    "hero.json written under out-dir",
  );
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup
  }
}

function testCliLibraryNextDemo() {
  console.log("\ncli library --cwd examples/next-demo");
  if (!fs.existsSync(DEMO)) {
    console.log("  skip  next-demo missing");
    return;
  }
  const tmpDir = path.join(MONO_ROOT, "packages/cli/.tmp-library-test");
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
  const r = runCli([
    "library",
    "--cwd",
    DEMO,
    "--out",
    tmpDir,
    "--json",
  ]);
  assert(r.status === 0, `library exit 0 (stderr: ${r.stderr.slice(0, 200)})`);
  let data;
  try {
    data = JSON.parse(r.stdout);
  } catch (e) {
    assert(false, `library json: ${e.message}\n${r.stdout.slice(0, 400)}`);
    return;
  }
  assert(data.sectionCount >= 4, `library sectionCount >= 4 (got ${data.sectionCount})`);
  assert(Array.isArray(data.sections), "library sections array present");

  const indexPath = path.join(tmpDir, "index.json");
  assert(fs.existsSync(indexPath), "index.json written");
  let index;
  try {
    index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  } catch (e) {
    assert(false, `index.json parse: ${e.message}`);
    return;
  }
  assert(
    Array.isArray(index.sections) && index.sections.length === data.sectionCount,
    `index.json sections length === sectionCount (${data.sectionCount})`,
  );
  assert(index.sections.length >= 4, "index.json has section count >= 4");
  assert(fs.existsSync(path.join(tmpDir, "index.md")), "index.md written");

  const hero = index.sections.find((s) => s.id === "hero");
  assert(hero && hero.contentHash?.length === 64, "hero entry has contentHash");
  assert(
    fs.existsSync(path.join(tmpDir, "sections/hero/NATURAL_LANGUAGE.md")),
    "hero NATURAL_LANGUAGE.md",
  );
  assert(
    fs.existsSync(path.join(tmpDir, "sections/hero/CODE_PACK.md")),
    "hero CODE_PACK.md",
  );
  assert(
    fs.existsSync(path.join(tmpDir, "sections/hero/meta.json")),
    "hero meta.json",
  );
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup
  }
}

async function testScanApi() {
  console.log("\nscanSections() API on next-demo");
  if (!fs.existsSync(DEMO)) {
    console.log("  skip  next-demo missing");
    return;
  }
  const result = await scanSections({ cwd: DEMO });
  assert(result.ok === true, "scanSections ok");
  assert(result.draft.sections.length >= 4, "scanSections found sections");
  assert(
    result.draft.sections.every((s) => /\.tsx$/.test(s.componentPath)),
    "all components are .tsx (React-only)",
  );
  if (result.meta.coreDraft) {
    assert(result.meta.behaviorDrafts >= 1, "scan attached behavior drafts via core");
    const withBehavior = result.draft.sections.filter((s) => s.behavior?.whatItIs);
    assert(withBehavior.length >= 1, "section.behavior.whatItIs present");
  } else {
    console.log("  skip  behavior drafts (core helpers unavailable)");
  }
}

function testCliGraph() {
  console.log("\ncli graph (demo config)");
  const r = runCli(["graph", "--json"]);
  assert(r.status === 0, `graph --json exit 0 (stderr: ${r.stderr.slice(0, 200)})`);
  let data;
  try {
    data = JSON.parse(r.stdout);
  } catch (e) {
    assert(false, `graph json parse: ${e.message}\n${r.stdout.slice(0, 400)}`);
    return;
  }
  assert(data.nodeCount >= 6, `graph nodeCount >= 6 (got ${data.nodeCount})`);
  assert(Array.isArray(data.nodes) && data.nodes.length >= 6, "graph nodes array");
  assert(Array.isArray(data.edges), "graph edges array");
  const sharedCss = (data.edges || []).filter((e) => e.kind === "shared-css");
  assert(sharedCss.length > 0, "graph has shared-css edges");
  assert(String(data.mermaid || "").includes("graph LR"), "graph mermaid LR");

  const md = runCli(["graph", "--md"]);
  assert(md.status === 0, "graph --md exit 0");
  assert(md.stdout.includes("Section dependency graph"), "graph md title");
  assert(md.stdout.includes("```mermaid"), "graph md mermaid fence");

  const mer = runCli(["graph"]);
  assert(mer.status === 0, "graph default exit 0");
  assert(mer.stdout.includes("graph LR"), "graph default prints mermaid");
}

function testCliGraphNextDemo() {
  console.log("\ncli graph --cwd examples/next-demo");
  if (!fs.existsSync(DEMO)) {
    console.log("  skip  next-demo missing");
    return;
  }
  const r = runCli(["graph", "--cwd", DEMO, "--json"]);
  assert(r.status === 0, `graph next-demo exit 0 (stderr: ${r.stderr.slice(0, 200)})`);
  let data;
  try {
    data = JSON.parse(r.stdout);
  } catch (e) {
    assert(false, `graph next-demo json: ${e.message}`);
    return;
  }
  assert(data.nodeCount >= 6, `next-demo graph nodes >= 6 (got ${data.nodeCount})`);
  const kinds = new Set((data.edges || []).map((e) => e.kind));
  assert(kinds.has("shared-css"), "next-demo shared-css edges");
}

function testCliSpecsFromIrAndRegisterFromSpec() {
  console.log("\ncli specs-from-ir + register-from-spec");
  const tmp = path.join(CLI_ROOT, ".tmp-specs-from-ir");
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    // ignore
  }
  fs.mkdirSync(tmp, { recursive: true });
  const irPath = path.join(tmp, "ir.json");
  const ir = {
    schemaVersion: 1,
    sourceUrl: "https://example.com/",
    capturedAt: new Date().toISOString(),
    viewport: { width: 1280, height: 720 },
    sections: [
      {
        id: "hero",
        label: "Hero",
        interactionModel: "scroll",
        textSample: "Hello hero",
        styles: { background: "#111" },
      },
    ],
    tokens: { colors: [], fonts: [] },
    assets: [],
  };
  fs.writeFileSync(irPath, JSON.stringify(ir, null, 2), "utf8");

  const r = runCli([
    "specs-from-ir",
    "--ir",
    irPath,
    "--cwd",
    tmp,
    "--json",
  ]);
  assert(r.status === 0, `specs-from-ir exit 0 (stderr: ${r.stderr.slice(0, 300)})`);
  let data;
  try {
    data = JSON.parse(r.stdout);
  } catch (e) {
    assert(false, `specs-from-ir json: ${e.message}\n${r.stdout.slice(0, 400)}`);
    return;
  }
  assert(data.written?.length === 1, `wrote 1 spec (got ${data.written?.length})`);
  const heroSpec = path.join(tmp, "docs/research/components/hero.spec.md");
  assert(fs.existsSync(heroSpec), "hero.spec.md written");
  assert(fs.existsSync(path.join(tmp, "docs/research/PAGE_TOPOLOGY.md")), "topology written");
  const md = fs.readFileSync(heroSpec, "utf8");
  assert(md.includes("scroll"), "spec has interaction model");
  assert(md.includes("Hello hero"), "spec has text sample");

  const reg = runCli([
    "register-from-spec",
    "--cwd",
    tmp,
    "--spec",
    "docs/research/components/hero.spec.md",
    "--json",
  ]);
  assert(reg.status === 0, `register-from-spec exit 0 (stderr: ${reg.stderr.slice(0, 300)})`);
  let regData;
  try {
    regData = JSON.parse(reg.stdout);
  } catch (e) {
    assert(false, `register-from-spec json: ${e.message}\n${reg.stdout.slice(0, 400)}`);
    return;
  }
  assert(regData.entry?.id === "hero", "registered id hero");
  assert(
    regData.entry?.componentPath === "src/components/sections/Hero.tsx",
    "inferred Hero.tsx path",
  );
  assert(regData.entry?.behavior?.id === "hero", "behavior drafted from spec");
  assert(
    fs.existsSync(path.join(tmp, ".ctrlc/registry.json")),
    "registry.json written",
  );

  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    // ignore cleanup
  }
}

function testCliInitClone() {
  console.log("\ncli init-clone (clone-template scaffold)");
  const tmp = path.join(CLI_ROOT, ".tmp-init-clone");
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    // ignore
  }

  const r = runCli([
    "init-clone",
    tmp,
    "--url",
    "https://example.com/init-clone-test",
    "--scope",
    "page",
  ]);
  assert(r.status === 0, `init-clone exit 0 (stderr: ${r.stderr.slice(0, 300)})`);
  assert(
    fs.existsSync(path.join(tmp, "package.json")),
    "init-clone wrote package.json",
  );
  assert(
    fs.existsSync(path.join(tmp, ".ctrlc/registry.json")),
    "init-clone wrote empty registry",
  );
  assert(
    fs.existsSync(path.join(tmp, "docs/research/PAGE_TOPOLOGY.md")),
    "init-clone research PAGE_TOPOLOGY",
  );
  assert(
    fs.existsSync(path.join(tmp, "docs/research/DESIGN_TOKENS.md")),
    "init-clone research DESIGN_TOKENS",
  );
  assert(
    fs.existsSync(path.join(tmp, "docs/research/BEHAVIORS.md")),
    "init-clone research BEHAVIORS",
  );
  assert(fs.existsSync(path.join(tmp, "AGENTS.md")), "init-clone AGENTS.md");
  assert(fs.existsSync(path.join(tmp, "README.md")), "init-clone README.md");

  const readme = fs.readFileSync(path.join(tmp, "README.md"), "utf8");
  assert(
    /dual export/i.test(readme),
    "scaffold README mentions dual export",
  );
  assert(
    /HowItWorks/i.test(readme),
    "scaffold README mentions HowItWorks reference",
  );

  const reg = JSON.parse(
    fs.readFileSync(path.join(tmp, ".ctrlc/registry.json"), "utf8"),
  );
  assert(Array.isArray(reg.sections) && reg.sections.length === 0, "registry empty shell");

  const pkg = JSON.parse(fs.readFileSync(path.join(tmp, "package.json"), "utf8"));
  assert(pkg.engines?.node === ">=20", "scaffold engines node >=20");
  assert(typeof pkg.scripts?.validate === "string", "scaffold has validate script");
  assert(typeof pkg.scripts?.qa === "string", "scaffold has qa script");

  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    // ignore cleanup
  }
}

function testCliPlanParallel() {
  console.log("\ncli plan-parallel");
  const tmp = fs.mkdtempSync(path.join(path.dirname(DEMO), "CtrlC-plan-par-"));
  try {
    const specsDir = path.join(tmp, "docs", "research", "components");
    fs.mkdirSync(specsDir, { recursive: true });
    for (const id of ["hero", "features", "cta"]) {
      fs.writeFileSync(
        path.join(specsDir, `${id}.spec.md`),
        `# Section spec: \`${id}\`\n\n## Meta\n\n| Field | Value |\n|-------|--------|\n| **id** | \`${id}\` |\n`,
        "utf8",
      );
    }
    const r = runCli([
      "plan-parallel",
      "--cwd",
      tmp,
      "--format",
      "json",
      "--max-agents",
      "2",
    ]);
    assert(r.status === 0, `plan-parallel exit 0 (got ${r.status}): ${r.stderr}`);
    let data;
    try {
      data = JSON.parse(r.stdout);
    } catch (e) {
      assert(false, `plan-parallel json parse: ${e.message}\n${r.stdout.slice(0, 400)}`);
      return;
    }
    assert(data.sectionCount === 3, `sectionCount 3 (got ${data.sectionCount})`);
    assert(Array.isArray(data.sections) && data.sections.length === 3, "sections length 3");
    assert(Array.isArray(data.batches) && data.batches.length >= 2, "batches >= 2 with max-agents 2");
    assert(
      data.batches.every((b) => b.length <= 2),
      "batch size <= max-agents",
    );
  } finally {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

async function main() {
  console.log("test-cli: @ctrlc/cli smoke tests");
  console.log(`  bin: ${BIN}`);

  testScanHelpers();
  await testScanApi();
  await testCoreList();
  testCliHelp();
  testCliSchema();
  testCliListDemoConfig();
  testCliListNextDemo();
  testCliValidateStructure();
  testCliScan();
  testCliPackDescribe();
  testCliPackMultiRecipe();
  testCliGraph();
  testCliGraphNextDemo();
  testCliSnapshotNextDemo();
  testCliLibraryNextDemo();
  testCliSpecsFromIrAndRegisterFromSpec();
  testCliInitClone();
  testCliPlanParallel();
  testCliPipelineDryRun();

  console.log("");
  if (failed) {
    console.error(`test-cli: ${failed} failure(s)`);
    process.exit(1);
  }
  console.log("test-cli: all checks passed");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
