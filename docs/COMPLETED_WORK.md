# Completed work (CtrlC 0.1.x)

Status document for what shipped on **GitHub `main`** (`ActArtech/ctrlc`) through the section-packs positioning and readiness pass.

**As of:** 2026-08-01  
**HEAD:** `e2e0fc0` (sync with `origin/main`)  
**Product promise:** **React section packs + recreation guidance** - not full website creation, not HTML scraping.

---

## 1. Product positioning (done)

| Deliverable | Where |
|-------------|--------|
| Public pitch: React section packs + recreation guidance | [README.md](../README.md) |
| Principles: sections first, fidelity ladder, dual export | [guide/principles.md](./guide/principles.md) |
| Rights / ToS / allowed uses | [guide/responsible-use.md](./guide/responsible-use.md) |
| Clone skill aligned to positioning | [.claude/skills/ctrlc-clone/SKILL.md](../.claude/skills/ctrlc-clone/SKILL.md) |
| Design-tokens skill (semantic `--ts-*`) | `.claude/skills/ctrlc-design-tokens/` |
| Generated host notes | [templates/AGENTS.clone.md](./templates/AGENTS.clone.md), `examples/clone-template/AGENTS.md` |
| Brand hygiene: Northline-only demos; no third-party commercial names in product tree | fixtures/tests/docs scrubbed |

**Fidelity ladder (documented):** structure → content → visual pass. Capture alone is not pixel parity.

---

## 2. Pipeline and platform (done in 0.1.x)

### SectionPack dual export

- Natural language briefs (`describe`) + multi-file code packs (`prompt`, `prompt-short`, zip, etc.)
- Provider, `SectionBoundary`, inspector, Next API + `/dev/packs` catalog
- Recipes, graph, library, snapshots / drift helpers

### Capture → rebuild chain

| Capability | Status |
|------------|--------|
| Playwright page capture → Page IR | Done |
| IR hygiene (junk drop, dedupe, semantic ids) | Done |
| `scaffold-from-ir` (sections + content + page) | Done |
| Richer section text model (headings, lists, CTAs) | Done |
| Asset pipeline (Next image unwrap, friendly public names) | Done |
| Token curation top-N + semantic `--ts-*` | Done |
| `pipeline` orchestrator | Done |
| `qa` / `doctor` / `--skip-build` for dev | Done |
| Bundled CLI (`dist/cli.mjs`, no tsx re-exec for normal use) | Done |
| MCP pack tools (list / pack / validate / doctor) | Done (MVP) |

### Quality gates (last readiness run)

- Monorepo `npm run build` - green  
- `@ctrlc/core`, `@ctrlc/cli`, `@ctrlc/capture` tests - green  
- `npm run eval:northline` - QA ok, dual-export sample 3/3, overall score **1.0**  
- Brand grep - no third-party commercial product names in product sources/tests  

---

## 3. Path to 1.0 scaffolding (done)

Not the 1.0 product itself - the **measurement and planning layer** so the climb is explicit.

| Artifact | Role |
|----------|------|
| [roadmap/PATH_TO_1.0.md](./roadmap/PATH_TO_1.0.md) | MVP gaps + priority order + version bands |
| [roadmap/API_FREEZE.md](./roadmap/API_FREEZE.md) | What freezes before npm |
| [roadmap/VERSIONING.md](./roadmap/VERSIONING.md) | 0.2-0.4 / 0.5-0.8 / 1.0 framing |
| [roadmap/DISTRIBUTION.md](./roadmap/DISTRIBUTION.md) | npm, GIF, examples policy |
| [eval/README.md](./eval/README.md) | Real-page / dual-export scoring harness |
| [eval/METRICS.md](./eval/METRICS.md) | Score schema |
| [eval/REAL_PAGE_RUNBOOK.md](./eval/REAL_PAGE_RUNBOOK.md) | 8-12 rights-cleared page campaign |
| [eval/AGENT_EVAL.md](./eval/AGENT_EVAL.md) | Agent reliability protocol |
| `scripts/eval/score-case.mjs` | Northline dual-export + qa scorer |
| `npm run eval:northline` / `eval:aggregate` | Entry points |
| Epic H (H1-H12) | [backlog/CLONE_PIPELINE_BACKLOG.md](./backlog/CLONE_PIPELINE_BACKLOG.md) |
| `.devcontainer/` | Node 20 + port 3040 |

**Northline baseline:** 7 sections registered; dual-export ok on sampled packs; qa with `--skip-build` ok.

---

## 4. Git history (main milestones)

| Commit | What |
|--------|------|
| `b280f2c` | Initial public monorepo (SectionPack + packages) |
| `66a0d35` | Pipeline DX: hygiene, tokens, scaffold, assets, bundled CLI, `qa --skip-build` |
| `d4369fb` | Positioning: section extraction + recreation guidance |
| `b491026` | Tighten to React section packs; remove third-party fixture brands |
| `d878620` | Path-to-1.0 roadmap + eval harness + API freeze docs |
| `e2e0fc0` | Residual brand string cleanup in core pack tests |

---

## 5. Out of repo (local experiments only - not product)

These were **test hosts** used during development. They are **not** part of the published CtrlC monorepo and must not be presented as the product.

| Local path (typical) | Notes |
|----------------------|--------|
| `tosea-ai-ctrlc-test` | Fidelity experiment on a third-party marketing page - rights-sensitive; local only |
| `athevon-skills-ctrlc` | Interactive skills-graph experiment - local only |

**In-repo demo brand:** fictional **Northline** only (`examples/next-demo`).

---

## 6. Explicitly not completed (still backlog)

| Item | Why deferred |
|------|----------------|
| npm publish `@ctrlc/*` | Wait for API freeze + eval corpus (Epic H / G2) |
| 8-12 rights-cleared external page corpus | Needs owner URLs + scoring campaign |
| Demo GIF / video | Media capture still open |
| Pixel-perfect full-page reconstruction | Not a product promise |
| Stable 1.0 API cut | Pre-1.0 intentional |
| Parallel agent builders always compile-ready | Needs agent eval harness data |

See [roadmap/PATH_TO_1.0.md](./roadmap/PATH_TO_1.0.md) for the ordered climb.

---

## 7. How to verify what we have

```bash
cd pagecraft   # monorepo root
npm install
npm run build
npm test -w @ctrlc/core
npm test -w @ctrlc/cli
npm test -w @ctrlc/capture
npm run eval:northline
npm run eval:aggregate
npm run dev:demo
# http://localhost:3040  - Northline + SectionPack inspector
```

```bash
git status -sb
git log -5 --oneline
# expect: clean, main == origin/main
```

---

## 8. One-line summary

**CtrlC 0.1.x is a solid MVP:** dual-export **React section packs**, local pipeline (capture → hygiene → tokens → scaffold → register → qa), agent skills, and a documented path to 1.0 - publicly framed as recreation guidance, shipped with Northline demos only, and ready on GitHub `main`.
