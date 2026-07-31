# Prior art: Ditto + AI Website Cloner Template

**Purpose:** Learn architecture and techniques from two MIT-licensed open-source projects and map them into CtrlC - **re-implement ideas**, do not vendor large third-party codebases.

| Project | Repo | License | Core idea |
|---------|------|---------|-----------|
| **Ditto** | [ion-design/ditto.site](https://github.com/ion-design/ditto.site) | MIT | Deterministic browser capture → render IR → **code generation without LLM page authoring** |
| **AI Website Cloner Template** | [JCodesMore/ai-website-cloner-template](https://github.com/JCodesMore/ai-website-cloner-template) | MIT | Agent skill `/clone-website`: recon → tokens → **component specs** → **parallel section builders** → QA |
| **CtrlC** | this repo | MIT | Page-first React clone **+ SectionPack dual export** (natural language + multi-file code packs) |

## Attribution policy

- Both upstream projects are **MIT**. Studying them and adapting **patterns** is fine.
- Prefer **re-implementation** in CtrlC’s architecture.
- If non-trivial code is ever copied, keep MIT notices and list files in [ATTRIBUTION.md](./ATTRIBUTION.md).
- Do **not** use either tool for phishing, impersonation, or ToS-violating capture (same responsible-use stance as both projects).

---

## Ditto (deterministic capture-to-code)

### What it is good at

| Strength | Detail |
|----------|--------|
| Determinism | Same frozen capture → byte-stable app; not “LLM invents the page” |
| Browser capture | Records what actually rendered: DOM, computed styles, boxes, fonts, assets, screenshots, interaction states, safe motion |
| Pipeline | `URL → browser capture → normalized render IR → inference → app generation → assets → optional validation` |
| Scaffold quality | Runnable Next (default) or Vite React; multi-file TypeScript app |
| Scope modes | `single` vs `multi` routes; styling `tailwind` \| `css`; framework `next` \| `vite` |
| Delivery | File map API, unpack CLI, tarball bundle, MCP tools for agents |
| Ops shape | compiler/, packages (api, worker, db, storage, cli), CI, methodology docs |

### What it is not

- Does not replay auth, payments, personalization, or arbitrary third-party JS as product logic.
- Dual export (NL brief + pack registry) is **not** its product surface.
- Hosted path may require API keys; local path needs Playwright/Chromium.

### Patterns to **steal for CtrlC** (ideas only)

1. **Capture IR** - intermediate representation of rendered page (sections, styles, assets) as a first-class artifact before generation.  
2. **Deterministic emitter** - scaffold Next app structure from IR without guessing.  
3. **`mode=single` default** - aligns with our page-first principle.  
4. **Unpack file-map** - agent-friendly “files keyed by path” output.  
5. **Optional verify** - post-generate validation pass (build + visual/fixture).  
6. **Responsible-use docs** - explicit legal/ethics section.  
7. **Compiler vs packages split** - capture/generate core separate from CLI/API.

### B6 adapter-only policy

CtrlC **does not vendor** Ditto source and **does not call** Ditto (or any
hosted capture) APIs by default. Epic B6 ships an **external capture adapter**
only:

- Input: loose file-map JSON and/or section-oriented IR from user-supplied files  
- Output: CtrlC Page IR (`schemaVersion`, sections, tokens, assets, notes)  
- CLI: `ctrlc adapt-ir --input external.json --out runs/adapted/ir.json`  
- Core: `adaptExternalCaptureToPageIR` / `writeAdaptedIr` in `@ctrlc/core`

Users who already exported artifacts elsewhere can feed our pipeline; we re-implement
ideas, not their compiler.

---

## AI Website Cloner Template (agent orchestration)

### What it is good at

| Strength | Detail |
|----------|--------|
| Agent skill | `/clone-website <url>` multi-phase foreman model |
| Spec-first | `docs/research/components/*.spec.md` with computed CSS, states, content, assets |
| Parallelism | One builder agent per section/component (often git worktrees) |
| Foundation gate | Tokens, fonts, globals, assets **before** section build |
| Interaction model rule | Scroll vs click vs hover must be identified **before** building |
| Completeness rule | Builders must not guess colors/spacing; specs carry exact values |
| Complexity budget | Split specs if too large (~150 lines heuristic) |
| Multi-agent platforms | AGENTS.md + skill sync across Claude/Cursor/Codex/etc. |
| Output | Clean Next + shadcn/Tailwind + React sections (not HTML dump as product) |

### Guiding principles (condensed)

1. Completeness beats speed in extraction.  
2. Small builder tasks → better fidelity.  
3. Real content and layered assets.  
4. Foundation first, then parallel sections.  
5. Appearance **and** behavior.  
6. Identify interaction model early.  
7. Extract every state (tabs, scroll, hover).  
8. Spec files are source of truth.  
9. Build must always compile.

### Patterns to **steal for CtrlC**

1. **Foreman skill** that walks the page and emits pack + component specs.  
2. **Parallel section builders** after foundation.  
3. **Research folder layout**: screenshots, tokens, per-section specs.  
4. **Interaction-model field** in every section brief (maps to our NL `behavior` / `motion`).  
5. **Worktree or agent isolation** for multi-section builds.  
6. **QA phase** - visual compare + `tsc`/`build`.  
7. **Page-default** when URL is a single document (skill already scopes to visible page).

---

## Side-by-side matrix

| Dimension | Ditto | AI Cloner Template | CtrlC today | Target hybrid |
|-----------|-------|--------------------|-----------------|---------------|
| Primary engine | Deterministic compiler | LLM agents + browser MCP | SectionPack + demo; cloner docs | Capture IR optional + agent rebuild + packs |
| Output | Next/Vite React app | Next React app | Next demo + packs | Same + **always** SectionPack |
| HTML dump product | No | No | No (principle) | No |
| Page vs site | single / multi | URL list / page focus | page default | **page default**, site optional |
| Specs | Implicit in IR | Explicit markdown specs | Behavior briefs + config | Specs + packs |
| Dual export NL + code | No | No | **Yes** | **Yes (differentiator)** |
| Parallel build | Compiler pipeline | Agent worktrees | Multi-pack parallel | Both layers |
| Capture fidelity | Very high (render IR) | High if browser MCP used | Manual/agent | Prefer Ditto-like capture when available |
| Consistency | Byte-stable | Varies by model | Stable packs | Capture locks fidelity; agents refine |

---

## Hybrid architecture (CtrlC-native)

```text
                    +---------------------------+
                    |  scope=page (default)     |
                    |  or site / section        |
                    +-------------+-------------+
                                  |
          +-----------------------+-----------------------+
          |                                               |
          v                                               v
 +--------------------+                         +----------------------+
 | Path A: Capture    |                         | Path B: Agent recon  |
 | (Ditto-inspired)   |                         | (Cloner-inspired)    |
 | browser → IR       |                         | screenshots, tokens, |
 | assets, styles     |                         | interaction sweep    |
 +---------+----------+                         +----------+-----------+
           |                                               |
           +-------------------+---------------------------+
                               v
                    +---------------------------+
                    |  Unified Section Plan     |
                    |  topology + tokens +      |
                    |  per-section specs        |
                    +-------------+-------------+
                                  |
                    +-------------v-------------+
                    |  Foundation               |
                    |  tokens, fonts, assets,   |
                    |  Next scaffold + packs    |
                    +-------------+-------------+
                                  |
                    +-------------v-------------+
                    |  Parallel section build   |
                    |  React components only    |
                    +-------------+-------------+
                                  |
                    +-------------v-------------+
                    |  Register SectionPack     |
                    |  config + NL brief +      |
                    |  boundaries + API         |
                    +-------------+-------------+
                                  |
                    +-------------v-------------+
                    |  QA                       |
                    |  build, validate, drift,  |
                    |  optional visual check    |
                    +---------------------------+
```

### Where natural language sits

| Stage | NL role |
|-------|---------|
| After recon / IR | Draft brief fields (motion, interaction model, layout) |
| After component build | Enrich from source analysis (`draftBehaviorBrief`) |
| Runtime | User copies **Natural language** or **Code as-is** |
| Library export | `NATURAL_LANGUAGE.md` + `CODE_PACK.md` per section |

### Ideal generated app folder structure

```text
my-clone/   # or CtrlC create output
  src/
    app/
      page.tsx                 # composed sections only
      layout.tsx               # SectionPackProvider
      api/dev/section-pack/    # createSectionPackGET
      dev/packs/               # catalog
    components/
      sections/                # one React module per section
      shared/                  # Reveal, shells
    content/                   # typed content modules
    styles/                    # tokens + section CSS
    lib/
      section-pack-config.ts   # SectionPackConfig
  public/
    images/ videos/ seo/
  docs/
    research/                  # recon artifacts (not product runtime)
      PAGE_TOPOLOGY.md
      DESIGN_TOKENS.md
      components/*.spec.md
    design-references/         # screenshots
  .ctrlc/
    snapshots/                 # contentHash baselines
  package.json
  AGENTS.md                    # handoff for agents
```

**Not product output:** mirrored `index.html` site trees as the runnable app.

---

## What CtrlC already has (keep)

- SectionPack dual export  
- Config-first registry, recipes, variables  
- CLI: pack, multi, scan, graph, library, snapshot, watch, drift  
- Auto-draft briefs from sources  
- Docs scaffold (guide / concepts / reference / workflows)  
- Northline React demo  

## Gaps vs prior art (fill via backlog)

| Gap | Source of idea | CtrlC work |
|-----|----------------|----------------|
| Capture IR pipeline | Ditto | Optional capture package / Playwright capture → IR |
| Spec files as contracts | AI Cloner | `docs/research/components/*.spec.md` + skill phase |
| Parallel builder orchestration | AI Cloner | Skill + worktree/agent dispatch |
| Foundation gate automation | Both | Scaffold + token extract step |
| Visual QA | Both | Optional screenshot diff |
| MCP/API for clone jobs | Ditto | Later; CLI first |
| Responsible-use doc | Both | docs/guide/responsible-use.md |

---

## References

- Ditto: https://github.com/ion-design/ditto.site  
- AI Website Cloner Template: https://github.com/JCodesMore/ai-website-cloner-template  
- Local study copy of template patterns: `altahq-clone` (generated site; template skill under `.claude/skills/clone-website`)  

See [ATTRIBUTION.md](./ATTRIBUTION.md) and implementable [backlog](../backlog/CLONE_PIPELINE_BACKLOG.md).
