# CtrlC + SectionPack

[![Node.js 20+](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-core%20%7C%20cli%20%7C%20capture%20%7C%20mcp-success)](package.json)
[![Status](https://img.shields.io/badge/status-0.1.x%20MVP-informational)](CHANGELOG.md)

**CtrlC** delivers **React section packs** and **recreation guidance** from a public page you may analyze.

**SectionPack** dual export on every section:

1. **Natural language** - function, motion, behavior, layout, color, multi-file influences  
2. **Code as-is** - multi-file pack (TSX + content + CSS + deps)

> Not full website creation. Not HTML scraping.  
> **React section packs + recreation guidance** - local-first, rights-aware.

## Why

| Need | CtrlC |
|------|--------|
| Isolate reusable UI | Section IR + specs + React section components |
| Hand-off to humans or agents | **Section packs**: brief + multi-file code |
| Recreation guidance | Specs, behavior briefs, `describe` / `prompt` |
| Local control | CLI-first; work stays on your machine |
| Avoid scrapers | **React reconstruction only** - never ship mirrored HTML |

## What CtrlC is not

| Not this | Instead |
|----------|---------|
| Full website creation product | **React section packs** you compose |
| HTML / CSS scrape or mirror host | Multi-file **React** packs + content modules |
| Pixel-perfect full-page guarantee | Structure → content → optional visual pass |
| Auth / ToS bypass tool | Public pages you have rights to analyze |

## Feature map

| Area | What you get |
|------|----------------|
| **Section packs** | Capture IR, hygiene, specs, scaffold, register, dual export |
| **Recreation guidance** | Specs, briefs, builder prompts, `describe` / `prompt` |
| **SectionPack tooling** | Recipes, catalog, graph, library, drift |
| **Pipeline** | `init-clone`, `pipeline`, tokens (`--ts-*`), assets, baseline |
| **Quality** | `qa` (`--skip-build` when dev runs), `doctor`, optional visual-diff |
| **Agents** | Skills + MCP (`@ctrlc/mcp`) |
| **Ship** | Docker demo, CI, MIT |

Public demos use the fictional **Northline** brand only. No third-party product clones ship in this repo.

## Documentation

**Hub:** [docs/README.md](docs/README.md)

| Start | Link |
|-------|------|
| Getting started | [docs/guide/getting-started.md](docs/guide/getting-started.md) |
| Principles | [docs/guide/principles.md](docs/guide/principles.md) |
| **Responsible use** | [docs/guide/responsible-use.md](docs/guide/responsible-use.md) |
| Section pipeline | [docs/workflows/hybrid-clone-pipeline.md](docs/workflows/hybrid-clone-pipeline.md) |
| CLI reference | [docs/reference/cli.md](docs/reference/cli.md) |
| Contributing | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Changelog | [CHANGELOG.md](CHANGELOG.md) |

## Repo layout

```text
CtrlC/
  packages/
    core/      @ctrlc/core       SectionPack builder + IR tools
    react/     @ctrlc/react      Provider, boundary, overlay
    next/      @ctrlc/next       API route + catalog UI
    capture/   @ctrlc/capture    Page IR (optional Playwright)
    cli/       @ctrlc/cli        ctrlc binary
    mcp/       @ctrlc/mcp        stdio MCP for agents
  examples/
    next-demo/       Northline demo (:3040)
    clone-template/  empty section host
  docs/        guide, concepts, reference, workflows
  scripts/     scaffold, drift, parallel plan wrapper
```

## Requirements

- **Node.js 20+** (engines on all packages; `.nvmrc` / `.node-version` pin `20`)
- npm 10+ (workspaces)
- Optional: Playwright for live `capture --url`; `pngjs` + `pixelmatch` for visual-diff

## Quick start (demo)

```bash
cd CtrlC
npm install
npm run build
npm test
npm run validate
npm run validate:demo
npm run dev:demo
```

| URL | What |
|-----|------|
| http://localhost:3040 | Northline + SectionPack inspector |
| http://localhost:3040/dev/packs | Catalog (search, recipes, previews) |
| `/api/dev/section-pack?list=1` | Section list JSON |

**Keys:** `Ctrl/Cmd+Shift+P` packs on/off · hover section → **Natural language** / **Code as-is**

```bash
npm run ctrlc -- doctor
```

### Docker demo (optional)

```bash
npm run docker:demo
# http://localhost:3040
```

## Build React section packs from a public page

Use only on URLs you have **rights to analyze**. See [responsible use](docs/guide/responsible-use.md).

```bash
npm run build
ctrlc init-clone ../my-sections --url https://example.com --scope page
cd ../my-sections && npm install

# Live URL (needs: npm i -D playwright && npx playwright install chromium)
ctrlc pipeline --url https://example.com --cwd . --out runs/example.com

ctrlc plan-parallel --cwd . --format md
# Implement React sections from docs/research/components/*.spec.md
ctrlc register-from-spec --cwd . --spec docs/research/components/hero.spec.md
ctrlc pack hero --format describe --cwd .
ctrlc pack hero --format prompt-short --cwd .
ctrlc qa --cwd . --skip-build   # while npm run dev is running
```

**Fidelity ladder (honest):**

1. **Structure** - section order, ids, dual export  
2. **Content** - copy, CTAs, assets  
3. **Visual pass** - tokens, layout, polish (manual / agent; not guaranteed by capture alone)

Skill: `.claude/skills/ctrlc-clone/SKILL.md`  
Builder prompt: `docs/templates/section-builder.prompt.md`

## Everyday SectionPack commands

```bash
npm run ctrlc -- list --cwd examples/next-demo
npm run ctrlc -- pack hero --format describe --cwd examples/next-demo
npm run ctrlc -- pack-multi --recipe landing-core --format prompt --cwd examples/next-demo
npm run ctrlc -- graph --cwd examples/next-demo
npm run library
npm run snapshot && npm run check:drift
```

## Principles

| Rule | Detail |
|------|--------|
| **React section packs** | Dual export hand-off; compose a page from packs |
| **Recreation guidance** | Specs + briefs + describe/prompt - not scrapes |
| **Page default** | One URL → sections; multi-page only when requested |
| **React only** | Never HTML product dumps |
| **Config-first** | Every section registered for packs |
| **Responsible use** | Rights, ToS, no phishing / brand theft |

## Status

**0.1.x MVP** - section packs + dual export path is implemented and tested. APIs may evolve before 1.0.

| Ready | Notes |
|-------|--------|
| Local section packs + dual export | Yes |
| Demo + Docker + CI | Yes (Northline only) |
| MCP for agents | Yes (MVP) |
| npm publish | Metadata ready; not published yet |
| Live URL capture | Optional Playwright peer |
| Full website creation | **Not** the product |

## Responsible use

- Analyze **public** pages you own or have permission to study.  
- Rebuild for migration, redesign, learning, or internal sandboxes - not impersonation.  
- Respect site terms; do not bypass auth or paywalls.  
- Output is a **starting point for original React reimplementation**, not a license to copy brand assets.

Full policy: [docs/guide/responsible-use.md](docs/guide/responsible-use.md).

MIT license. See [LICENSE](LICENSE).
