# Backlog: hybrid clone pipeline + SectionPack

Implementable backlog derived from studying **Ditto** (deterministic capture) and **JCodesMore/ai-website-cloner-template** (agent orchestration), adapted to CtrlC.

**Status key:** `todo` | `doing` | `done` | `wont`

**Priority:** P0 critical path · P1 high · P2 nice · P3 later

---

## Epic A - Documentation and process (foundation for agents)

| ID | Item | Pri | Status | Notes |
|----|------|-----|--------|-------|
| A1 | Prior-art research doc | P0 | **done** | `docs/research/PRIOR_ART.md` |
| A2 | Attribution + MIT policy | P0 | **done** | `docs/research/ATTRIBUTION.md` |
| A3 | Hybrid pipeline workflow | P0 | **done** | `docs/workflows/hybrid-clone-pipeline.md` |
| A4 | This backlog | P0 | **done** | this file |
| A5 | Responsible use guide | P1 | **done** | `docs/guide/responsible-use.md` |
| A6 | Component spec template | P0 | **done** | `docs/templates/section.spec.md` |
| A7 | CtrlC clone skill draft | P0 | **done** | `.claude/skills/ctrlc-clone/SKILL.md` |
| A8 | AGENTS.md for generated apps | P1 | **done** | `docs/templates/AGENTS.clone.md` + init-clone |

---

## Epic B - Capture IR (Ditto-inspired, re-implemented)

| ID | Item | Pri | Status | Notes |
|----|------|-----|--------|-------|
| B1 | Define Page IR schema v0 | P0 | **done** | `PageIR` in `packages/capture/src/ir.ts` + compatible types in `packages/core/src/ir-to-specs.ts` (sections-first v0) |
| B2 | Playwright capture prototype | P0 | **done** | `packages/capture` + `ctrlc capture` (`capturePage`, optional playwright peer; page scope) |
| B3 | IR → topology mapper | P1 | **done** | `writeTopologyFromIR` + `ctrlc specs-from-ir` (ordered table; capture heuristics still open) |
| B4 | Asset materialization | P1 | **done** | `materializeAssets` + `ctrlc materialize-assets`; capture hook `materializeAssets: true` |
| B5 | Token extraction from IR | P1 | **done** | `extractTokensFromIR` / `writeTokensFromIR` + `ctrlc tokens-from-ir` |
| B6 | Optional Ditto API adapter | P3 | **done** | Adapter-only: `adaptExternalCaptureToPageIR` + `ctrlc adapt-ir` convert external file-map / section JSON → Page IR. **No** Ditto network calls, **no** vendored source |
| B7 | Capture fixtures + tests | P1 | **done** | `packages/capture/fixtures/sample-page.html` + `sample-ir.json`; `scripts/test-ids.mjs` + `test-ir.mjs` + `test-materialize.mjs` |

**Exit A+B:** `ctrlc capture <url> --out runs/<host>/` produces IR + assets without claiming to be Ditto.

---

## Epic C - Specs and agent build (Cloner-inspired)

| ID | Item | Pri | Status | Notes |
|----|------|-----|--------|-------|
| C1 | Spec writer from IR or browser notes | P0 | **done** | `writeSectionSpecsFromIR` + `ctrlc specs-from-ir` |
| C2 | Interaction model enum in specs | P0 | **done** | scroll / click / hover / time / hybrid in template + IR |
| C3 | Multi-state extraction checklist | P1 | **done** | Default/hover/focus/active/open/loading/error/scrolled/reduced-motion + 390/768/1440 in `section.spec.md`; builder prompt multi-state verification |
| C4 | Foundation scaffolder | P0 | **done** | `ctrlc init-clone` |
| C5 | Parallel section builder prompts | P0 | **done** | Templates + `buildParallelPlan` / `ctrlc plan-parallel` (json\|md\|sh); worktrees optional, documented only |
| C6 | Complexity budget linter | P2 | **done** | `checkSpecBudget` (maxLines 400 / maxChars 40000) |
| C7 | Merge/QA checklist automation | P1 | **done** | `ctrlc qa --cwd` |

