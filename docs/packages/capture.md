# `@ctrlc/capture`

Page recon into **Page IR** for React rebuild (never an HTML dump product).

## Install

Workspace package. From monorepo root after `npm install` + `npm run build`:

```bash
npm run build -w @ctrlc/capture
```

Optional peer for **live** browser capture:

```bash
npm i -D playwright
npx playwright install chromium
```

Without Playwright: IR types, `writeIr`, section id helpers, materialize, and fixtures still work.

## Main API

| Export | Role |
|--------|------|
| `capturePage(url, { outDir, materializeAssets? })` | Live recon → `ir.json` + screenshot when Playwright present |
| `materializeAssets` / `materializeAssetsFromFile` | Download assets; stable names + `localPath` |
| `PAGE_IR_SCHEMA_VERSION` / `PageIR` types | Schema v1 |
| `normalizeSectionId` / `uniqueSectionIds` | Stable section ids |

## CLI

```bash
ctrlc capture https://example.com --out runs/example.com
ctrlc materialize-assets --ir runs/example.com/ir.json --out public/ctrlc-assets
```

## Fixtures / tests

```bash
npm run test -w @ctrlc/capture
```

- `fixtures/sample-page.html` - multi-section landmark page  
- `fixtures/sample-ir.json` - golden IR (no browser required)

## See also

- [Hybrid clone pipeline](../workflows/hybrid-clone-pipeline.md)
- [CLI](../reference/cli.md)
