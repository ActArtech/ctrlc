# Scan workflow

`ctrlc scan` is a **Phase 3 bootstrap** helper. It discovers React section components and prints a draft `SectionPackConfig` JSON.

**React-only:** `src/components/sections/*.tsx` (skips `index.*`, tests, stories). No HTML dumps.

## Command

```bash
npm run build
npm run ctrlc -- scan --cwd examples/next-demo
npm run ctrlc -- scan --cwd . > draft-sectionpack.json
```

Stdout = draft config JSON. Progress notes go to stderr.

## What it discovers

| Field | How it is guessed |
|-------|-------------------|
| `id` | Filename PascalCase → kebab |
| `componentPath` / `componentExport` | File + matching export |
| `contentModulePath` | First of `src/content/home.ts`, `page.ts`, ... |
| `contentKeys` | CamelCase from filename |
| `cssModulePath` | First of `demo.css`, `sections.css`, `globals.css`, ... |
| `cssSelectors` | Tokens from `className="..."` |
| `relatedPaths` | `sections/shared/*` when present |
| `behavior` | Heuristic draft via core analysis when available |

Also emits `defaultVariables`, `sharedUtilSelectors`, and a draft recipe listing scanned ids.

## After scan

1. Review and edit paths/exports  
2. Paste into `section-pack-config.ts` via `defineSectionPackConfig`  
3. Wire `SectionBoundary` for each id  
4. `ctrlc validate --cwd .`  
5. Hand-edit `behavior` briefs before shipping  

## Related

- [Cloner integration](./cloner-integration.md)
- [CLI](../reference/cli.md)
