---
name: ctrlc-clone
description: Extract reusable UI sections from a public page into React/Next components with SectionPack dual export (natural language briefs + multi-file code packs). Recreation guidance, not HTML dumps or guaranteed pixel-perfect full-site clones. Default scope is a single page.
argument-hint: "<url> [--scope=page|site|section] [--out dir]"
user-invocable: true
---

# CtrlC - Section extract and rebuild

Turn **$ARGUMENTS** into **reusable React sections** with **SectionPack** dual export and clear recreation guidance.

## Positioning (never break this)

| Lead with | Do not promise |
|-----------|----------------|
| **React section packs** (dual export) | Full website creation |
| **Recreation guidance** (specs + describe + prompt packs) | Pixel-perfect full-page mirror |
| Multi-file **React** packs | HTML scraping / CSS dump as the product |
| Local-first rebuild you control | Bypassing auth / ToS |

Monorepo demos are **Northline** only. Do not commit third-party product rebuilds into the CtrlC repo.
**Rights:** Only run on public pages the user may analyze (own site, permission, or lawful research). See monorepo `docs/guide/responsible-use.md`.

## Product rules

| Rule | Meaning |
|------|---------|
| **Not HTML** | Output is React + content + CSS - never wget/HTML mirror as the app |
| **Sections first** | Isolate hero, pricing, nav, FAQ, etc.; full page is assembly of sections |
| **Page default** | `scope=page` unless user asks for full site or one section |
| **Dual export** | Every section: **Natural language** (`describe`) + **Code as-is** (`prompt`/zip) |
| **Register always** | After each section builds → `ctrlc register` |
| **Spec first** | Write `docs/research/components/<id>.spec.md` before builders |
| **Fidelity ladder** | Structure → content → visual pass. Capture ≠ pixels. |
| **Build must pass** | `ctrlc qa --cwd .` (use `--skip-build` while `npm run dev` runs) |

