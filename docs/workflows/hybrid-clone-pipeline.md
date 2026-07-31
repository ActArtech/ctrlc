# Hybrid clone pipeline (Ditto-inspired + agent-inspired)

CtrlC’s recommended end-to-end flow combines:

1. **Deterministic capture / recon artifacts** (Ditto-style thinking)  
2. **Spec-driven parallel React rebuild** (AI cloner template-style)  
3. **SectionPack dual export** (CtrlC differentiator)

## Modes

| Flag | Behavior |
|------|----------|
| `--scope=page` | **Default.** One URL → one route → sections |
| `--scope=site` | Multi-route after page quality is good |
| `--scope=section` | One section pack focus |

## Stages

### A. Capture or recon (choose path)

**Path A - Capture IR (Ditto-inspired, preferred when available)**

- Browser render capture (DOM, computed styles, assets, screenshots)  
- Normalize into a **Page IR** JSON (CtrlC-owned schema)  
- Materialize assets under `public/` (or capture `assets/`)  

After capture, download remote `assets[]` with stable names and set `localPath`:

```bash
# Standalone (default out: <cwd>/public/ctrlc-assets)
ctrlc materialize-assets --ir runs/example.com/ir.json

# Or during capture
ctrlc capture https://example.com --out runs/example.com
# library: capturePage(url, { outDir, materializeAssets: true }) -> outDir/assets/
```

`@ctrlc/capture` exports `materializeAssets`, `stableAssetFilename`, and `materializeAssetsFromFile`. Failures are per-asset (IR still gets planned `localPath`).

**Path B - Agent recon (AI cloner-inspired)**

- Browser MCP screenshots + interaction sweep  
- Token extraction  
- Write `docs/research/*` notes  

**Path C - External capture adapter (B6, optional)**

If you already have a third-party capture artifact (generic file-map JSON or
section-oriented IR from another tool), convert it to CtrlC Page IR
without calling proprietary APIs:

```bash
# Explicit out path
ctrlc adapt-ir --input path/to/external.json --out runs/adapted/ir.json

# Default: docs/research/adapted-ir.json (or .ctrlc/adapted-ir.json)
ctrlc adapt-ir --input file.json --cwd project

# Then continue the normal IR pipeline
ctrlc pipeline --ir runs/adapted/ir.json --cwd .
# or step-by-step:
ctrlc specs-from-ir --ir runs/adapted/ir.json --cwd .
```

Core helpers: `adaptExternalCaptureToPageIR`, `loadExternalCapture`,
`writeAdaptedIr` in `@ctrlc/core`. This is **adapter only** (shape
normalization + heuristics). It does not vendor Ditto source or call hosted
capture APIs by default.

Either path must feed stage B.

### B. Unified section plan

Produce:

- `PAGE_TOPOLOGY.md` - ordered sections + interaction models  
- `DESIGN_TOKENS.md` - colors, type, spacing  
- Per section: `docs/research/components/<id>.spec.md`  

Each spec includes:

- Structure  
- Content (real text)  
- Computed styles (or IR-derived values)  
- **Interaction model** (scroll / click / hover / time)  
- States (default, hover, active, scrolled)  
- Assets (local paths)  
- Draft **behavior brief** fields for SectionPack  

#### Capture IR → specs → register (CLI)

```bash
# 0) Optional: produce Page IR (scope=page; needs playwright peer)
ctrlc capture https://example.com --out runs/example.com

# 1) Emit section contracts from IR (also updates PAGE_TOPOLOGY.md)
ctrlc specs-from-ir --ir runs/example.com/ir.json --cwd .

# 2) After React section exists (or to pre-register paths), register from spec
ctrlc register-from-spec --cwd . --spec docs/research/components/hero.spec.md
```

What this does:

| Step | Output | SectionPack role |
|------|--------|------------------|
| `specs-from-ir` | `docs/research/components/<id>.spec.md` | Fills id, label, interaction model, text sample, rebuild guidance (React only + register packs) |
| `specs-from-ir` | `docs/research/PAGE_TOPOLOGY.md` | Ordered section table from IR |
| `register-from-spec` | `.ctrlc/registry.json` | Id from filename/Meta; component path `src/components/sections/<Pascal>.tsx`; behavior via `behaviorFromSpec` / IR bridge |

Core helpers (for tools/skills): `writeSectionSpecsFromIR`, `behaviorFromIRSection`, `writeTopologyFromIR` in `@ctrlc/core`.  

