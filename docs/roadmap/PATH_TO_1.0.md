# Path to 1.0

Honest roadmap from a solid **0.1.x MVP** toward **0.5** and **1.0**.

**Positioning (non-negotiable):** CtrlC ships **React section packs** and **recreation guidance**.  
It is **not** full website creation. It is **not** HTML scraping or page mirroring as the product.

**Demos:** Monorepo demos use the fictional **Northline** brand only (`examples/next-demo`).  
Third-party rights-cleared tests stay **outside** this repo. Public docs may use `example.com` as a placeholder URL only.

Related:

- [API freeze policy](./API_FREEZE.md)
- [Distribution checklist](./DISTRIBUTION.md)
- [Versioning](./VERSIONING.md)
- [Eval harness docs](../eval/README.md)
- [Agent eval protocol](../eval/AGENT_EVAL.md)
- [Clone pipeline backlog](../backlog/CLONE_PIPELINE_BACKLOG.md) (Epic H)
- [Principles](../guide/principles.md)
- [Responsible use](../guide/responsible-use.md)

---

## Why this is still MVP

0.1.x proves the core loop locally: dual export, config-first sections, capture-to-specs pipeline, Northline demo, doctor + tests. That is enough for demos and dogfood. It is **not** enough for a 1.0 claim of production-grade public tooling.

| Gap | Why it matters | What closes it |
|-----|----------------|----------------|
| **No npm publish** | Consumers cannot depend on `@ctrlc/*` with SemVer | API freeze + `publishConfig` + first public release (see Epic G2 / H4) |
| **API instability** | Config, CLI, IR, and export flags may still shift | Freeze surface at 0.4/0.5 ([API_FREEZE.md](./API_FREEZE.md)) |
| **Capture fidelity** | Heuristics miss noisy layouts; multi-state / foundation quality varies | Real-page corpus + capture/generation quality work (priority 1 + 3) |
| **Agent reliability** | Skill / MCP / library work for demos; not systematically scored | Eval harnesses + offline library context (priority 4; [eval docs](../eval/README.md)) |
| **Zero external adoption** | No public installs, issues, or third-party hosts yet | npm + examples + GIF/video (priority 5) |
| **Polish** | GIF, Codespace, marketing copy, edge-case docs incomplete | Distribution and proof pass (priority 5) |
| **Edge cases** | Auth walls, heavy SPA shells, unusual CSS, a11y, perf | Hardening band before 1.0 (priority 6) |

None of these gaps mean the product is fake. They mean **0.1.x is intentionally local-first** until the path below is walked.

---

## Priority order (do this sequence)

Work in this order. Skipping earlier rungs weakens later ones.

| # | Theme | Outcome |
|---|--------|---------|
| 1 | **Prove core loop on real pages** | 8-12 **rights-cleared** pages (outside monorepo). Metrics: first-pass compile %, visual similarity, time-to-pack, human fix-up |
| 2 | **Lock public API surface** | `SectionPackConfig`, stable export formats, CLI command groups + versioning + first npm publish of `@ctrlc/*` |
| 3 | **Raise capture + generation quality** | Better heuristics, multi-state fidelity, foundation gate before parallel builds |
| 4 | **Agent experience** | Skill polish, MCP expand, eval harnesses, library as offline context |
| 5 | **Distribution and proof** | npm consumers, 2-3 before/after examples, GIF/video, Codespace optional |
| 6 | **Hardening for 1.0** | Tests, doctor, changelog discipline, perf, a11y |

### Priority 1 - Prove core loop

- Build a **private corpus** of 8-12 pages you have rights to analyze (or original fixtures). Do **not** commit third-party product clones into this monorepo.
- Instrument metrics (see [eval harness](../eval/README.md)):
  - **First-pass compile %** - share of sections/apps that `npm run build` without manual edits
  - **Visual similarity** - baseline vs rebuild (optional `visual-diff` / human rubric)
  - **Time-to-pack** - capture → registered pack / describe+prompt ready
  - **Human fix-up** - minutes or edits until acceptable structure/content/visual pass
- Success: metrics are **measured and repeatable**, not vibes. Northline remains the in-repo golden path.

### Priority 2 - Lock public API + npm

- Freeze what ships as stable for first publish (details in [API_FREEZE.md](./API_FREEZE.md)).
- Version packages under `@ctrlc/*` with coordinated pre-1.0 SemVer.
- Publish only after freeze doc + changelog + doctor/tests green. This roadmap does **not** publish packages itself.

### Priority 3 - Capture + generation quality

- Improve section heuristics, hygiene, ids, and text extraction on messy real pages.
- Multi-state: hover/focus/open/loading/error/reduced-motion reflected in specs and briefs, not only checklists.
- **Foundation gate**: tokens, layout shell, registry, and build must be green before parallel section agents fan out.

### Priority 4 - Agent experience

- Keep `ctrlc-clone` skill aligned with pipeline reality.
- Expand MCP tools beyond pack list/validate where evals justify it.
- Eval harnesses and library export as **offline context** for agents ([eval docs](../eval/README.md)).

### Priority 5 - Distribution and proof

- npm install path documented for external hosts.
- 2-3 **before/after** examples (structure → dual export; use Northline + original or rights-cleared material).
- Short GIF or video of pack HUD / dual export.
- GitHub Codespace optional, not a gate.

