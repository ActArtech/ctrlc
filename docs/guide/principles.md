# Principles

Non-negotiable product rules for CtrlC and SectionPack.

## 1. React components only

| Allowed | Not the product |
|---------|-----------------|
| TSX/JSX sections | wget / mirrored `index.html` trees as the app |
| Content modules | Webflow DOM runtime as architecture |
| Scoped CSS / tokens | `dangerouslySetInnerHTML` of scraped pages |
| Multi-file packs | "Code as-is" meaning raw HTML files |

HTML may exist only as **private recon notes**, never as what you ship.

## 2. Page-first

| Mode | Default? | Meaning |
|------|----------|---------|
| `scope=page` | **Yes** | One URL → one route → its sections |
| `scope=site` | Optional | Multi-route when you need a full marketing system |
| `scope=section` | Later | One block only |

## 3. Dual export on every section

| Button / format | Purpose |
|-----------------|---------|
| **Natural language** (`describe`) | What it is, function, motion, behavior, colors, layout, multi-file influences |
| **Code as-is** (`prompt` / zip / surfaces) | Real multi-file implementation for templates and agents |

Many sections are multi-file systems (component + content + CSS + shared UI). Both exports account for that.

## 4. Config-first registration

Every section the page uses is listed in `SectionPackConfig` with paths, selectors, and optional behavior briefs.  
Cloners **register on generate** - they do not wrap HTML after the fact.

## 5. Dev tooling by default

Inspector + pack API are for development (or explicit flags). Production stays clean unless you intentionally enable them.

## 6. Brand hygiene

Public demos use **original** copy and assets only. No third-party trademarks in the monorepo demos.

## 7. Naming

| Prefer | Avoid |
|--------|--------|
| CtrlC, SectionPack | "vertical slice", vslice |
| Packs, sections, briefs | Branding as "OS" / "open source product name" |
| Natural language / Code as-is | HTML export |

Open distribution (GitHub/npm) is optional and separate from the product name.
