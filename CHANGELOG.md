# Changelog

All notable changes to CtrlC packages are documented in this file.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [SemVer](https://semver.org/) once 1.0.0 is cut. Pre-1.0 APIs may change.

## [Unreleased]

### Changed - Positioning

- Lead with **reusable UI sections + recreation guidance + dual export**, not full-site cloning
- Document **fidelity ladder** (structure → content → visual pass)
- Strengthen **responsible use** (rights, ToS, no HTML dumps as product)
- README, principles, clone skill, AGENTS template, docs hub aligned

## [0.1.0] - 2026-07-31

### Added - SectionPack

- Dual export: natural language briefs + multi-file code packs
- Formats: describe, prompt, prompt-short, zip, json, cursor-rule, component surfaces
- Recipes (e.g. `landing-core`) and `pack-multi --recipe`
- React provider / boundary / overlay; Next API route + catalog with preview thumbs
- Snapshots, contentHash, pack drift CI helper

### Added - Clone pipeline

- `init-clone`, `capture` (optional Playwright), `adapt-ir` (external file-map adapter)
- `pipeline` orchestrator: materialize, tokens, register-from-ir, specs-from-ir, plan
- `plan-parallel`, `baseline`, `visual-diff` (optional pngjs + pixelmatch)
- `qa`, `doctor`
- Page IR, specs, topology, multi-state + 390/768/1440 matrix, reduced-motion briefs

### Added - Agent / DX

- `.claude/skills/ctrlc-clone` skill
- `@ctrlc/mcp` stdio tools (list, pack, validate, library summary, doctor)
- `examples/next-demo` (Northline), `examples/clone-template`
- Docker Compose demo, GitHub Actions CI, CONTRIBUTING, SECURITY

### Packages

- `@ctrlc/core`, `@ctrlc/react`, `@ctrlc/next`
- `@ctrlc/capture`, `@ctrlc/cli`, `@ctrlc/mcp`

### Notes

- MVP suitable for local clone + SectionPack demos
- npm publish deferred until API is marked stable (G2)
- Live URL capture requires optional Playwright install
