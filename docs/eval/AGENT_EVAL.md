# Agent evaluation protocol

How to evaluate **agent reliability** for CtrlC section extract and rebuild.

Audience: maintainers and reviewers running real skill / CLI flows. Not a promise of pixel-perfect clones.

Harness index: [README.md](./README.md). Metrics schema: [METRICS.md](./METRICS.md).

## Protocol

1. **Given** a URL (or local host) the user may analyze (own site, permission, or lawful research). See [responsible use](../guide/responsible-use.md).
2. **Agent** runs skill phases (`.claude/skills/ctrlc-clone`) or equivalent CLI path:
   - init / host scaffold
   - recon (+ optional capture IR)
   - specs → build → **register**
   - assembly → **qa**
3. **Human** measures fix-up: minutes, files touched, failed dual-export sections, fidelity stage actually reached.
4. **Score** with [scripts/eval/score-case.mjs](../../scripts/eval/score-case.mjs) and fill the record template below.
5. File automated results under `docs/eval/results/` (metrics JSON only). Prefer anonymized host names for third-party research. Do not commit third-party full clones under `examples/`.

Default scope is **one page**. Multi-page only when the case explicitly asks for it.

## Success criteria (case pass)

A case is a **pass** when all of the following hold:

| Criterion | Threshold |
|-----------|-----------|
| **qa green** | `ctrlc qa --cwd .` succeeds (use `--skip-build` only while documenting that build was green separately) |
| **Dual export** | For each registered section under test: `pack --format describe` and `pack --format prompt-short` succeed |
| **Structure score** | ≥ **0.7** (see scoring dimensions / [METRICS.md](./METRICS.md)) |
| **Rights** | Source URL is allowed for the run; no third-party full clone committed to `examples/` |

### Structure score (0-1)

Heuristic dimensions (equal weight unless the record says otherwise):

| Dimension | Score 1.0 when |
|-----------|----------------|
| Topology | Section order matches PAGE_TOPOLOGY / IR; no orphan blocks |
| Boundaries | Each shipped section has `SectionBoundary` + registry entry |
| Registration | Config + `.ctrlc/registry.json` paths resolve; `ctrlc list` matches page |
| Dual export | Describe + prompt-short work for registered sample sections |
| Build | `npm run build` / full `ctrlc qa` green |

Overall structure score = mean of dimension scores (or harness formula in METRICS). Fail the case if overall **below 0.7** even if qa is green (e.g. thin stubs that compile).

Content and visual-pass fidelity are **out of band** for the structure gate; record them separately on the ladder (structure → content → visual).

## Record template

Automated path: add a case under `docs/eval/cases/<case-id>/case.json` (see `cases/_template/`), score into `docs/eval/results/<case-id>.json`.

Human companion notes (optional markdown):

```markdown
# Case: <case-id>

- Date:
- Agent / model:
- Skill version / monorepo commit:
- Source URL or host: (rights note: own | permitted | research)
- Scope: page | site | section

## Gates

- qa green: yes/no (command + notes)
- dual export: yes/no (section ids checked)
- structure score: 0.00-1.00 (from score-case.mjs or manual)
- pass (all criteria): yes/no

## Fix-up (human)

- Minutes of human edit:
- Files touched:
- Sections rebuilt or re-registered:
- Blockers (capture, tokens, motion, assets, rights):

## Fidelity ladder

- Stage reached: structure | content | visual
- Honest gaps:

## Parallel builders

- Used plan-parallel: yes/no
- Human review performed: yes/no (required on 0.1.x)

## Notes

- ...
```

### Scorer command

```bash
# Offline Northline (in-repo)
npm run eval:northline

# Arbitrary case
node scripts/eval/score-case.mjs \
  --case docs/eval/cases/<case-id>/case.json \
  --cwd <clone-project> \
  --out docs/eval/results/<case-id>.json

npm run eval:aggregate
```

See [scripts/eval/score-case.mjs](../../scripts/eval/score-case.mjs).

## Link to scorer

| Artifact | Path |
|----------|------|
| Scorer | [scripts/eval/score-case.mjs](../../scripts/eval/score-case.mjs) |
| Aggregate | [scripts/eval/aggregate-results.mjs](../../scripts/eval/aggregate-results.mjs) |
| Metrics schema | [METRICS.md](./METRICS.md) |
| Harness index | [README.md](./README.md) |

The scorer probes a host cwd via the monorepo CLI (`list`, `validate`, `qa --skip-build`, dual-export smoke). It does **not** replace human judgment on content or visual fidelity.

## 0.1.x reality check

- **Parallel builders still need human review** at 0.1.x. Specs + `plan-parallel` speed throughput; they do not certify ship quality alone.
- Eval corpus baseline scores must be **documented** before the [distribution publish readiness gate](../roadmap/DISTRIBUTION.md).
- Prefer Northline and rights-cleared hosts. Never treat third-party full clones in `examples/` as success proof.

## Related

- Skill: `.claude/skills/ctrlc-clone/SKILL.md`
- [PATH_TO_1.0.md](../roadmap/PATH_TO_1.0.md)
- [VERSIONING.md](../roadmap/VERSIONING.md)
- [REAL_PAGE_RUNBOOK.md](./REAL_PAGE_RUNBOOK.md)
