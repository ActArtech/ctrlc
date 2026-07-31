# CLI reference

Binary: **`CtrlC`**  
From monorepo: `npm run ctrlc -- <command> ...`

Requires `npm run build` so `@ctrlc/core` dist and the CLI bundle (`packages/cli/dist/cli.mjs`) are available. `npm run build -w @ctrlc/cli` (or root `npm run build`) produces the esbuild bundle; `bin/ctrlc.mjs` prefers that file and falls back to `src/cli.mjs`.

Normal commands do **not** require `tsx`. `tsx` is only loaded lazily when a host SectionPack config is TypeScript (`.ts` / `.mts`) via `load-config.mjs`.

## Commands

### `list`

List sections and recipes for a host cwd.

```bash
npm run ctrlc -- list --cwd examples/next-demo
npm run ctrlc -- list --cwd examples/next-demo --json
```

### `validate`

Structure + optional path checks.

```bash
npm run ctrlc -- validate --structure-only
npm run ctrlc -- validate --cwd examples/next-demo
npm run ctrlc -- validate --config path/to/section-pack-config.ts --cwd .
```

### `pack`

Build one section pack.

```bash
npm run ctrlc -- pack hero --format describe --cwd examples/next-demo
npm run ctrlc -- pack hero --format prompt --cwd examples/next-demo -o hero.md
npm run ctrlc -- pack hero --format zip --cwd examples/next-demo -o hero.zip
```

### `pack-multi`

Comma-separated section ids, or a named recipe via `--recipe` (uses that recipe's section ids; positional ids are optional when `--recipe` is set).

```bash
npm run ctrlc -- pack-multi hero,features,cta --format describe --cwd examples/next-demo
npm run ctrlc -- pack-multi hero,cta --format zip --cwd examples/next-demo -o multi.zip
npm run ctrlc -- pack-multi --recipe landing-core --format describe --cwd examples/next-demo
```

### `scan`

Discover `src/components/sections/*.tsx` and print a draft `SectionPackConfig` JSON (React-only). Attaches heuristic `behavior` when core loads.

```bash
npm run ctrlc -- scan --cwd examples/next-demo
npm run ctrlc -- scan --cwd . > draft-sectionpack.json
```

See [Scan workflow](../workflows/scan.md).

### `schema`

Print JSON Schema for `SectionPackConfig` to stdout.

```bash
npm run ctrlc -- schema > section-pack-config.schema.json
```

### `graph`

Section dependency graph (shared content/css, imports, recipes).

```bash
npm run ctrlc -- graph --cwd examples/next-demo
npm run ctrlc -- graph --cwd examples/next-demo --md -o graph.md
npm run ctrlc -- graph --cwd examples/next-demo --json
```

### `snapshot` / `watch` / drift

```bash
npm run snapshot
# or: ctrlc snapshot --cwd examples/next-demo

npm run watch
# or: ctrlc watch --cwd examples/next-demo [--snapshot]

npm run check:drift
```

See [Watch and drift](../workflows/watch-and-drift.md).

### `library`

Export offline agent library (NL + code pack per section).

```bash
npm run library
# or: ctrlc library --cwd examples/next-demo --out .ctrlc/library
```

See [Library](../workflows/library.md).

### Clone / capture pipeline

```bash
ctrlc init-clone ../my-clone --url https://example.com --scope page
ctrlc capture https://example.com --out runs/example.com
ctrlc adapt-ir --input external.json --out runs/adapted/ir.json
ctrlc materialize-assets --ir runs/example.com/ir.json --out public/ctrlc-assets
ctrlc tokens-from-ir --ir runs/example.com/ir.json --cwd .
# optional: --max-colors 12 --max-fonts 4 --prefix ts --legacy-pc
ctrlc register-from-ir --ir runs/example.com/ir.json --cwd .
ctrlc specs-from-ir --ir runs/example.com/ir.json --cwd .
ctrlc register-from-spec --cwd . --spec docs/research/components/hero.spec.md
ctrlc register hero --cwd . --component src/components/sections/Hero.tsx --export Hero ...
ctrlc baseline --ir runs/example.com/ir.json --cwd .
ctrlc plan-parallel --cwd . --format md
ctrlc visual-diff --baseline a.png --candidate b.png --max-ratio 0.01
ctrlc pipeline --ir runs/example.com/ir.json --cwd .
ctrlc pipeline --url https://example.com --cwd . --out runs/example.com --dry-run
ctrlc qa --cwd .
ctrlc qa --cwd . --skip-build
ctrlc doctor
```

| Command | Role |
|---------|------|
| `init-clone` | Scaffold React host + research + registry |
| `capture` | URL → Page IR (Playwright optional peer) |
| `adapt-ir` | External file-map / capture JSON → Page IR |
| `pipeline` | Orchestrate post-process chain (includes scaffold-from-ir) |
| `hygienize-ir` | Drop noise, dedupe, short ids on IR |
| `scaffold-from-ir` | IR → React stubs + home.ts + page.tsx |
| `materialize-assets` | Download IR assets; Next image unwrap; logo/hero → public/ |
| `tokens-from-ir` | Curated DESIGN_TOKENS.md + tokens.css (`--ts-bg`, `--ts-accent`, top N) |
| `register-from-ir` | Registry + landing-core recipe |
| `specs-from-ir` | section.spec.md + topology |
| `register` / `register-from-spec` | Upsert one section |
| `baseline` | Screenshot baseline for QA |
| `plan-parallel` | Multi-agent section build plan |
| `visual-diff` | PNG compare (optional pngjs + pixelmatch) |
| `qa` | validate + list + optional build (`--skip-build` / `--no-build` alias) |
| `doctor` | Environment health |

See [Hybrid clone pipeline](../workflows/hybrid-clone-pipeline.md).

## Global flags (typical)

| Flag | Meaning |
|------|---------|
| `--cwd <path>` | Host project root |
| `--config <path>` | Section pack config module |
| `--json` | Machine-readable stdout where supported |
| `-o` / `--out` | Output file or directory |
| `--ir <file>` | Page IR JSON (pipeline / specs / tokens / …) |
| `--recipe <id>` | pack-multi: expand named recipe |

## Related

- [Export formats](./export-formats.md)
- [Config schema](./config-schema.md)
- [MCP](../packages/mcp.md)
