# API freeze policy

Policy for what becomes **stable** before and at first public npm publish of `@ctrlc/*`, and how versions evolve through 1.0.

**Positioning:** Public APIs support **React section packs** and **recreation guidance** - not full website creation, not HTML dump/scrape products.

Related:

- [Path to 1.0](./PATH_TO_1.0.md)
- [Distribution checklist](./DISTRIBUTION.md)
- [Versioning](./VERSIONING.md)
- [Config schema](../reference/config-schema.md)
- [Export formats](../reference/export-formats.md)
- [CLI reference](../reference/cli.md)
- [Changelog](../../CHANGELOG.md)
- [Eval harness](../eval/README.md)

---

## Goals

1. External consumers can depend on a **known surface** without monorepo churn.
2. Experimental pipeline commands can still move quickly without breaking pack consumers.
3. Pre-1.0 SemVer remains honest: minors may break until freeze; after freeze, breaks are labeled and changelogged.
4. At 1.0, breaking changes require major bumps and deprecation process for config/IR.

---

## Freeze milestones

### At 0.4 (freeze draft; pre-publish)

| Surface | Status |
|---------|--------|
| `SectionPackConfig` shape used by Northline demo | **Freeze candidate** - document only; last chance for renames |
| Stable export formats (see below) | **Freeze candidate** |
| CLI: `pack`, `pack-multi`, `list`, `validate`, `qa` | **Freeze candidate** |
| CLI: capture/pipeline family | **Experimental** - may change flags and step order |
| IR `schemaVersion` / Page IR fields | **Versioned experimental** - additive preferred; breaks noted in changelog |
| MCP tool names | **MVP** - expand only with aliases or minor bumps when published |
| npm publish | **Not required yet** - packages prepared (`publishConfig`, `files`, license) |

**Exit for 0.4:** This doc + config reference + export list match code; no silent renames of stable format strings or core config fields without changelog.

### At 0.5 (first npm publish target)

| Surface | Status |
|---------|--------|
| Published packages `@ctrlc/core`, `@ctrlc/react`, `@ctrlc/next` (and capture/cli/mcp as ready) | **Stable enough to publish** under pre-1.0 SemVer |
| `SectionPackConfig` + JSON Schema export | **Frozen for minor** - additive fields OK; removals/renames = minor break pre-1.0, major at 1.0 |
| Stable export formats | **Frozen** |
| CLI pack/list/validate/qa (+ `schema`, `doctor` as support) | **Frozen command names and primary flags** |
| Pipeline / capture CLI | **Still experimental** until explicitly marked stable in changelog |
| HTTP demo route shapes | **Demo-stable** - document as reference, not a hosted SLA |

**First publish rule:** Do not publish a package whose public entrypoints disagree with this freeze list. Prefer delaying publish over freezing half-baked pipeline flags.

---

## SectionPackConfig

Canonical reference: [docs/reference/config-schema.md](../reference/config-schema.md).

### Frozen at 0.4/0.5

- Top-level intent: `schemaVersion`, `sections[]`, `recipes[]`, `defaultVariables`, `sharedUtilSelectors` (as documented).
- Per-section identity and pack inputs: `id`, `label`, `description`, `componentPath`, `componentExport`, `contentModulePath`, `contentKeys`, `cssModulePath`, `cssSelectors`, `relatedPaths`, `tags`, `promptRole`, optional `behavior`, optional preview fields.
- Validation behavior: missing `schemaVersion` treated as `1`; unsupported major versions fail validate.
- Programmatic helpers that hosts import for define/validate (names in `@ctrlc/core` public export) - treat renames as breaking.

### Allowed without a major (even post-freeze)

- **Additive** optional fields on config or section entries.
- Stricter validation that only rejects **invalid** configs (not valid ones).
- JSON Schema examples and docs clarity.

### Breaking (requires process)

