# Real-page evaluation runbook

Goal: score **8-12 rights-cleared pages** through the CtrlC core loop and record metrics under `docs/eval/results/`. Start with the monorepo **Northline** demo (offline), then external hosts you may analyze.

**Rights first.** See [responsible use](../guide/responsible-use.md). Do not use this harness to bulk-rebuild commercial sites you do not own or lack permission for.

## What may enter the monorepo

| Allowed in git | Not allowed in git |
|----------------|--------------------|
| Case definitions under `docs/eval/cases/` | Third-party commercial rebuild apps under `examples/` |
| Scored metrics JSON under `docs/eval/results/` (anonymize if needed) | Scraped assets, logos, or full clone trees of third-party brands |
| Northline demo case + `examples/next-demo` | Passing off external rebuilds as product demos |

Only **Northline** (fictional) ships as an in-repo host. External work stays on disk outside the monorepo; commit **metrics only**.

## Campaign checklist (per page)

### 1. Confirm rights

- [ ] Own the site, have written permission, or use a public domain / explicitly allowed sandbox.
- [ ] Record `rightsNote` in the case JSON (no secrets).
- [ ] Prefer generic or original copy before any public write-up.

### 2. Host project

**Option A - Existing host (Northline):**

```bash
# monorepo root; host already registered
npm run eval:northline
```

Case sets `pipelineMode: "existing-host"`.

**Option B - New clone outside monorepo:**

```bash
# OUTSIDE pagecraft/examples
ctrlc init-clone ../eval-hosts/site-a --url https://example.com
cd ../eval-hosts/site-a
# continue pipeline below
```

Do not place third-party hosts under `pagecraft/examples/`.

### 3. Pipeline capture (when not existing-host)

```bash
ctrlc capture https://example.com --out runs/page
# or full pipeline when IR exists
ctrlc pipeline --ir runs/page/ir.json --cwd .
```

Typical stages (see [hybrid pipeline](../workflows/hybrid-clone-pipeline.md)):

1. capture / adapt-ir  
2. materialize-assets  
3. hygiene (if used)  
4. tokens-from-ir  
5. specs-from-ir / scaffold-from-ir  
6. register-from-ir or manual register  

Mark each stage in the case / result `pipeline` object (`attempted` / `ok`).

### 4. Plan parallel + build sections

```bash
ctrlc plan-parallel --cwd .
# agent or human implements sections per specs / AGENTS notes
```

Use `docs/templates/parallel-build.md` and section builder prompts. Rebuild as **React sections**, not an HTML mirror.

### 5. Register + QA

```bash
ctrlc register <id> --cwd . --component ... --export ...
# or register-from-ir / register-from-spec
ctrlc validate --cwd .
ctrlc list --cwd . --json
ctrlc qa --cwd . --skip-build
# when ready for a full compile gate:
ctrlc qa --cwd .
```

### 6. Score and record

```bash
node scripts/eval/score-case.mjs \
  --case docs/eval/cases/<case-id>/case.json \
  --cwd /path/to/host \
  --out docs/eval/results/<case-id>.json
```

Then:

```bash
npm run eval:aggregate
```

Edit `human.fixUpMinutes` and `human.notes` on the result JSON after the run. Optionally set `visual.baselineExists` / `visualDiffScore` if you ran baseline + visual-diff.

## Suggested batch (8-12 pages)

| # | Source type | Rights pattern | Notes |
|---|-------------|----------------|-------|
| 1 | Northline demo | Owned fictional | Always-on offline gate |
| 2-4 | Sites you own | First-party | Prefer marketing home pages |
| 5-7 | Client / employer with permission | Written OK | Anonymize metrics if public |
| 8-10 | Public sandbox / docs samples | Explicit license | Not commercial brand clones |
| 11-12 | Internal redesign targets | Internal only | Keep results private if needed |

Adjust the mix; quality of rights documentation matters more than hitting exactly twelve.

## Anonymizing results

If a metrics file might be public:

- Replace product names in `sourceUrl` with a label (`site-07`, `vertical-saas-home`).
- Strip URLs that identify the brand when required.
- Keep scores, section counts, and pipeline booleans.

## Exit criteria toward 1.0

Track mean `scores.overall` across the campaign. Structure-heavy failures (validate / QA) should be fixed in tooling; content dual-export failures indicate pack/build gaps; high `fixUpMinutes` flags UX/agent friction even when scores look green.

## Related

- [README.md](./README.md) - harness overview
- [METRICS.md](./METRICS.md) - JSON schema and score formulas
- [Init-clone](../workflows/init-clone.md)
- [Hybrid pipeline](../workflows/hybrid-clone-pipeline.md)
