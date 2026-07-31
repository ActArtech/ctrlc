# Cloner integration

How a CtrlC **cloner** (agent, skill, or human pipeline) should produce a React app that SectionPack can export immediately.

## Product contract

| Rule | Detail |
|------|--------|
| Scope default | `scope=page` - one page first |
| Scope optional | `scope=site` after page quality is solid |
| Surface | **React only** - never HTML dumps as product |
| Dual export | Every section: natural language + code as-is |
| Config-first | Every section has a `SectionPackConfig` entry |

Success: hover a section in dev, copy describe or prompt; `?list=1` returns every section id.

## Suggested invocation

```text
/CtrlC <url>                         # scope=page (default)
/CtrlC <url> --scope=site
/CtrlC <url> --scope=section --id=hero
```

## Phases

### Phase 0 - Scaffold

- Next app + `@ctrlc/*` wired  
- `SectionPackProvider` + section-pack CSS  
- Empty or draft `section-pack-config.ts`  
- API route `createSectionPackGET`  
- Record source URL + scope in project meta  

### Phase 1 - Recon (in-scope only)

- **page:** one document topology, tokens, motion notes  
- **site:** route list then per-page recon (prioritized)  
- **section:** one block + page tokens for fidelity  

Output notes feed NL briefs (hand or auto-draft).

### Phase 2 - Foundation

- Design tokens, fonts, layout primitives  
- Shared chrome components if multi-page  

### Phase 3 - Sections

For each in-scope section:

1. Implement React component (not HTML shell)  
2. Content module keys  
3. Scoped CSS  
4. Append config entry (paths, selectors, tags)  
5. Optional behavior brief; auto-draft fills gaps  
6. Wrap with `SectionBoundary id=...`  

Bootstrap paths with:

```bash
ctrlc scan --cwd .
```

See [Scan](./scan.md).

### Phase 4 - Recipes

From page section order, emit recipes e.g. `landing-core`, `conversion`.

### Phase 5 - QA

```bash
npm run build
ctrlc validate --cwd .
ctrlc list --cwd .
ctrlc snapshot --cwd .   # optional CI baselines
# manual: packs on, copy NL + code for 2-3 sections
```

## Emit checklist (per section)

- [ ] Component file exists  
- [ ] Content keys exist  
- [ ] CSS selectors match real classes  
- [ ] Boundary `id` matches config `id`  
- [ ] `list=1` includes the id  
- [ ] `describe` and `prompt` return 200  

## Anti-patterns

| Do not | Do |
|--------|-----|
| Ship wget HTML as the app | Build React sections |
| Register packs only at the end | Register as each section ships |
| Full-site crawl first | Page default |
| Empty behavior forever | Auto-draft + edit |

## Related

- [Principles](../guide/principles.md)
- [Config schema](../reference/config-schema.md)
- [Scan](./scan.md)
