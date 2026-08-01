# Pipeline evaluation harness

Measure **core loop quality** toward a 1.0 target: capture / plan / build sections / register / dual export / QA on **rights-cleared** pages only.

This is not a marketing scorecard and not an excuse to dump third-party commercial rebuilds into the monorepo. The only in-repo demo case is the fictional **Northline** app under `examples/next-demo`. External cases live as **metrics JSON** (optionally anonymized), not as example apps.

## What we measure

| Layer | Question |
|-------|----------|
| Structure | Config validates; sections registered; paths exist; QA gate green |
| Dual export | `describe` + `prompt` / `prompt-short` succeed for sample sections |
| Compile | First-pass QA (validate + list + optional build) |
| Visual | Baseline present; optional visual-diff score (null if not run) |
| Human | Fix-up minutes and notes after the automated pass |

Field definitions, score formulas, and the JSON shape live in **[METRICS.md](./METRICS.md)**.

## Offline demo first

Run the Northline host without network capture:

```bash
# from monorepo root
npm run eval:northline
npm run eval:aggregate
```

- Case: [`cases/northline-demo/case.json`](./cases/northline-demo/case.json)
- Host: `examples/next-demo`
- Output: `results/northline-demo.json`

`score-case.mjs` invokes the CLI via `node packages/cli/bin/ctrlc.mjs` (`list`, `validate`, `qa --skip-build`, dual-export smoke on the first three section ids).

## Add a case

1. Confirm rights (see [REAL_PAGE_RUNBOOK.md](./REAL_PAGE_RUNBOOK.md) and [responsible use](../guide/responsible-use.md)).
2. Copy `cases/_template/` to `cases/<case-id>/`.
3. Fill `case.json` (id, sourceUrl note, rightsNote, pipeline mode).
4. Run the pipeline **outside** monorepo `examples/` for third-party hosts.
5. Score:

```bash
node scripts/eval/score-case.mjs \
  --case docs/eval/cases/<case-id>/case.json \
  --cwd /path/to/host \
  --out docs/eval/results/<case-id>.json
```

6. Optionally commit the **results** JSON (metrics only). Do **not** commit third-party rebuild trees under `examples/`.

## Results layout

```
docs/eval/
  README.md                 # this file
  METRICS.md                # schema + score rules
  REAL_PAGE_RUNBOOK.md      # 8-12 page campaign steps
  cases/
    _template/case.json
    northline-demo/case.json
  results/
    .gitkeep
    .gitignore              # ignores *.tmp only
    northline-demo.json     # scored outputs (optional commit)
    SUMMARY.md              # from npm run eval:aggregate
```

## Scripts

| npm script | Command |
|------------|---------|
| `eval:northline` | Score Northline demo offline |
| `eval:aggregate` | Markdown table of all `results/*.json` |

Implementation:

- `scripts/eval/score-case.mjs`
- `scripts/eval/aggregate-results.mjs`

## Related docs

- [AGENT_EVAL.md](./AGENT_EVAL.md) - agent reliability protocol, success criteria, human record template
- [REAL_PAGE_RUNBOOK.md](./REAL_PAGE_RUNBOOK.md) - rights, pipeline steps, what may enter git
- [METRICS.md](./METRICS.md) - JSON fields and scores
- [Hybrid clone pipeline](../workflows/hybrid-clone-pipeline.md)
- [Init-clone workflow](../workflows/init-clone.md)
- [Responsible use](../guide/responsible-use.md)