### C. Foundation (blocking)

- Next scaffold (or `CtrlC create`)  
- Wire `@ctrlc/react` + API route  
- Global tokens / fonts  
- Empty `section-pack-config.ts`  
- `npm run build` green  

### D. Parallel section build

For each section in topology:

1. Builder gets **only** that section’s spec + assets + tokens  
2. Emits React component + content keys + CSS  
3. `tsc` clean for the package/app  
4. Append config entry + `SectionBoundary`  
5. Optional: auto `draftBehaviorBrief` from sources  

Complexity budget: split oversized sections into child components + parent shell.

### E. Pack registration (always)

```ts
// every section
{
  id, label, paths, selectors, tags, promptRole,
  behavior: { /* from spec + auto-draft */ }
}
```

Recipes from page order (`landing-core`, etc.).

### F. QA

```bash
npm run build
ctrlc validate --cwd .
ctrlc list --cwd .
ctrlc snapshot --cwd .   # pack/config baselines
# packs ON: copy NL + code for smoke sections
# optional visual QA vs screenshots
```

#### Screenshot baselines (F2)

Capture writes a full-page PNG as `screenshot.png` under the capture outDir
(also `screenshots/full.png`). Promote it into the host app for visual QA:

```bash
# From an existing capture run (no Playwright needed if screenshot exists)
ctrlc baseline --ir runs/example.com/ir.json --cwd .

# Or capture + copy in one step (needs Playwright)
ctrlc baseline --url https://example.com --cwd .
```

Default destination: `docs/research/baselines/<host>-page.png` (override with `--out`).
Compare rebuilt pages against these baselines section-by-section during QA.

Optional pixel diff (F3) after you have a rebuilt full-page screenshot:

```bash
# Needs optional peers once: npm i -D pngjs pixelmatch
ctrlc visual-diff \
  --baseline docs/research/baselines/example.com-page.png \
  --candidate runs/rebuild/screenshot.png \
  --out runs/rebuild/diff.png \
  --max-ratio 0.01
```

Exit code is 1 when the differing-pixel ratio exceeds `--max-ratio` (default 1%).
Core API: `comparePngFiles` from `@ctrlc/core` (graceful install hint if peers missing).

#### Multi-state notes (C3)

When filling section specs, complete the multi-state checklist in
`docs/templates/section.spec.md` (default, hover, focus, active, open/closed,
loading, error, scrolled, reduced motion, breakpoints 390/768/1440). Put extra
observations in the spec notes / behavior fields so builders do not invent states.

### G. Export

- Runtime inspector: Natural language / Code as-is  
- `ctrlc library` for offline agent bags  
- `ctrlc graph` for multi-file influence map  

## Output layout (canonical)

```text
my-clone/
  src/app/page.tsx
  src/app/layout.tsx
  src/app/api/dev/section-pack/route.ts
  src/components/sections/
  src/content/
  src/styles/
  src/lib/section-pack-config.ts
  public/{images,videos,seo}/
  docs/research/
  .ctrlc/snapshots/
  AGENTS.md
```

## Non-goals

- Shipping HTML mirrors as the runnable product  
- Replaying private APIs / auth / payments  
- Brand impersonation  

## Implementation status

| Stage | Status in repo |
|-------|----------------|
| SectionPack dual export | **Done** |
| Config, CLI, library, graph, drift | **Done** |
| Spec template + IR → specs CLI | **Done** (`specs-from-ir`, `register-from-spec`, core `ir-to-specs`) |
| Cloner skill wired to packs | **Done** (`.claude/skills/ctrlc-clone`) |
| Capture IR package (Playwright) | **Done** (`@ctrlc/capture` + `ctrlc capture`) |
| Capture fixtures + IR tests | **Done** (`packages/capture/fixtures`, `test-ir.mjs`) |
| Screenshot baselines (F2) | **Done** (module `packages/cli/src/baseline.mjs`; parent wires CLI) |
| Parallel builders | **Done** (templates + `ctrlc plan-parallel`; worktrees optional) |
| Multi-state checklist (C3) | **Done** (section.spec.md States) |
| Visual diff (F3) | **Done** (`ctrlc visual-diff` + core `comparePngFiles`; optional peers pngjs + pixelmatch) |

See [CLONE_PIPELINE_BACKLOG.md](../backlog/CLONE_PIPELINE_BACKLOG.md).