Inspired by open patterns from [AI Website Cloner Template](https://github.com/JCodesMore/ai-website-cloner-template) and [Ditto](https://github.com/ion-design/ditto.site) - **re-implement in CtrlC**, do not vendor their code.

## Pre-flight

1. Parse URL(s) and optional flags: `--scope=page|site|section`, `--out <dir>`.
2. Confirm rights / responsible use with the user if the URL is a third-party commercial site.
3. Prefer browser automation (Playwright) for recon. If none, use screenshots or provided notes.
4. Create or open the host app:

```bash
# From CtrlC monorepo root (preferred)
npm run build
ctrlc init-clone <out-dir> --url <url> --scope page
cd <out-dir> && npm install
```

Empty host: `examples/clone-template/`.

5. Verify scaffold builds: `npm run build` in the target project.

## Fidelity ladder (honest)

| Stage | Done when |
|-------|-----------|
| **1. Structure** | Topology, section ids, `SectionBoundary`, dual export works |
| **2. Content** | Real copy, CTAs, lists, key assets in content modules |
| **3. Visual pass** | Tokens, layout, motion closer to reference (agent/manual polish) |

Do **not** declare “pixel-perfect” after scaffold or IR alone. Schedule an explicit visual pass if the user wants fidelity.

## Phases

### Phase 0 - Init (SectionPack wired)

- [ ] App via `ctrlc init-clone` (or `examples/clone-template`)
- [ ] `.ctrlc/clone-meta.json` has source URL + scope
- [ ] `SectionPackProvider` + API; prefer `catalogHref="/dev/packs"`
- [ ] Research dirs under `docs/research/`

### Phase 1 - Recon (page-first)

1. Screenshots desktop 1440 + mobile 390 → `docs/design-references/`
2. Interaction sweep → `docs/research/BEHAVIORS.md`
3. Topology top→bottom → `docs/research/PAGE_TOPOLOGY.md` with **INTERACTION MODEL** per section
4. Tokens/fonts → `docs/research/DESIGN_TOKENS.md` (semantic `--ts-*`; skill `ctrlc-design-tokens`)

### Phase 1.5 - Capture IR (optional)

```bash
ctrlc capture <url> --out runs/<host>/
# or: ctrlc capture <url> --cwd . --out .ctrlc/capture/
```

Artifacts: Page IR, optional assets, `screenshot.png`. Capture **augments** recon; it does not replace React rebuild or registration.

| Step | Command | Purpose |
|------|---------|---------|
| Materialize assets | pipeline / materialize-assets | Local image paths |
| Tokens | `ctrlc tokens-from-ir` | Curated `--ts-*` roles |
| Specs | `ctrlc specs-from-ir` | Section contracts |
| Baseline | `ctrlc baseline` | F2 screenshot baseline |

### Phase 2 - Foundation

1. Fonts + CSS variables from tokens  
2. Content types  
3. Assets under `public/`  
4. `npm run build` green  

### Phase 3 - Specs then build + register

#### Specs

- Template: monorepo `docs/templates/section.spec.md`  
- Path: `docs/research/components/<id>.spec.md`  
- Include INTERACTION MODEL, content, assets, states  

```bash
ctrlc specs-from-ir --ir <ir> --out docs/research/components/
```

#### Build one section

Use `docs/templates/section-builder.prompt.md`:

- Component under `src/components/sections/`  
- Content in `src/content/`  
- **No HTML dump**  
- Wrap with `SectionBoundary`  

#### Register (mandatory)

```bash
ctrlc register <id> --cwd . \
  --component src/components/sections/<Name>.tsx \
  --export <Name> \
  --content-module src/content/home.ts \
  --content-key <key> \
  --css src/styles/app.css \
  --selector .<class> \
  --interaction <static|click|scroll|hover|time|hybrid> \
  --from-spec docs/research/components/<id>.spec.md
```

#### Verify dual export

```bash
ctrlc pack <id> --format describe --cwd .
ctrlc pack <id> --format prompt-short --cwd .
```

Parallel builders only after every id has a spec: `ctrlc plan-parallel --cwd .`

### Phase 4 - Assembly

- `page.tsx` order matches topology  
- Recipes from registry when useful  
- Page is a **composition of sections**, not a scraped shell  

### Phase 5 - QA

```bash
ctrlc qa --cwd .
# iterating with dev server:
ctrlc qa --cwd . --skip-build
ctrlc list --cwd .
```

Optional visual pass: compare baselines section-by-section; fix from specs.

## Completion report

- Sections built + registered (ids)  
- Dual export smoke (describe + prompt)  
- Fidelity stage reached (structure / content / visual)  
- Rights note (user-owned / permitted URL)  
- Known gaps (honest)  
- `ctrlc qa` result  

## Anti-patterns

- HTML mirror as the app  
- Leading with “full website clone” / pixel-perfect claims after scaffold only  
- Specs skipped; sections not registered  
- Building click UI for scroll-driven originals  
- Full-site crawl when user asked for one page  
- Using third-party brands/logos in a public product without rights  

## Commands cheat sheet

```bash
ctrlc init-clone ../sections --url https://example.com
ctrlc capture <url> --out runs/<host>/
ctrlc tokens-from-ir --ir runs/<host>/ir.json --cwd .
ctrlc specs-from-ir --ir <ir> --out docs/research/components/
ctrlc plan-parallel --cwd .
ctrlc register <id> --cwd . --component ... --from-spec ...
ctrlc pack <id> --format describe --cwd .
ctrlc pack <id> --format prompt-short --cwd .
ctrlc qa --cwd . --skip-build
ctrlc library --cwd .
```

## Templates

| File | Use |
|------|-----|
| `docs/templates/section.spec.md` | Spec contract before build |
| `docs/templates/section-builder.prompt.md` | One-section builder prompt |
| `docs/templates/parallel-build.md` | Parallel builders |
| `docs/templates/AGENTS.clone.md` | Generated app agent notes |
| `examples/clone-template/` | Empty SectionPack host |

## Path to quality

CtrlC is **0.1.x MVP** until distribution and eval baselines land. After real runs:

1. Record metrics (fix-up minutes, structure score, qa / dual-export gates) - see `docs/eval/README.md` and `docs/eval/AGENT_EVAL.md`.
2. Prefer scoring with `node scripts/eval/score-case.mjs --case docs/eval/cases/<id>/case.json --cwd <project> --out docs/eval/results/<id>.json`.
3. Track version line and publish readiness via `docs/roadmap/PATH_TO_1.0.md` (also `VERSIONING.md`, `DISTRIBUTION.md`).

Parallel builders still need **human review** on 0.1.x. Do not claim 1.0 quality from scaffold or IR alone.
