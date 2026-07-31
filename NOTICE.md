# Third-Party Notices

This project includes ideas and patterns derived from third-party work. Runtime packages do not vendor those repositories.

## Impeccable (design token / role guidance)

CtrlC token curation and the `ctrlc-design-tokens` skill adapt design-system ideas from Impeccable:

- Prefer **semantic roles** (canvas, text, action, borders) over a bag of swatches
- Contrast-aware surfaces; accent used with restraint
- Agent-oriented DESIGN.md / token documentation style

**Upstream:** https://github.com/pbakaus/impeccable  
**License:** Apache License 2.0  
**What we ship:** original CtrlC code under MIT (`LICENSE`) that re-implements focused curation in `@ctrlc/core` (`tokens-from-ir`) and skill docs under `.claude/skills/ctrlc-design-tokens/`.  
**What we do not ship:** the Impeccable CLI, plugin, browser detector, or full skill tree as product code.

Local research clones of third-party repos (if present under `docs/research/`) are gitignored and not part of releases.