**Exit C:** Agent can follow skill and produce React sections + specs without HTML dump product.

---

## Epic D - SectionPack always-on (differentiator)

| ID | Item | Pri | Status | Notes |
|----|------|-----|--------|-------|
| D1 | Dual export NL + code | P0 | **done** | core + react + next + cli |
| D2 | Register section on build | P0 | **done** | `ctrlc register` + registry merge |
| D3 | Spec → behavior brief bridge | P0 | **done** | `behaviorFromSpec` / `parseSpecMarkdown` |
| D4 | Auto-draft from sources | P0 | **done** | analyze-section + draft-brief |
| D5 | Scan bootstrap | P0 | **done** | ctrlc scan |
| D6 | Library export | P0 | **done** | ctrlc library |
| D7 | Graph of multi-file influences | P1 | **done** | ctrlc graph |
| D8 | Snapshot / drift CI | P1 | **done** | snapshot + check:drift |
| D9 | Pack HUD + catalog | P1 | **done** | react + next catalog |
| D10 | Emit config from IR sections automatically | P1 | **done** | `registryFromIR` / `writeRegistryFromIR` + `ctrlc register-from-ir` |
| D11 | Recipe inference from topology order | P2 | **done** | `inferRecipesFromIR` → `landing-core` (+ `landing-full` when >6 sections) |
| D12 | Visual pack preview in catalog | P3 | **done** | thumbs + preview drawer; `previewUrl` from public/ctrlc-previews + entry fields |

**Exit D:** Every generated section has boundary + config + describe + prompt without manual glue.

---

## Epic E - Scaffold and DX

| ID | Item | Pri | Status | Notes |
|----|------|-----|--------|-------|
| E1 | create-ctrlc-app | P0 | **done** | scripts/create-ctrlc-app.mjs |
| E2 | Clone-ready template package | P1 | **done** | `examples/clone-template` empty host + research stubs + registry merge |
| E3 | `ctrlc init-clone` | P1 | **done** | Wires research + skill + registry |
| E4 | Node 24 engine note + nvmrc | P2 | **done** | engines `>=20`, `.nvmrc` / `.node-version` pin `20` |
| E5 | Docker compose for demo | P3 | **done** | Root `docker-compose.yml` + `examples/next-demo/Dockerfile` multi-stage (node 20, port 3040); `.dockerignore`; `npm run docker:demo`; docs in root README + next-demo README. Not required for CI/`npm test` |

---

## Epic F - Quality and fidelity

| ID | Item | Pri | Status | Notes |
|----|------|-----|--------|-------|
| F1 | Build always compiles gate | P0 | **done** | demo build + CI + `ctrlc qa` + skill |
| F2 | Screenshot baseline capture | P1 | **done** | Capture writes `screenshot.png`; `ctrlc baseline --ir|--url` → `docs/research/baselines/<host>-page.png` |
| F3 | Optional visual diff | P2 | **done** | `comparePngFiles` + `ctrlc visual-diff`; optional peers pngjs + pixelmatch |
| F4 | Responsive breakpoint matrix | P2 | **done** | `DEFAULT_BREAKPOINTS` + `defaultResponsiveRows` / `ensureResponsiveMatrix` in `ir-to-specs`; specs always write 390 / 768 / 1440; qa warns if missing |
| F5 | Reduced-motion notes in briefs | P2 | **done** | `draftBehaviorBrief` / `behaviorFromSpec` / analyze always include prefers-reduced-motion note in motion or a11y |

---

## Epic G - Distribution (optional)

