# init-clone + register (Sprint 1)

Every clone should ship with **SectionPack pre-wired** and **register sections as they are built**.

## `ctrlc init-clone`

Scaffolds (or upgrades) a project:

```bash
# From CtrlC monorepo root
npm run build
ctrlc init-clone ../my-clone --url https://example.com --scope page
cd ../my-clone && npm install && npm run dev
```

### What it creates

| Path | Purpose |
|------|---------|
| Next app from next-demo | React sections + provider + API |
| `.ctrlc/clone-meta.json` | Source URL + scope |
| `.ctrlc/registry.json` | Empty registry for `register` |
| `docs/research/*` | Topology, tokens, behaviors stubs |
| `docs/design-references/` | Screenshots |
| `AGENTS.md` | Agent handoff rules |
| `.claude/skills/ctrlc-clone/SKILL.md` | Full clone skill |

### Flags

| Flag | Meaning |
|------|---------|
| `--url` | Source page URL |
| `--scope page\|site` | Default `page` |
| `--no-scaffold` | Only add research/registry/skill (existing app) |
| `--force` | Re-run scaffold even if package.json exists |

## `ctrlc register`

After each section component is implemented:

```bash
ctrlc register hero --cwd . \
  --component src/components/sections/Hero.tsx \
  --export Hero \
  --content-module src/content/home.ts \
  --content-key hero \
  --css src/styles/demo.css \
  --selector .hero \
  --interaction scroll \
  --from-spec docs/research/components/hero.spec.md
```

Writes/updates `.ctrlc/registry.json`.  
Config loaders merge this file automatically (CLI + demo API via `getSectionPackConfig()`).

Also:

- Drafts **behavior** brief from interaction model + optional spec markdown  
- Auto-creates a simple `landing-core` recipe when 2+ sections exist  

## `ctrlc qa`

```bash
ctrlc qa --cwd .
ctrlc qa --cwd . --skip-build   # when npm run dev is running
ctrlc qa --cwd . --no-build       # alias of --skip-build
```

Runs: load config (+ registry) → validate → list → optional `npm run build`. Prefer `--skip-build` while `npm run dev` is running (`--no-build` is an alias).

## Skill

Use **`/ctrlc-clone <url>`** or open:

`.claude/skills/ctrlc-clone/SKILL.md`

Mandatory loop: **spec → React build → register → dual export smoke**.

## Related

- [Cloner integration](./cloner-integration.md)
- [Hybrid pipeline](./hybrid-clone-pipeline.md)
- [Section spec template](../templates/section.spec.md)
