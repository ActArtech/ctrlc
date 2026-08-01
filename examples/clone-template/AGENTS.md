# Agent notes - CtrlC section host

**Source URL:** (set with ctrlc init-clone --url or edit this file)  
**Scope:** page (page default; multi-page only if requested)  
**Stack:** Next.js App Router + React sections + **SectionPack**

## Positioning

- **React section packs + recreation guidance** - not full website creation or HTML scraping.  
- **Dual export** (NL brief + multi-file code pack) is the hand-off.  
- **Fidelity ladder:** structure → content → visual pass. Capture alone is not pixel parity.  
- Only analyze pages you have **rights** to use. See monorepo `docs/guide/responsible-use.md`.

## Non-negotiable

1. **React components only** - never ship HTML dumps / wget mirrors as the product.  
2. **Sections first** - isolate hero, pricing, nav, etc.; page is composition of packs.  
3. **Page-first** - one URL unless multi-page scope is requested.  
4. **Dual export always** - after each section builds, register it for:
   - **Natural language** (`describe`)
   - **Code as-is** (`prompt` / zip)  
5. **Spec before build** - write `docs/research/components/<id>.spec.md` first.  
6. **Build must compile** - `npm run build` / `ctrlc qa` before done. While `npm run dev` runs, use `ctrlc qa --skip-build`.

## SectionPack auto-register (required)

After each section component is implemented:

```bash
ctrlc register <id> --cwd . \
  --component src/components/sections/<Name>.tsx \
  --export <Name> \
  --content-module src/content/home.ts \
  --content-key <camelKey> \
  --css src/styles/app.css \
  --selector .<css-class> \
  --interaction scroll|click|hover|static|time|hybrid \
  --from-spec docs/research/components/<id>.spec.md
```

Then wrap in page:

```tsx
<SectionBoundary id="<id>" label="..." component="<Name>">
  <Name />
</SectionBoundary>
```

Registry lives at `.ctrlc/registry.json` and is **merged automatically** when loading config.

## Skill

Follow `.claude/skills/ctrlc-clone/SKILL.md` (or monorepo skill of the same name).

## Research layout

```text
docs/research/PAGE_TOPOLOGY.md
docs/research/DESIGN_TOKENS.md
docs/research/BEHAVIORS.md
docs/research/components/<id>.spec.md
docs/design-references/
```

## QA

```bash
ctrlc validate --cwd .
ctrlc list --cwd .
ctrlc pack <id> --format describe --cwd .
ctrlc pack <id> --format prompt-short --cwd .
ctrlc qa --cwd . --skip-build
```