- Rename or remove frozen fields.
- Change meaning of `id` stability or path resolution relative to cwd.
- Bump **config** `schemaVersion` in a way that old configs fail without a migration note.

Deprecation: mark field deprecated in docs + changelog for at least one minor (pre-1.0) or one minor with clear window (post-1.0) before removal.

---

## Export formats

Reference: [docs/reference/export-formats.md](../reference/export-formats.md).

### Stable (freeze at 0.4/0.5; keep through 1.0 unless major)

These format strings and primary payloads are **stable**:

| Format | Role |
|--------|------|
| `describe` | Natural-language brief |
| `prompt` | Full agent code pack |
| `prompt-short` | Compact code pack |
| `zip` | Downloadable multi-file pack |
| `json` | Structured pack payload |

Dual-export product promise maps to:

- NL → `describe`
- Code as-is → `prompt` / `prompt-short` / `zip` / `json`

### Experimental or secondary

May change shape, selectors, or default inclusion without a major until explicitly promoted:

- `component`, `content`, `css`, `template`, `cursor-rule`
- Any new format added after freeze starts **experimental** until listed stable in changelog + this doc
- Multi-pack and recipe wrappers stay stable **for the stable formats above**; recipe id sets remain host-config data, not global API

### Rules

- Do not reuse a stable format string for a different payload kind.
- Default format when omitted remains documented (`json` today); changing default is a breaking behavior change.
- Variable overrides (`var.*`) for brand placeholders stay supported for prompt/describe pipelines.

---

## CLI command groups

Binary: `ctrlc` (monorepo: `npm run ctrlc -- ...`).

### Stable group (freeze at 0.4/0.5)

| Command | Notes |
|---------|--------|
| `pack` | Single-section pack; stable formats |
| `pack-multi` | Multi ids and `--recipe` for stable formats |
| `list` | Section/recipe listing |
| `validate` | Config structure + optional path checks |
| `qa` | Validate + list + build gate (flags like `--skip-build` stay supported or aliased) |

Support commands treated as **stable utilities** for publish consumers:

| Command | Notes |
|---------|--------|
| `schema` | Print SectionPackConfig JSON Schema |
| `doctor` | Environment health (expand checks carefully; keep exit codes meaningful) |

### Experimental until noted

Everything that drives capture → IR → scaffold → parallel plan is **experimental** until a release notes them as stable:

Examples: `capture`, `pipeline`, `adapt-ir`, `hygienize-ir`, `materialize-assets`, `tokens-from-ir`, `register-from-ir`, `specs-from-ir`, `scaffold-from-ir`, `baseline`, `plan-parallel`, `visual-diff`, `init-clone`, `register`, `register-from-spec`, `scan`, `graph`, `library`, `snapshot`, `watch`, and siblings.

**Rules for experimental commands:**

- May rename flags, change defaults, or reorder pipeline steps in minors pre-1.0.
- Prefer additive flags; when breaking, changelog under `### Changed` / `### Removed` with migration one-liners.
- Help text may tag `[experimental]` when useful.
- Do not block pack consumers on experimental command churn.

### Promoting experimental → stable

1. Document in CLI reference and this file.
2. Changelog entry: "Stabilized: `command`".
3. Add or extend tests/eval smoke that call the command.
4. Avoid flag breaks for at least one minor after promotion without deprecation note.

---

## IR `schemaVersion` and deprecation

Page IR (capture / adapt-ir) is **versioned separately** from `SectionPackConfig.schemaVersion`.

| Topic | Policy |
|-------|--------|
| Current | IR and config both use integer schema versions; missing config version ⇒ `1` |
| Additive | New optional IR fields preferred over renames |
| Breaking IR | Bump IR `schemaVersion`; adapter/`adapt-ir` and `hygienize-ir` document migration |
| Dual read | Prefer readers that accept N and N-1 for one minor when practical |
| Deprecation | Changelog + docs; remove old shape only after a stated window |
| Config vs IR | Config freeze does **not** automatically freeze every IR field; pipeline remains experimental longer |

