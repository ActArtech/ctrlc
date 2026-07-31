# CtrlC documentation

**CtrlC** builds **React** marketing pages (one page by default, full site optional).  
**SectionPack** is the dual-export layer on every section:

1. **Natural language** - function, motion, behavior, layout, color, multi-file influences  
2. **Code as-is** - multi-file component pack (TSX + content + CSS + deps)

Never ship mirrored HTML dumps as the product.

## Start here

| Path | Audience |
|------|----------|
| [Guide: Getting started](./guide/getting-started.md) | First install + demo |
| [Guide: Principles](./guide/principles.md) | Non-negotiable product rules |
| [Guide: Responsible use](./guide/responsible-use.md) | Legal / ethics |
| [Concepts: Architecture](./concepts/architecture.md) | How packages fit together |
| [Concepts: Dual export](./concepts/dual-export.md) | Natural language vs code packs |

## Reference

| Path | Topic |
|------|--------|
| [Export formats](./reference/export-formats.md) | `describe`, `prompt`, zip, multi, recipes, `var.*` |
| [CLI](./reference/cli.md) | `CtrlC` commands |
| [HTTP API](./reference/api.md) | `/api/dev/section-pack` |
| [Config schema](./reference/config-schema.md) | `SectionPackConfig` + JSON Schema |

## Workflows

| Path | Topic |
|------|--------|
| [Hybrid clone pipeline](./workflows/hybrid-clone-pipeline.md) | Ditto + AI cloner ideas → CtrlC |
| [init-clone + register](./workflows/init-clone.md) | Scaffold + auto SectionPack registration |
| [Capture → specs → register](./workflows/hybrid-clone-pipeline.md) | IR capture + section specs |
| [Cloner integration](./workflows/cloner-integration.md) | Page-first React clone pipeline |
| [Scan bootstrap](./workflows/scan.md) | Discover sections → draft config |
| [Library export](./workflows/library.md) | Offline agent context tree |
| [Watch and drift](./workflows/watch-and-drift.md) | Live rebuild + CI fingerprints |
| [Scaffold apps](./workflows/scaffold.md) | `create-ctrlc-app` |

## Research and backlog

| Path | Topic |
|------|--------|
| [Prior art: Ditto + AI cloner](./research/PRIOR_ART.md) | What to learn; hybrid architecture |
| [Attribution](./research/ATTRIBUTION.md) | MIT study policy |
| [Clone pipeline backlog](./backlog/CLONE_PIPELINE_BACKLOG.md) | Implementable epic/sprint list |
| [Section spec template](./templates/section.spec.md) | Contract for builders |
| [Section builder prompt](./templates/section-builder.prompt.md) | One-section agent build prompt |
| [Parallel build](./templates/parallel-build.md) | Dispatch multiple section builders |

## Packages

| Path | Package |
|------|---------|
| [core](./packages/core.md) | `@ctrlc/core` |
| [react](./packages/react.md) | `@ctrlc/react` |
| [next](./packages/next.md) | `@ctrlc/next` |
| [capture](./packages/capture.md) | `@ctrlc/capture` |
| [cli](./packages/cli.md) | `@ctrlc/cli` |
| [mcp](./packages/mcp.md) | `@ctrlc/mcp` |

## Docs layout

```text
docs/
  README.md                 <- you are here
  guide/                    <- onboarding
  concepts/                 <- mental models
  reference/                <- APIs, formats, CLI
  workflows/                <- day-to-day / agent pipelines
  packages/                 <- per-package notes
  research/                 <- prior art + attribution
  backlog/                  <- epic status
  templates/                <- specs + builder prompts
```

## Quick commands

```bash
cd CtrlC
npm install && npm run build
npm test && npm run test:mcp
npm run validate && npm run validate:demo
npm run ctrlc -- doctor
npm run dev:demo
# http://localhost:3040
```
