# Contributing

**Positioning:** CtrlC extracts **reusable UI sections** and **recreation guidance** (SectionPack dual export) - not a full-site HTML cloner. Prefer that framing in docs, issues, and PRs. See [docs/guide/principles.md](docs/guide/principles.md) and [docs/guide/responsible-use.md](docs/guide/responsible-use.md).

## Docs

Start at **[docs/README.md](docs/README.md)**.

Structure:

```text
docs/
  guide/       onboarding + principles
  concepts/    architecture, dual export
  reference/   CLI, API, formats, config
  workflows/   cloner, scan, library, drift, scaffold
  packages/    core, react, next, cli
  backlog/     epic status (CLONE_PIPELINE_BACKLOG.md)
```

When you add a feature, update the matching folder and the docs hub index.

## Install, build, test

Requirements: **Node.js 20+**, npm 10+ (workspaces).

```bash
# from monorepo root
npm install
npm run build
npm test
npm run validate
npm run validate:demo
```

Package-scoped smoke tests:

```bash
npm run test -w @ctrlc/cli
npm run test -w @ctrlc/core
npm run test -w @ctrlc/capture
```

CLI entry:

```bash
npm run ctrlc -- --help
npm run ctrlc -- doctor
```

## Product rules

- React components only (never HTML dumps as product)
- Page-first (site optional)
- Dual export: natural language + code as-is
- Prefer **CtrlC** / **SectionPack** naming (not vertical slice / OS)

## Packages

| Package | Path |
|---------|------|
| `@ctrlc/core` | `packages/core` |
| `@ctrlc/react` | `packages/react` |
| `@ctrlc/next` | `packages/next` |
| `@ctrlc/capture` | `packages/capture` |
| `@ctrlc/cli` | `packages/cli` |
| `@ctrlc/mcp` | `packages/mcp` |

MCP tests (optional, not in root `npm test`):

```bash
npm run test:mcp
```

Security policy: [SECURITY.md](SECURITY.md).

## How to add a section pack

1. **Implement** a React section under `src/components/sections/<Name>.tsx`.
2. **Content** keys in `src/content/...` and CSS selectors under shared section CSS.
3. **Register** so SectionPack config knows about it:

```bash
ctrlc register hero \
  --cwd . \
  --component src/components/sections/Hero.tsx \
  --export Hero \
  --content-module src/content/home.ts \
  --content-key hero \
  --css src/styles/sections.css \
  --selector .hero
```

Or from a filled section spec:

```bash
ctrlc register-from-spec --cwd . --spec docs/research/components/hero.spec.md
```

4. **Validate and export**:

```bash
ctrlc validate --cwd .
ctrlc pack hero --format describe --cwd .
ctrlc library --cwd .
```

5. Wrap the section in `<SectionBoundary id="hero" ...>` on the page route.

Empty host scaffold: `examples/clone-template` or `ctrlc init-clone ../my-clone --url https://example.com`.

## Capture pipeline

End-to-end IR path for a clone project:

```bash
ctrlc init-clone ../my-clone --url https://example.com --scope page
cd ../my-clone && npm install

# One-shot orchestrator (preferred)
ctrlc pipeline --url https://example.com --cwd . --out runs/example.com

# Or step by step / offline IR
ctrlc pipeline --ir runs/example.com/ir.json --cwd .
# Preview without side effects:
ctrlc pipeline --ir packages/capture/fixtures/sample-ir.json --cwd . --dry-run
```

Manual steps (same as `pipeline` internals):

```bash
ctrlc capture https://example.com --out runs/example.com
ctrlc materialize-assets --ir runs/example.com/ir.json --out public/ctrlc-assets
ctrlc tokens-from-ir --ir runs/example.com/ir.json --cwd . --out-dir docs/research
ctrlc register-from-ir --ir runs/example.com/ir.json --cwd .
ctrlc specs-from-ir --ir runs/example.com/ir.json --cwd .
ctrlc baseline --ir runs/example.com/ir.json --cwd .   # optional screenshot
```

Then agents build React sections from `docs/research/components/*.spec.md`, register, and QA:

```bash
ctrlc register-from-spec --cwd . --spec docs/research/components/hero.spec.md
ctrlc qa --cwd .
npm run dev
```

Live capture needs optional Playwright:

```bash
npm install -D playwright
npx playwright install chromium
```

Skill: `.claude/skills/ctrlc-clone/SKILL.md`  
Workflow: [docs/workflows/hybrid-clone-pipeline.md](docs/workflows/hybrid-clone-pipeline.md)

## License

MIT. See [LICENSE](./LICENSE).