| ID | Item | Pri | Status | Notes |
|----|------|-----|--------|-------|
| G1 | Public GitHub polish | P2 | **done** | README feature map + badges; CONTRIBUTING; SECURITY; CHANGELOG; demo catalog preview SVGs; docs hub + CLI pipeline section; CI workflow. Real animated GIF still optional |
| G2 | npm publish packages | P3 | todo (partial) | `files` + `license` + `prepublishOnly` on packages; `publishConfig.access=public`; root `CHANGELOG.md` stub v0.1.0. Full publish when API stable |
| G3 | MCP server for pack tools | P3 | **done** (MVP) | `@ctrlc/mcp` stdio JSON-RPC: list/pack/validate/library_summary/doctor; packs first not full clone |

---

## Suggested implementation order (sprints)

### Sprint 1 - Agent-ready clone skill (P0)

1. A6 section spec template  
2. A7 ctrlc-clone skill (phases A-F from hybrid pipeline)  
3. C4 foundation scaffolder / init-clone  
4. D2 register helper  
5. D3 spec → behavior brief mapping  
6. F1 skill enforces `build` + `validate`  

### Sprint 2 - Capture path (P0/P1) - **landed**

1. B1 IR schema - done  
2. B2 Playwright single-page capture - done  
3. B4 assets - done (`materialize-assets`)  
4. B5 tokens - done (`tokens-from-ir`)  
5. C1 spec writer from IR - done  
6. D10/D11 registry + recipes from IR - done (`register-from-ir`)  

### Sprint 3 - Parallelism + QA (P1) - **mostly landed**

1. C5 parallel builder prompts / script - done (`ctrlc plan-parallel`; worktrees optional)  
2. C7 `ctrlc qa` - done  
3. F2 screenshot baselines - done (`baseline`)  
4. E2 clone-template example - done  

### Sprint 4 - Optional power-ups (P2+) - **mostly landed**

1. B6 external capture adapter (file-map → IR) - done (`adapt-ir`, adapter only)  
2. F3 visual diff - done (`visual-diff`)  
3. F4/F5 responsive + reduced-motion - done  
4. C5 plan-parallel script - done  
5. G1 public launch kit - partial (badges, CONTRIBUTING, doctor, pipeline)  
6. `ctrlc pipeline` + `ctrlc doctor` - done  

### Sprint 5 - Remaining optional (P3) - **mostly landed**

1. B6 external capture / file-map adapter - **done** (`ctrlc adapt-ir`)  
2. D12 visual pack preview - **done** (catalog thumbs + drawer)  
3. E5 Docker compose - **done** (`npm run docker:demo`)  
4. G2 npm publish - partial (metadata + CHANGELOG; not published)  
5. G3 MCP server for packs - **done** (`@ctrlc/mcp`)  
6. CI + pack-multi --recipe - **done**  

Still later: real GIF/screenshots, Playwright e2e in CI, npm publish, hosted Ditto HTTP client only if useful.


---

## Acceptance criteria (definition of done for hybrid MVP)

A user can run (conceptually):

```text
ctrlc init-clone --url https://example.com --scope=page
# capture or agent recon fills docs/research + IR
# agents build sections in parallel from specs
ctrlc validate --cwd .
ctrlc library --cwd .
npm run dev
```

Then:

- [x] App is **React components**, not HTML mirror  
- [x] One page route works  
- [x] Every section has `SectionBoundary` + config id  
- [x] Natural language copy works  
- [x] Code as-is pack works  
- [x] `npm run build` passes  

(Demo: `examples/next-demo`. Clone host: `init-clone` / `examples/clone-template`.)

---

## Mapping: backlog → upstream idea

| Backlog | Upstream |
|---------|----------|
| Epic B capture IR | Ditto compiler pipeline |
| Epic C specs + parallel builders | AI cloner skill |
| Epic D packs | CtrlC original |
| Page default | Both (`single` / single URL) |
| Responsible use | Both |

---

## Out of scope (explicit)

- Vendoring Ditto or JCodesMore source trees into packages  
- Claiming pixel-perfect on sites you do not have rights to  
- Replaying authenticated product backends as “clone complete”  