External file-map adapters must keep converting into the **current** Page IR without requiring hosts to depend on third-party schemas.

---

## SemVer rules

Packages: `@ctrlc/core`, `@ctrlc/react`, `@ctrlc/next`, `@ctrlc/capture`, `@ctrlc/cli`, `@ctrlc/mcp` (scope as published).

### Pre-1.0 (`0.x.y`)

| Change | Version bump |
|--------|----------------|
| Bugfix, docs, non-API hardening | Patch `0.x.Y` |
| Additive stable API, new experimental commands, new optional config fields | Minor `0.X.0` preferred (patch OK if tiny) |
| Break of **frozen** surface (config field, stable format, stable CLI) | Minor `0.X.0` **with** clear changelog (pre-1.0 allows break in minor) |
| Break of experimental only | Minor or patch; still changelog if users might notice |

Pre-1.0 does **not** mean silent break. It means we may fix mistakes without a 2.0-style major if we document them.

### 1.0.0 and after

| Change | Version bump |
|--------|----------------|
| Backward compatible fixes | Patch |
| Backward compatible features | Minor |
| Break of frozen public API (config, stable formats, stable CLI, public TS exports) | **Major** |
| Experimental commands | May still move in minor until stabilized; label clearly |

1.0 means: **stable surface holds**. It does not mean capture is pixel-perfect or that every experimental pipeline flag is forever.

### Coordinated monorepo releases

- Prefer **same version** across `@ctrlc/*` when releasing together.
- If a package is intentionally lagging, document peer dependency ranges.
- Root [CHANGELOG.md](../../CHANGELOG.md) is the user-facing history; package-level notes may mirror.

---

## Changelog discipline

Follow [Keep a Changelog](https://keepachangelog.com/) style already used in the repo.

### Required for every user-facing release

1. Update `[Unreleased]` then cut a dated version section.
2. Group under `Added` / `Changed` / `Deprecated` / `Removed` / `Fixed` / `Security` as needed.
3. Call out:
   - Breaks to frozen surfaces
   - Stabilizations ("Stabilized: `pack` flags …")
   - IR or config `schemaVersion` bumps
   - npm publish notes (first publish, access, package list)

### Required when freezing or unfreezing

- PR or commit that changes this file **and** changelog together.
- Link PATH_TO_1.0 if exit criteria move.

### Do not

- Ship a breaking rename of `describe` / `prompt` / `zip` / `json` without major (post-1.0) or loud minor (pre-1.0) + migration.
- Publish npm without a matching changelog entry.
- Claim 1.0 in changelog while PATH_TO_1.0 exit criteria are unchecked.

---

## Package publish checklist (when ready)

Not executed by this doc; use when cutting the first public release:

1. [ ] Freeze list above matches code and docs  
2. [ ] `npm test`, `test:mcp`, `validate`, `ctrlc doctor` green  
3. [ ] `publishConfig`, `files`, `license`, `prepublishOnly` set on packages  
4. [ ] CHANGELOG version section written  
5. [ ] No third-party product brands in published demos (Northline only)  
6. [ ] Positioning keywords: section packs / recreation guidance - not scraper/mirror  

---

## Quick reference

| Item | 0.4 | 0.5 first publish | 1.0 |
|------|-----|-------------------|-----|
| SectionPackConfig | Freeze candidate | Frozen additive | SemVer major on break |
| describe/prompt/prompt-short/zip/json | Freeze candidate | Frozen | Major on break |
| pack/list/validate/qa | Freeze candidate | Frozen | Major on break |
| pipeline/capture CLI | Experimental | Experimental | Stable only if promoted |
| IR schemaVersion | Versioned experimental | Versioned; dual-read preferred | Deprecation windows |
| npm `@ctrlc/*` | Prepare only | Publish allowed | Support commitment |