### Priority 6 - Hardening for 1.0

- Broader unit/integration coverage; CI gates that match claims.
- `ctrlc doctor` remains the health check; expand only when it catches real failures.
- Changelog discipline; perf budgets where packs or capture regress; a11y notes in briefs and demo UI where applicable.

---

## Version bands and exit criteria

Pre-1.0 versions may break; see [API_FREEZE.md](./API_FREEZE.md) for what freezes when.

### 0.1.x (current MVP)

**In:** Dual export, SectionPack config, CLI pack/list/validate/qa, capture + IR pipeline, Northline demo, MCP MVP, doctor, monorepo tests.

**Exit already met for "local MVP":** demo builds; validate + pack work; principles and responsible use documented.

**Not claimed:** public npm stability, capture SLA, agent eval scores, external adoption.

### 0.2 - 0.4 (prove + prepare publish)

| Focus | Exit criteria |
|-------|----------------|
| Real-page corpus | 8-12 rights-cleared pages scored on the four metrics; results tracked outside monorepo product tree |
| Metrics harness | Documented eval path ([eval README](../eval/README.md)); at least one automated slice (compile and/or pack smoke) |
| API freeze draft | [API_FREEZE.md](./API_FREEZE.md) applied; stable formats and CLI groups marked; experimental pipeline labeled |
| Capture quality start | Hygiene/heuristics improvements driven by corpus failures; foundation gate written into skill/pipeline docs |
| Changelog | Keep a Changelog entries for user-facing breaks |

**Band goal:** Evidence that the loop works beyond Northline, and a clear freeze list for first publish.

### 0.5 - 0.8 (public surface + quality + agents)

| Focus | Exit criteria |
|-------|----------------|
| First npm publish | `@ctrlc/core`, `@ctrlc/react`, `@ctrlc/next`, and related packages publishable with `schemaVersion` + SemVer story |
| Stable surface | Config schema, stable export formats, pack/list/validate/qa hold under freeze rules |
| Quality | Multi-state and foundation gate used in default agent path; capture regressions have tests or fixtures |
| Agents | Skill + MCP + library exercised by eval harness; failures triaged |
| Proof | 2-3 public-safe examples; GIF/video optional but preferred; docs hub links roadmap + freeze |

**Band goal:** External consumers can install `@ctrlc/*` and complete the dual-export loop without reading monorepo internals.

### 1.0 (hardening + commitment)

| Focus | Exit criteria |
|-------|----------------|
| SemVer 1.0 | Breaking changes only with major bumps; deprecation windows for config/IR |
| Hardening | Test suite + doctor + CI match product claims; changelog complete for release |
| Perf / a11y | No known P0 perf or a11y regressions on Northline; briefs retain reduced-motion notes |
| Positioning | README and npm keywords still lead with **React section packs + recreation guidance** only |
| Adoption signal | At least one external install path verified (npm); issues/docs feedback loop exists |

**Band goal:** Safe to recommend as a public dependency for section-pack workflows - still **not** a full-site clone product.

---

## Metrics definitions (corpus)

Use these consistently so 0.2-0.4 and later are comparable.

| Metric | Definition | Notes |
|--------|------------|-------|
| First-pass compile % | Fraction of corpus runs where host `npm run build` succeeds before manual code edits | Structure ladder first |
| Visual similarity | Score or pass/fail vs baseline screenshot (tool or human rubric) | Not a pixel-perfect SLA |
| Time-to-pack | Wall time from capture (or IR in) to dual export usable (`describe` + `prompt`/`zip`) | Log env (CI vs laptop) |
| Human fix-up | Minutes or discrete edits until structure + content acceptable | Track visual pass separately if needed |

Rights: only pages and assets you may analyze. See [responsible-use](../guide/responsible-use.md).

---

## What stays out of the monorepo

| In monorepo | Outside monorepo |
|-------------|------------------|
| Northline demo and original fixtures | Third-party product pages and screenshots |
| `example.com` as URL placeholder in docs | Real client brands as product marketing |
| Eval **docs** and harness **code** if generic | Rights-cleared corpus **data** that is third-party |
| Roadmap, freeze, backlog Epic H | Private metric dashboards |

---

## Mapping priority → backlog Epic H

| Priority | Epic H rows (see backlog) |
|----------|---------------------------|
| 1 Prove loop | H1 real-page corpus, H2 metrics harness |
| 2 API + npm | H3 API freeze, H4 npm publish |
| 3 Quality | H5 capture quality, H6 multi-state, H7 foundation gate |
| 4 Agents | H8 agent eval, H9 MCP expand |
| 5 Distribution | H10 public examples, H11 demo GIF |
| 6 Hardening | H12 hardening / a11y |

---

## Suggested near-term checklist

1. Stand up metrics harness docs + minimal scripts ([eval](../eval/README.md)).
2. Run corpus of 8-12 rights-cleared pages; record the four metrics.
3. Apply API freeze for 0.4/0.5 first publish ([API_FREEZE](./API_FREEZE.md)).
4. Improve capture where corpus fails; enforce foundation gate in skill.
5. Expand agent evals; then polish examples + GIF.
6. Harden tests/doctor/changelog/a11y; cut 1.0 when exit criteria hold.

Do not claim 1.0 early. Prefer a boring, measured climb over a marketing version bump.
