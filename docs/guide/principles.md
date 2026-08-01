# Principles

Non-negotiable product rules for CtrlC and SectionPack.

## 0. Sections first (positioning)

| Lead with | Avoid as the hero pitch |
|-----------|-------------------------|
| Reusable UI **sections** and **components** | “Creates the full website” |
| **Recreation guidance** + dual export | Generic site cloner / scraper |
| Local React rebuild you control | Pixel-perfect full-site guarantee |

Full-page assembly is a **composition** of registered sections. Capture is an aid - not a license or a fidelity SLA.

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
| `scope=page` | **Yes** | One URL → sections on one route |
| `scope=site` | Optional | Multi-route only when explicitly needed |
| `scope=section` | Supported in workflow | One block only |

## 3. Dual export on every section

| Button / format | Purpose |
|-----------------|---------|
| **Natural language** (`describe`) | What it is, function, motion, behavior, colors, layout, multi-file influences |
| **Code as-is** (`prompt` / zip / surfaces) | Real multi-file implementation for templates and agents |

Many sections are multi-file systems (component + content + CSS + shared UI). Both exports account for that.

## 4. Config-first registration

Every section the page uses is listed in `SectionPackConfig` with paths, selectors, and optional behavior briefs.  
Builders **register on generate** - they do not wrap scraped HTML after the fact.

## 5. Fidelity is a ladder (honest)

| Stage | Outcome |
|-------|---------|
| Structure | Section order, ids, boundaries, dual export |
| Content | Copy, CTAs, lists, assets |
| Visual pass | Tokens, layout, motion polish (manual / agent) |

Do not promise capture alone equals the live site.

## 6. Dev tooling by default

Inspector + pack API are for development (or explicit flags). Production stays clean unless you intentionally enable them.

## 7. Brand hygiene

Public demos use **original** copy and assets only. No third-party trademarks in the monorepo demos.

## 8. Naming

| Prefer | Avoid |
|--------|--------|
| CtrlC, SectionPack | "vertical slice", vslice |
| Packs, sections, briefs | Branding as "OS" |
| Natural language / Code as-is | HTML export as product |
| Extract / rebuild sections | "Clone any website" as the tagline |

Open distribution (GitHub/npm) is optional and separate from the product name.

## 9. Responsible use

Only analyze pages you have rights to use. See [responsible-use.md](./responsible-use.md).
