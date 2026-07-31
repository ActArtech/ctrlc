# Parallel section build (after foundation)

Dispatch **one builder per section** only after foundation is green and each section has a filled spec.

## Prerequisites (sequential, blocking)

1. Host app exists (`ctrlc init-clone` or [examples/clone-template](../../examples/clone-template/)).  
2. Phase recon complete: topology, tokens, behaviors, assets under `public/`.  
3. Foundation: fonts, CSS variables, empty page compiles (`npm run build`).  
4. For every section id in topology: `docs/research/components/<id>.spec.md` is filled (structure, content, styles, interaction model, assets, registration block).

Do **not** parallelize foundation or recon.

## Dispatch model

| Role | Owns | Must not |
|------|------|----------|
| Coordinator | Specs, topology order, page compose merge, QA | Implement all sections alone if N is large |
| Section builder | Exactly one `id` | Edit other sections' components/specs |

Each builder receives:

1. Filled spec for its id  
2. Shared tokens + screenshot refs for that section  
3. A filled copy of [section-builder.prompt.md](./section-builder.prompt.md) with placeholders set  

| Placeholder | Example |
|-------------|---------|
| `{{SECTION_ID}}` | `hero` |
| `{{TARGET_FILE}}` | `src/components/sections/Hero.tsx` |
| `{{SPEC}}` | full markdown of `hero.spec.md` |
| `{{SCREENSHOT}}` | `docs/design-references/hero-desktop.png` |

## Suggested parallel batches

- **Batch 1 (independent chrome):** promo, header, footer (if no shared animation state).  
- **Batch 2 (body):** hero, features, how-it-works, cta, etc.  
- **Serialize** sections that share one mutable file heavily (e.g. a single giant CSS module) or the same content module keys to reduce merge pain.

Prefer **content keys namespaced per section** and **CSS selectors scoped per section** so merges stay mechanical.

## Generate a dispatch plan (C5 script)

After every `docs/research/components/<id>.spec.md` exists, emit an ordered plan:

```bash
# Markdown checklist (default) - agents/humans
ctrlc plan-parallel --cwd .

# Machine-readable
ctrlc plan-parallel --cwd . --format json -o .ctrlc/parallel-plan.json

# Shell comments with optional worktree lines + echo per section
ctrlc plan-parallel --cwd . --format sh -o .ctrlc/parallel-plan.sh

# Smaller batches
ctrlc plan-parallel --cwd . --max-agents 2 --format md
```

| Flag | Meaning |
|------|---------|
| `--specs-dir` | Default `docs/research/components` |
| `--max-agents` | Concurrent builders per batch (default 4) |
| `--format` | `md` \| `json` \| `sh` |
| `--out` | Write plan to file (else stdout) |

The plan lists each section's `id`, `specPath`, target `componentPath` / `exportName`, and a `promptPathHint` to [section-builder.prompt.md](./section-builder.prompt.md). Batches group ids so you run at most `--max-agents` builders at once (chrome-like ids sorted first when possible).

Thin monorepo wrapper (optional):

```bash
node scripts/parallel-section-build.mjs --cwd <clone-host> --format md
```

## Optional: git worktrees

Worktrees isolate concurrent file edits. Optional; not required. `plan-parallel --format sh` only **documents** suggested `git worktree add` lines - it does not run them.

```bash
# From clone host root (manual / from plan sh output)
git worktree add ../clone-wt-hero -b build/hero
git worktree add ../clone-wt-features -b build/features
```

In each worktree:

1. Paste the filled section-builder prompt for that id.  
2. Implement + `ctrlc register <id> --cwd . ...`  
3. Run typecheck and dual export smoke for that id.  
4. Merge branch back to main integration branch.

Without worktrees: same rules, use separate agent sessions and merge carefully on shared files (`page.tsx`, `home.ts`, shared CSS).

## After each builder finishes

Mandatory for every section:

```bash
ctrlc register <id> --cwd . \
  --component src/components/sections/<Name>.tsx \
  --export <Name> \
  --content-module src/content/home.ts \
  --content-key <key> \
  --css src/styles/<css>.css \
  --selector .<class> \
  --interaction <model> \
  --from-spec docs/research/components/<id>.spec.md

npm run typecheck   # or npm run build
ctrlc pack <id> --format describe --cwd .
ctrlc pack <id> --format prompt-short --cwd .
```

Coordinator then:

1. Confirms `SectionBoundary` order matches `PAGE_TOPOLOGY.md`.  
2. Resolves content/CSS merge conflicts.  
3. Runs host QA:

```bash
ctrlc qa --cwd .
ctrlc list --cwd .
```

## Failure handling

| Failure | Action |
|---------|--------|
| Spec incomplete | Stop builder; fix spec; re-dispatch |
| typecheck fails | Builder fixes own files only |
| register missing | Block merge; run register |
| dual export fails | Fix paths/selectors/content keys; re-pack |
| Visual miss | Diff against screenshot; update component, not the live site |

## Anti-patterns

- Parallel builders before specs exist  
- One agent editing all sections in one messy pass without register  
- HTML dump "section" files  
- Skipping `SectionBoundary` id alignment  
- Declaring done without describe + prompt-short smoke  

## Related

- [section-builder.prompt.md](./section-builder.prompt.md)  
- [section.spec.md](./section.spec.md)  
- [hybrid-clone-pipeline.md](../workflows/hybrid-clone-pipeline.md)  
- Skill: `.claude/skills/ctrlc-clone/SKILL.md`
