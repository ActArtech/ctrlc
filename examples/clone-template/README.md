# @ctrlc/clone-template

Minimal empty **clone host** for CtrlC:

- Next.js App Router + `SectionPackProvider`
- Empty page (`compose sections here`)
- SectionPack API with **empty** base config + `.ctrlc/registry.json` merge
- Research stubs under `docs/research/`
- `AGENTS.md` for agent handoff
- Dual export ready: natural language + code as-is per section (after `ctrlc register`)

Lighter than `examples/next-demo` (no Northline demo sections).
Reference a full dual-export section shape via **HowItWorks** in `examples/next-demo`.

## Requirements

- Node.js **20+** (`engines` + monorepo `.nvmrc`)

## Use with `ctrlc init-clone`

From the monorepo root (preferred path for a new clone project):

```bash
npm run build
ctrlc init-clone ../my-clone --url https://example.com --scope page
cd ../my-clone && npm install && npm run dev
```

`init-clone` prefers this template: scaffolds a full app, research dirs, empty
`.ctrlc/registry.json`, AGENTS.md, and skill. Falls back to next-demo if
this package is missing.

## Capture -> specs -> register flow

Recommended pipeline for a real target URL (run from monorepo after `npm run build`):

```bash
# 1) Page recon -> Page IR (+ screenshot when playwright is available)
ctrlc capture https://example.com --out runs/example

# 2) Scaffold host (if not already)
ctrlc init-clone ../my-clone --url https://example.com --scope page

# 3) IR -> section.spec.md files under docs/research/components/
ctrlc specs-from-ir --ir runs/example/ir.json --cwd ../my-clone

# 4) Implement React sections from each *.spec.md (see AGENTS.md)
#    Then register (path inferred from id):
ctrlc register-from-spec --cwd ../my-clone \
  --spec docs/research/components/<id>.spec.md

# Or full register flags:
ctrlc register <id> --cwd ../my-clone \
  --component src/components/sections/<Name>.tsx \
  --export <Name> \
  --content-module src/content/home.ts \
  --content-key <key> \
  --css src/styles/app.css \
  --selector .<class> \
  --interaction scroll \
  --from-spec docs/research/components/<id>.spec.md

# 5) Dual export smoke + QA
ctrlc pack <id> --format describe --cwd ../my-clone
ctrlc pack <id> --format prompt-short --cwd ../my-clone
ctrlc validate --cwd ../my-clone
ctrlc qa --cwd ../my-clone
```

npm script aliases in this package (after monorepo install, `CtrlC` on PATH):

```bash
npm run validate -w @ctrlc/clone-template
npm run qa -w @ctrlc/clone-template
npm run list -w @ctrlc/clone-template
npm run scan -w @ctrlc/clone-template
```

## Or copy this folder

```bash
# From monorepo root
cp -r examples/clone-template ../my-clone
cd ../my-clone
# Adjust package name in package.json if needed
npm install
npm run build   # monorepo packages must be built first if using file: deps
npm run dev
```

When used inside the monorepo workspace, deps resolve via `file:../../packages/*`.  
If you copy outside the monorepo, repoint `@ctrlc/*` deps or run `npm pack` / link.

## Layout

```text
src/app/page.tsx                      # compose sections here
src/app/layout.tsx                    # SectionPackProvider
src/app/api/dev/section-pack/route.ts # empty config + registry merge
src/lib/section-pack-config.ts        # sections: [] + getSectionPackConfig()
src/components/sections/              # add React sections
src/content/home.ts
src/styles/app.css
docs/research/                        # topology, tokens, behaviors, specs
.ctrlc/registry.json              # ctrlc register target
AGENTS.md
```

## Build loop (per section)

1. Write `docs/research/components/<id>.spec.md` from monorepo `docs/templates/section.spec.md`
   (or generate via `ctrlc specs-from-ir`).  
2. Implement React component + content + CSS.  
3. Wrap with `SectionBoundary` on the page.  
4. Register (see flow above).  
5. Smoke dual export with `ctrlc pack`.

## Parallel builders

See monorepo:

- `docs/templates/section-builder.prompt.md`
- `docs/templates/parallel-build.md`
- `.claude/skills/ctrlc-clone/SKILL.md`

## Run in monorepo

```bash
# root
npm install && npm run build
npm run dev -w @ctrlc/clone-template
# http://localhost:3041
```
