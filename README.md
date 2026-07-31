# CtrlC + SectionPack

[![Node.js 20+](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-core%20%7C%20cli%20%7C%20capture%20%7C%20mcp-success)](package.json)
[![Status](https://img.shields.io/badge/status-0.1.x%20MVP-informational)](CHANGELOG.md)

**CtrlC** (like Ctrl+C: **copy components**) rebuilds a **page** (default) or site as **React / Next** components.

**SectionPack** is the dual-export layer on every section:

1. **Natural language** - function, motion, behavior, layout, color, multi-file influences  
2. **Code as-is** - multi-file pack (TSX + content + CSS + deps)

Never ship mirrored HTML dumps as the product.

## Why

| Need | CtrlC |
|------|-----------|
| Clone for redesign | React sections + specs, not a static HTML mirror |
| Agent-friendly rebuild | Specs, parallel plan, MCP tools |
| Hand-off / remix | Natural language brief **and** code pack per section |
| Drift control | Snapshots, contentHash, CI drift check |

## Feature map

| Area | What you get |
|------|----------------|
| **Clone** | `init-clone`, capture IR, `pipeline`, `adapt-ir` (external file-map) |
| **Specs** | `specs-from-ir`, templates, multi-state + breakpoint matrix |
| **Build** | `plan-parallel`, section-builder prompts, React-only host |
| **SectionPack** | describe / prompt / zip / recipes / catalog + preview thumbs |
| **Quality** | `qa`, `doctor`, baseline, optional `visual-diff` |
| **Agents** | skill + MCP (`@ctrlc/mcp`) |
| **Ship** | Docker demo, GitHub Actions CI, MIT |

## Documentation

**Hub:** [docs/README.md](docs/README.md)

| Start | Link |
|-------|------|
| Getting started | [docs/guide/getting-started.md](docs/guide/getting-started.md) |
| Principles | [docs/guide/principles.md](docs/guide/principles.md) |
| Hybrid clone pipeline | [docs/workflows/hybrid-clone-pipeline.md](docs/workflows/hybrid-clone-pipeline.md) |
| CLI reference | [docs/reference/cli.md](docs/reference/cli.md) |
| Contributing | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Changelog | [CHANGELOG.md](CHANGELOG.md) |
| MCP setup | [packages/mcp/README.md](packages/mcp/README.md) |

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
    clone-template/  empty clone host
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

Health check:

```bash
npm run ctrlc -- doctor
```

### Docker demo (optional)

```bash
npm run docker:demo
# http://localhost:3040
```

See [examples/next-demo/README.md](examples/next-demo/README.md).

## Clone pipeline (one page)

```bash
npm run build
ctrlc init-clone ../my-clone --url https://example.com --scope page
cd ../my-clone && npm install

# Live URL (needs: npm i -D playwright && npx playwright install chromium)
ctrlc pipeline --url https://example.com --cwd . --out runs/example.com

# Or offline IR / external tool export
# ctrlc adapt-ir --input external.json --out runs/adapted/ir.json
# ctrlc pipeline --ir runs/adapted/ir.json --cwd .

ctrlc plan-parallel --cwd . --format md
# Agents build React sections from docs/research/components/*.spec.md
ctrlc register-from-spec --cwd . --spec docs/research/components/hero.spec.md
ctrlc qa --cwd .
npm run dev
```

Skill (Claude): `.claude/skills/ctrlc-clone/SKILL.md`  
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
| Page-first | Full site is optional |
| React only | Never HTML product dumps |
| Dual export | NL brief + code pack on every section |
| Config-first | Every section registered for packs |
| Responsible use | Rights, ToS, no phishing clones |

## Status

**0.1.x MVP** - hybrid clone + SectionPack path is implemented and tested. APIs may still evolve before 1.0.

| Ready | Notes |
|-------|--------|
| Local clone + dual export | Yes |
| Demo + Docker + CI | Yes |
| MCP for agents | Yes (MVP) |
| npm publish | Metadata ready; not published yet |
| Live URL capture | Optional Playwright peer |

MIT license. See [LICENSE](LICENSE).
