# `@ctrlc/react`

Inspector UI for SectionPack.

## Components

| Export | Role |
|--------|------|
| `SectionPackProvider` | Mode toggle, list fetch, tray, HUD, toasts |
| `SectionBoundary` | Hover chip host (`data-section-pack`) |
| `PackOverlay` | Panel: NL / code formats, files, brief |
| `SectionPackRegion` | Optional region wrapper |
| `useSectionPack` / `useSectionPackMode` | Hooks |

## Styles

```ts
import "@ctrlc/react/styles/section-pack.css";
// class prefix: spack-
```

## Defaults

| Setting | Value |
|---------|--------|
| API base | `/api/dev/section-pack` |
| Catalog | `/dev/packs` |
| Toggle | `Ctrl/Cmd+Shift+P` |
| Query | `?packs=1` / `?packs=0` |

## User-facing copy

- Packs ON / OFF  
- Natural language  
- Code as-is  

## Related

- [Getting started](../guide/getting-started.md)
- [Dual export](../concepts/dual-export.md)
