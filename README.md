# CtrlC + SectionPack

[![Node.js 20+](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-core%20%7C%20cli%20%7C%20capture%20%7C%20mcp-success)](package.json)
[![Status](https://img.shields.io/badge/status-0.1.x%20MVP-informational)](CHANGELOG.md)

**CtrlC** (like Ctrl+C: **copy components**) turns a **public page you have rights to analyze** into **reusable UI sections** and **recreation guidance** - not a full-site mirror and not an HTML dump.

**SectionPack** is the dual-export layer on every section:

1. **Natural language** - what it does, motion, behavior, layout, color, multi-file influences  
2. **Code as-is** - multi-file pack (TSX + content + CSS + deps)

> **Lead with sections, not “clone the whole website.”**  
> Extract clean, reusable blocks (hero, pricing, nav, FAQ, …) and guidance to rebuild them in React. Full-page composition is optional assembly - pixel-perfect full-site cloning is **not** the product promise.

## Why this is useful

Developers and designers already reverse-engineer UI by hand. CtrlC automates the hard parts:

| Need | CtrlC |
|------|--------|
| Isolate reusable UI | Section IR + specs + React section components |
| Hand-off to humans or agents | **Dual export**: brief + multi-file code pack |
| Local control / privacy | CLI-first; work stays on your machine |
| Avoid HTML scrapers | **React reconstruction** only - never ship mirrored HTML as the app |
| Redesign / migrate | Structure + content + tokens as a starting point |

## What CtrlC is not

| Not this | Instead |
|----------|---------|
| Generic full-site cloner | **Section / component extraction** + assembly |
| Pixel-perfect mirror guarantee | Structure → content → optional visual fidelity pass |
| HTML/CSS dump product | **React** sections + SectionPack |
| Bypass auth / ToS scraper | Public pages you may analyze; see [responsible use](docs/guide/responsible-use.md) |

## Feature map

| Area | What you get |
|------|----------------|
| **Sections** | Capture IR, hygiene, specs, `scaffold-from-ir`, register |
| **Guidance** | Specs, behavior briefs, builder prompts, `describe` / `prompt` packs |
| **SectionPack** | Dual export, recipes, catalog, graph, library, drift |
| **Pipeline** | `init-clone`, `pipeline`, tokens (`--ts-*`), assets, baseline |
| **Quality** | `qa` (`--skip-build` when dev runs), `doctor`, optional visual-diff |
| **Agents** | Skills + MCP (`@ctrlc/mcp`) |
| **Ship** | Docker demo, CI, MIT |

## Documentation

**Hub:** [docs/README.md](docs/README.md)

| Start | Link |
|-------|------|
| Getting started | [docs/guide/getting-started.md](docs/guide/getting-started.md) |
| Principles | [docs/guide/principles.md](docs/guide/principles.md) |
| **Responsible use** | [docs/guide/responsible-use.md](docs/guide/responsible-use.md) |
| Hybrid pipeline | [docs/workflows/hybrid-clone-pipeline.md](docs/workflows/hybrid-clone-pipeline.md) |
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

## Extract sections from a public page (one page)

Use only on URLs you have **rights to analyze** (your site, licensed work, or permitted research). See [responsible use](docs/guide/responsible-use.md).

```bash
npm run build
ctrlc init-clone ../my-sections --url https://example.com --scope page
cd ../my-sections && npm install

# Live URL (needs: npm i -D playwright && npx playwright install chromium)
ctrlc pipeline --url https://example.com --cwd . --out runs/example.com

ctrlc plan-parallel --cwd . --format md
# Build React sections from docs/research/components/*.spec.md
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
| **Sections first** | Reusable blocks + packs; not “full website clone” as the pitch |
| **Page default** | One URL → sections; full site only when requested |
| **React only** | Never HTML product dumps |
| **Dual export** | NL brief + multi-file code pack on every section |
| **Config-first** | Every section registered for packs |
| **Responsible use** | Rights, ToS, no phishing / brand theft |

## Status

**0.1.x MVP** - section extraction + SectionPack dual export path is implemented and tested. APIs may evolve before 1.0.

| Ready | Notes |
|-------|--------|
| Local section pipeline + dual export | Yes |
| Demo + Docker + CI | Yes |
| MCP for agents | Yes (MVP) |
| npm publish | Metadata ready; not published yet |
| Live URL capture | Optional Playwright peer |
| Pixel-perfect full page | **Not** a product guarantee |

## Responsible use

- Analyze **public** pages you own or have permission to study.  
- Rebuild for migration, redesign, learning, or internal sandboxes - not impersonation or phishing.  
- Respect site terms; do not bypass auth or paywalls.  
- Output is a **starting point for original React reimplementation**, not a license to copy brand assets or trademarks.

Full policy: [docs/guide/responsible-use.md](docs/guide/responsible-use.md).

MIT license. See [LICENSE](LICENSE).
