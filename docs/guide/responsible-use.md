# Responsible use

CtrlC helps you **extract reusable UI sections** and **recreation guidance** from pages you are allowed to analyze, then rebuild them as **React** components with SectionPack dual export.

It is **not** a tool for bulk commercial site theft, phishing, or bypassing access controls.

## Product framing (read this first)

| Lead with | Do not lead with |
|-----------|------------------|
| **React section packs** | Full website creation |
| **Recreation guidance** + dual export | Pixel-perfect full-page mirror |
| Local React reconstruction | HTML scrape / mirror host |
| Pages you have rights to use | Anything behind login / ToS bans |

Capture and pipeline outputs are **starting points for original reimplementation** - structure, content samples, and design notes - not a grant of rights to third-party brands, logos, or copy.

**Repo demos:** only the fictional **Northline** brand ships in this monorepo. Third-party product rebuilds (if any) are local tests outside the product tree - never publish them as CtrlC itself.

## Allowed (examples)

- Migrating a site **you own** off WordPress / Webflow / etc. into React  
- Recovering a modern codebase when **you have rights** but lost source  
- Learning layout and interaction techniques where permission or fair use applies  
- Internal redesign sandboxes for **your own** products  
- Extracting **your** marketing page into SectionPacks for agents and hand-off  

## Not allowed

- Phishing, impersonation, or credential capture  
- Passing off someone else’s brand, logos, or copy as your own product  
- Bypassing auth, paywalls, CAPTCHAs, or access controls  
- High-volume scraping that violates a site’s terms of service  
- Shipping a near-copy of a third-party commercial site as if it were original product UI  

## How the product reduces harm

- **React reconstruction**, not “host their HTML and pretend.”  
- **Page-first** default reduces accidental full-site crawls.  
- **Section isolation** encourages reuse of **your** rebuilt components, not wholesale site mirrors.  
- **Dual export** documents intent (brief + code) for review before ship.  
- Docs and skills state **fidelity is a ladder** (structure → content → visual pass), not a guarantee.

## Before you publish a rebuild

1. Confirm you have rights to the source material (or use only generic patterns you rewrote).  
2. Replace third-party trademarks, logos, and protected copy.  
3. Review SectionPack briefs so hand-offs do not include scraped secrets.  
4. Prefer original design tokens and assets for public demos (see monorepo Northline demo).

## Upstream alignment

This stance matches the spirit of:

- [ion-design/ditto.site](https://github.com/ion-design/ditto.site) (MIT) responsible-use docs  
- [JCodesMore/ai-website-cloner-template](https://github.com/JCodesMore/ai-website-cloner-template) (MIT) “Not Intended For” section  

See [research/ATTRIBUTION.md](../research/ATTRIBUTION.md).

## Disclaimer

Authors and contributors provide CtrlC **as-is**. You are responsible for lawful use of capture targets and of any generated code or content. When in doubt, do not capture the page.
