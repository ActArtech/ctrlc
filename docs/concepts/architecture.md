# Architecture

## Monorepo map

```text
CtrlC/
  packages/
    core/     @ctrlc/core     packs, describe, multi, recipes, zip, graph, cache, validate
    react/    @ctrlc/react    SectionPackProvider, SectionBoundary, overlay, HUD, tray
    next/     @ctrlc/next     App Router GET factory + catalog
    cli/      @ctrlc/cli      ctrlc binary
  examples/
    next-demo/                    Northline demo (port 3040)
  scripts/                        scaffold, validate-packs, drift check
  docs/                           this documentation tree
```

## Runtime flow

```text
  Host page (React sections)
           |
           |  SectionBoundary + SectionPackProvider
           v
  @ctrlc/react  ---- chips, panel, multi tray, HUD
           |
           |  GET /api/dev/section-pack?...
           v
  @ctrlc/next  ---- createSectionPackGET(config)
           |
           v
  @ctrlc/core  ---- build packs, describe, zip, recipes, graph
           |
           v
  Host filesystem (component / content / css paths from config)
```

## Page-first clone model

```text
URL (one page default)
  -> recon topology + tokens
  -> React sections + content modules + CSS
  -> SectionPackConfig entries + optional NL briefs
  -> dual export works in dev
```

Full site is opt-in: shared chrome sections registered once, routes reuse them.

## Dual export surfaces

| Layer | Natural language | Code as-is |
|-------|------------------|------------|
| Inspector | Copy NL button / `describe` | Code as-is / `prompt` / surfaces |
| API | `?format=describe` | `prompt`, `component`, `css`, `zip`, ... |
| CLI | `pack <id> --format describe` | `prompt`, `zip`, `library` |
| Library tree | `NATURAL_LANGUAGE.md` | `CODE_PACK.md` |

## Multi-file influences

A single section pack often spans:

- Component TSX
- Content module keys
- CSS selectors (+ shared utilities)
- Related shared components (`Reveal`, shells)
- Import graph edges between sections (shared content/css)

The **section graph** (`ctrlc graph`) visualizes shared-content, shared-css, import, and recipe edges.

## Caching

`createSectionPackGET` can cache single-id packs by source mtimes (`PackCache`, max 64). Disable with `{ cache: false }`.

## Related docs

- [Dual export](./dual-export.md)
- [Package: core](../packages/core.md)
- [Cloner integration](../workflows/cloner-integration.md)
