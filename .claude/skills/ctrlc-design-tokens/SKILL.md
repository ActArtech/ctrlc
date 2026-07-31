---
name: ctrlc-design-tokens
description: Curate and apply CtrlC design tokens from Page IR - top-N colors/fonts and semantic CSS variables (--ts-bg, --ts-accent). Use when extracting tokens, writing tokens.css / DESIGN_TOKENS.md, or applying brand roles in cloned React sections.
argument-hint: "[--ir path] [--prefix ts]"
user-invocable: true
---

# CtrlC Design Tokens

Turn capture IR into a **small, role-based** token system - not a dump of every swatch.

## Product rules

| Rule | Meaning |
|------|---------|
| **Roles over swatches** | Canvas, text, action, borders - not 40 anonymous `--color-N` vars |
| **Top N** | Cap colors (default 12) and fonts (default 4); keep the rest out of components |
| **Semantic CSS** | Prefer `var(--ts-bg)`, `var(--ts-ink)`, `var(--ts-accent)` |
| **Preserve IR** | Keep author/cssVariables from IR (`--color-bg`, etc.) and **add** `--ts-*` roles |
| **Not HTML** | Tokens feed React/Next rebuild; never ship as a mirror stylesheet dump |

## Command

```bash
ctrlc tokens-from-ir --ir runs/<host>/ir.json --cwd . --out-dir docs/research

# Options
ctrlc tokens-from-ir --ir <ir> --max-colors 12 --max-fonts 4 --max-palette 8 --prefix ts
ctrlc tokens-from-ir --ir <ir> --legacy-pc   # also emit --pc-color-N (debug only)
```

Writes:

- `tokens.css` (`:root` with semantic + preserved IR vars)
- `DESIGN_TOKENS.md` (roles table, top-N lists, usage)

Pipeline step: `ctrlc pipeline` runs tokens-from-ir unless `--skip-tokens`.

## Semantic roles (`--ts-*` default prefix)

| Variable | Role | Use in components |
|----------|------|-------------------|
| `--ts-bg` | Canvas / page ground | `background`, page shell |
| `--ts-bg-elevated` | Panels, cards, inputs | elevated surfaces |
| `--ts-ink` | Primary text | body and headings |
| `--ts-muted` | Secondary text | captions, meta |
| `--ts-accent` | Brand / action | CTAs, links, focus |
| `--ts-accent-soft` | Soft accent fill | chips, hover washes |
| `--ts-line` | Borders / separators | hairlines, dividers |
| `--ts-font` / `--ts-font-sans` | Body family | typography |
| `--ts-font-serif` / `--ts-font-mono` | When detected | display / code |
| `--ts-palette-N` | Reference only | do not use until promoted to a role |

## How curation works

1. Collect colors/fonts from `ir.tokens` + section `styles`.
2. Detect theme (dark/light) from background luminance and IR hints.
3. Map roles using luminance/saturation + IR var name hints (`--color-bg`, `--color-accent`).
4. Cap to top N; emit semantic vars first, then limited palette refs.
5. Document roles in `DESIGN_TOKENS.md` for agents.

## Apply in the clone (foundation)

1. Import tokens in host CSS:

```css
@import "./tokens.css"; /* or path under src/styles/ */
```

2. Wire section chrome to roles:

```tsx
<section style={{ background: "var(--ts-bg)", color: "var(--ts-ink)" }}>
  <button style={{ background: "var(--ts-accent)", color: "var(--ts-bg)" }}>
    ...
  </button>
</section>
```

3. Prefer tokens over hard-coded hex from screenshots. If a hard-coded value appears 3+ times with the same intent, promote it to a role or a named IR var - not another palette dump.

## Design quality (Impeccable-inspired)

Ideas adapted from [Impeccable](https://github.com/pbakaus/impeccable) (Apache-2.0; **not vendored** into CtrlC runtime):

- **Build roles, not a bag of swatches** - every color needs a stable job (canvas, text, action, line, state).
- **Let accent own deliberate regions** - primary CTA and brand moments; do not scatter accent on decoration.
- **Contrast** - body text vs canvas should aim for WCAG AA (4.5:1 body, 3:1 large/UI). Soft alpha lines are for borders, not body text.
- **Theme** - dark and light are composed (elevation steps), not mechanical invert.
- **Fonts** - one sans for UI body; mono only for code; avoid stacking many display families.
- **OKLCH** - when *authoring* new ramps by hand, prefer OKLCH for predictable lightness; curated IR values keep source formats (hex/rgb/oklch) as captured.

See also monorepo `NOTICE.md` (third-party attribution).

## Agent checklist

- [ ] `ctrlc tokens-from-ir` ran after capture / hygiene
- [ ] `DESIGN_TOKENS.md` lists semantic roles with real values
- [ ] Components use `var(--ts-*)` (or project prefix) instead of raw hex for brand surfaces
- [ ] Accent is rare and purposeful
- [ ] Top-N caps respected; no 30-color dump in components
- [ ] IR-preserved vars still present if the host already depended on them

## Anti-patterns

- Emitting only `--pc-color-1..N` with no roles
- Using `--ts-palette-N` as the primary styling API
- Replacing confirmed brand IR vars without mapping them into roles
- Inventing a second parallel token system in the clone
- Vendoring the full Impeccable repo into product packages

## Related

- Clone flow: `.claude/skills/ctrlc-clone/SKILL.md` (Phase 1 tokens, Phase 2 foundation)
- API: `extractTokensFromIR` / `writeTokensFromIR` in `@ctrlc/core`
- Backlog: B5 / B5b in `docs/backlog/CLONE_PIPELINE_BACKLOG.md`
