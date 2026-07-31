---
name: ctrlc-clone
description: Reverse-engineer a web page (or site) into React/Next components with SectionPack dual export - natural language briefs + multi-file code packs. Use for CtrlC clone, rebuild page as React, pixel-perfect page clone, never HTML dumps. Default scope is a single page.
argument-hint: "<url> [--scope=page|site|section] [--out dir]"
user-invocable: true
---

# CtrlC Clone

Rebuild **$ARGUMENTS** as a **React/Next** app with **SectionPack** registered on every section.

## Product rules (never break these)

| Rule | Meaning |
|------|---------|
| **Not HTML** | Output is React components + content modules + CSS - never wget/HTML mirror as the product |
| **Page default** | `scope=page` unless user asks for full site or one section |
| **Dual export** | Every section: **Natural language** (`describe`) + **Code as-is** (`prompt`/zip) |
| **Register always** | After each section builds → `ctrlc register` (auto SectionPack) |
| **Spec first** | Write `docs/research/components/<id>.spec.md` before dispatching builders |
| **Build must pass** | `ctrlc qa --cwd .` before declaring done |

Inspired by open patterns from [AI Website Cloner Template](https://github.com/JCodesMore/ai-website-cloner-template) (agent specs + parallel builders) and [Ditto](https://github.com/ion-design/ditto.site) (deterministic capture thinking) - **re-implement in CtrlC**, do not vendor their code.

## Pre-flight

1. Parse URL(s) and optional flags: `--scope=page|site|section`, `--out <dir>`.
2. Prefer browser automation (Playwright/Chrome MCP) for recon. If none, ask user how to capture or use provided screenshots.
3. Create or open the host app:

```bash
# From CtrlC monorepo root (preferred)
npm run build
ctrlc init-clone <out-dir> --url <url> --scope page
cd <out-dir> && npm install
```

Empty host reference (no demo sections): `examples/clone-template/`.

`init-clone` scaffolds React/Next + SectionPack provider/API + research folders + AGENTS.md + empty `.ctrlc/registry.json` + this skill.

4. Verify scaffold builds: `npm run build` in the target project.

## Phases

### Phase 0 - Init (SectionPack wired)

- [x] App exists via `ctrlc init-clone` (or copy `examples/clone-template`)
- [ ] `.ctrlc/clone-meta.json` has source URL + scope
- [ ] `SectionPackProvider` in layout; API at `/api/dev/section-pack`
- [ ] Research dirs present under `docs/research/`

### Phase 1 - Recon (page-first)

Navigate to the target URL.

1. Screenshots desktop 1440 + mobile 390 → `docs/design-references/`
2. Interaction sweep (scroll before click) → `docs/research/BEHAVIORS.md`
3. Topology top→bottom → `docs/research/PAGE_TOPOLOGY.md` with **INTERACTION MODEL** per section
4. Tokens/fonts → `docs/research/DESIGN_TOKENS.md`

### Phase 1.5 - Capture IR (optional)

When available, run deterministic capture before or alongside agent recon:

```bash
ctrlc capture <url> --out runs/<host>/
# or: ctrlc capture <url> --cwd . --out .ctrlc/capture/
```

Expected artifacts (CtrlC-owned IR, not a third-party dump):

- Page IR JSON (routes, sections, nodes, styles, assets, screenshots)
- Materialized assets under `public/` when the command supports it
- Screenshots for design references (`screenshot.png` under capture outDir)

**Downstream helpers (when wired):**

| Step | Command / tool | Purpose |
|------|----------------|---------|
| Materialize assets | (B4) assets from IR → `public/` | Stable local image/font paths |
| Tokens from IR | (B5) tokens → DESIGN_TOKENS / CSS vars | Shared foundation |
| Register from IR | `ctrlc specs-from-ir` then `register-from-spec` / `register` | Specs + SectionPack ids |
| Baseline | `ctrlc baseline --ir runs/<host>/ir.json` or `--url` | F2: `docs/research/baselines/<host>-page.png` |

If capture fails or the command is not installed, continue with Phase 1 agent recon only. Capture **augments** recon; it does not replace React rebuild or SectionPack register.

### Phase 2 - Foundation (sequential)

In the host app:

1. Fonts + CSS variables from tokens  
2. Types for content  
3. Download assets to `public/` (images/videos/seo)  
4. Icons as React components if needed  
5. `npm run build` green  

### Phase 3 - Specs (from IR when present)

#### 3-IR. Specs from IR (if capture IR exists)

If Phase 1.5 produced IR under `runs/<host>/` or `.ctrlc/capture/`:

```bash
# Prefer CLI when implemented:
ctrlc specs-from-ir --ir <path-to-ir> --out docs/research/components/
```

If the command is not available yet, map IR section candidates manually into `docs/research/components/<id>.spec.md` using monorepo `docs/templates/section.spec.md`.

Fill gaps agents still own: interaction model verification, real copy, registration block.

#### 3a. Write / finish specs

Copy template: monorepo `docs/templates/section.spec.md`  
Save as: `docs/research/components/<id>.spec.md`  

Must include **INTERACTION MODEL** and computed styles / content / assets / states.

### Phase 3 build - Spec → build → **register** (core loop)

For each section in topology order (parallelize only after every id has a spec; see `docs/templates/parallel-build.md`):

#### Build React section (one builder per id)

Use the filled agent prompt:

**`docs/templates/section-builder.prompt.md`**

Placeholders: `{{SPEC}}`, `{{SCREENSHOT}}`, `{{TARGET_FILE}}`, `{{SECTION_ID}}`.

- Component under `src/components/sections/`  
- Content keys in `src/content/`  
- Styles (shared or section CSS)  
- **No HTML dump**  
- Wrap with `SectionBoundary` id matching the spec  

Complexity budget: if spec is huge, split subcomponents.

#### Register SectionPack (mandatory)

```bash
ctrlc register <id> --cwd . \
  --component src/components/sections/<Name>.tsx \
  --export <Name> \
  --content-module src/content/home.ts \
  --content-key <key> \
  --css src/styles/demo.css \
  --selector .<class> \
  --interaction <static|click|scroll|hover|time|hybrid> \
  --from-spec docs/research/components/<id>.spec.md
```

This writes `.ctrlc/registry.json` (merged into config automatically).  
**Never skip register.** Without it, dual export does not work.

#### Boundary + page compose

```tsx
<SectionBoundary id="<id>" label="..." component="<Name>">
  <Name />
</SectionBoundary>
```

#### Verify dual export

```bash
ctrlc pack <id> --format describe --cwd .
ctrlc pack <id> --format prompt-short --cwd .
```

Both must succeed before moving on.

Dispatch parallel builders for independent sections **after** each has a spec; still **register** when each finishes. Details: `docs/templates/parallel-build.md`.

```bash
ctrlc plan-parallel --cwd .                 # md checklist
ctrlc plan-parallel --cwd . --format json   # machine plan
ctrlc plan-parallel --cwd . --format sh     # optional worktree comments (not executed)
```

### Phase 4 - Recipes + assembly

- Ensure `page.tsx` order matches topology  
- Recipes: `landing-core` / full-home via registry or config  
- Page-level scroll/snap if required by recon  

### Phase 5 - QA

```bash
ctrlc qa --cwd .
# or: ctrlc validate --cwd . && npm run build
ctrlc list --cwd .
```

Visual QA: compare screenshots section-by-section; fix from specs.

Optional:

```bash
ctrlc snapshot --cwd .
ctrlc library --cwd .
```

## Completion report

- Sections built + registered (ids)  
- Spec files written  
- Assets downloaded  
- Capture IR path used (if any)  
- `ctrlc qa` result  
- Dual export smoke (describe + prompt) for key sections  
- Known gaps  

## Anti-patterns

- HTML mirror as the app  
- Building click UI for scroll-driven originals  
- Specs skipped  
- Sections built but **not registered** (no dual export)  
- Guessing CSS instead of extracting  
- Full-site crawl when user asked for one page  

## Commands cheat sheet

```bash
ctrlc init-clone ../clone --url https://example.com
ctrlc capture <url> --out runs/<host>/     # optional Phase 1.5
ctrlc baseline --ir runs/<host>/ir.json --cwd .   # F2 screenshot baseline
ctrlc specs-from-ir --ir <ir> --out docs/research/components/  # if IR exists
ctrlc plan-parallel --cwd .              # C5 parallel build plan from specs
ctrlc register <id> --cwd . --component ... --from-spec ...
ctrlc validate --cwd .
ctrlc qa --cwd .
ctrlc pack <id> --format describe --cwd .
ctrlc pack <id> --format prompt-short --cwd .
ctrlc scan --cwd .          # draft config if many files already exist
ctrlc graph --cwd .
ctrlc library --cwd .
```

## Templates

| File | Use |
|------|-----|
| `docs/templates/section.spec.md` | Spec contract before build |
| `docs/templates/section-builder.prompt.md` | One-section builder agent prompt |
| `docs/templates/parallel-build.md` | How to dispatch multiple builders |
| `docs/templates/AGENTS.clone.md` | Generated app agent notes |
| `examples/clone-template/` | Empty SectionPack host |
