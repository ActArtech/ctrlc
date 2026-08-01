# Eval metrics schema

Results files live under `docs/eval/results/<caseId>.json`. Case definitions live under `docs/eval/cases/<caseId>/case.json`.

`score-case.mjs` fills automated fields from CLI probes. Human fields may stay null or be edited by hand after a real-page run.

## Top-level fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `caseId` | string | yes | Stable id (`northline-demo`, `site-a`, ...) |
| `sourceUrl` | string | yes | Source page URL, or a note for internal demos |
| `rightsNote` | string | yes | Why this page may be analyzed / rebuilt |
| `date` | string (ISO date or datetime) | yes | When the result was produced |
| `gitSha` | string \| null | no | Monorepo (or host) commit at score time |
| `scoredAt` | string (ISO datetime) | no | Timestamp written by score script |
| `hostCwd` | string | no | Absolute or relative path scored |
| `pipelineMode` | string | no | e.g. `existing-host`, `init-clone`, `capture-only` |

## `pipeline`

Which stages were attempted and whether they succeeded. Offline Northline usually marks later build stages as already present rather than re-running capture.

```json
"pipeline": {
  "initClone": { "attempted": false, "ok": null },
  "capture": { "attempted": false, "ok": null },
  "hygiene": { "attempted": false, "ok": null },
  "tokens": { "attempted": false, "ok": null },
  "specs": { "attempted": false, "ok": null },
  "scaffold": { "attempted": false, "ok": null },
  "register": { "attempted": true, "ok": true },
  "qa": { "attempted": true, "ok": true }
}
```

| Key | Meaning |
|-----|---------|
| `initClone` | `ctrlc init-clone` (optional for existing hosts) |
| `capture` | `ctrlc capture` / IR write |
| `hygiene` | section hygiene / IR clean |
| `tokens` | `tokens-from-ir` |
| `specs` | `specs-from-ir` |
| `scaffold` | `scaffold-from-ir` or manual section files |
| `register` | sections present in pack config / registry |
| `qa` | `ctrlc qa` (score script uses `--skip-build` by default) |

`attempted: false` with `ok: null` means "not part of this run." Case JSON may pre-fill known pipeline mode.

## `sections`

```json
"sections": {
  "total": 7,
  "registered": 7,
  "dualExportOk": 3,
  "dualExportSampled": 3,
  "ids": ["promo", "header", "hero", "..."],
  "dualExportDetails": [
    { "id": "promo", "describe": true, "promptShort": true }
  ]
}
```

| Field | Description |
|-------|-------------|
| `total` | Section count from `ctrlc list` |
| `registered` | Sections with usable pack entries (same as total when list succeeds; may differ if registry merge is partial) |
| `dualExportOk` | Sampled sections where both `describe` and `prompt-short` succeeded |
| `dualExportSampled` | How many ids were probed (score script: first 3) |
| `ids` | Full id list from list |
| `dualExportDetails` | Per-id booleans for the sample |

**Dual export** means SectionPack can emit:

1. Natural-language brief (`--format describe`)
2. Code-oriented prompt (`--format prompt` or `prompt-short`)

## `compile`

```json
"compile": {
  "firstPassQaOk": true,
  "buildSkipped": true,
  "validateOk": true,
  "listOk": true
}
```

| Field | Description |
|-------|-------------|
| `firstPassQaOk` | `ctrlc qa` exit 0 (with or without build) |
| `buildSkipped` | `true` when `--skip-build` / `--no-build` was used |
| `validateOk` | `ctrlc validate` exit 0 |
| `listOk` | `ctrlc list` exit 0 and at least one section |

## `visual`

```json
"visual": {
  "baselineExists": false,
  "visualDiffScore": null
}
```

| Field | Description |
|-------|-------------|
| `baselineExists` | Host has a baseline artifact (e.g. under `.ctrlc/` or capture out) |
| `visualDiffScore` | Optional 0-1 similarity; **null if not run** |

Score script sets `visualDiffScore` to null unless a future flag runs `visual-diff`.

## `human`

```json
"human": {
  "fixUpMinutes": null,
  "notes": ""
}
```

| Field | Description |
|-------|-------------|
| `fixUpMinutes` | Estimated minutes of human/agent fix-up after first automated pass |
| `notes` | Free text (anonymize third-party brands if publishing metrics) |

Filled by operators; score script copies from case defaults when present.

## `scores`

```json
"scores": {
  "structureScore": 1.0,
  "contentScore": 1.0,
  "overall": 1.0
}
```

All scores are floats in **0.0 - 1.0**. Simple computation used by `score-case.mjs`:

### `structureScore`

Average of binary checks (missing checks treated as 0):

1. `validateOk`
2. `listOk` and `sections.total > 0`
3. `sections.registered >= sections.total` (and total > 0)
4. `firstPassQaOk`

```
structureScore = (v + l + r + q) / 4
```

### `contentScore`

Dual-export success on the sample:

```
contentScore = dualExportOk / max(dualExportSampled, 1)
```

If no sections exist, `contentScore = 0`.

### `overall`

```
overall = (structureScore + contentScore) / 2
```

Visual and human fix-up are **not** folded into `overall` yet so offline structure runs stay comparable. Document them; optionally weight them in a later revision.

## Case file vs result file

- **Case** (`cases/*/case.json`): intent, rights, defaults, optional expected pipeline mode.
- **Result** (`results/*.json`): snapshot after scoring, including scores and CLI evidence.

Case template fields mirror metrics so operators can pre-fill rights and human notes before the score script merges runtime data.

## Example (abbreviated)

```json
{
  "caseId": "northline-demo",
  "sourceUrl": "internal Northline demo (examples/next-demo)",
  "rightsNote": "Owned fictional brand shipping in monorepo",
  "date": "2026-08-01",
  "gitSha": "abc1234",
  "pipelineMode": "existing-host",
  "pipeline": {
    "qa": { "attempted": true, "ok": true }
  },
  "sections": {
    "total": 7,
    "registered": 7,
    "dualExportOk": 3,
    "dualExportSampled": 3
  },
  "compile": {
    "firstPassQaOk": true,
    "buildSkipped": true
  },
  "visual": {
    "baselineExists": false,
    "visualDiffScore": null
  },
  "human": {
    "fixUpMinutes": 0,
    "notes": "In-repo demo; no capture required"
  },
  "scores": {
    "structureScore": 1.0,
    "contentScore": 1.0,
    "overall": 1.0
  }
}
```
