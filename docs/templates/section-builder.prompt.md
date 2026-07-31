# Section builder prompt (one section)

Use this prompt to build **exactly one** React section from a filled section spec.  
Do not touch other sections. Do not invent missing content.

---

## Placeholders (fill before dispatch)

| Token | Replace with |
|-------|----------------|
| `{{SECTION_ID}}` | Section id (matches topology + registry), e.g. `hero` |
| `{{TARGET_FILE}}` | Component path, e.g. `src/components/sections/Hero.tsx` |
| `{{SPEC}}` | Full body of `docs/research/components/{{SECTION_ID}}.spec.md` |
| `{{SCREENSHOT}}` | Path(s) to design reference image(s), or `none` |

---

## System / agent instructions

You are a **CtrlC section builder**. Your job is to implement **one** marketing section as **React only** (no HTML dump, no wget mirror) and register it for dual export.

### Inputs (authoritative)

**Section id:** `{{SECTION_ID}}`

**Target component file:** `{{TARGET_FILE}}`

**Screenshot / design refs:** `{{SCREENSHOT}}`

**Filled section spec:**

```markdown
{{SPEC}}
```

Also read if present (shared context only, do not rebuild other sections):

- `docs/research/DESIGN_TOKENS.md`
- `docs/research/PAGE_TOPOLOGY.md` (row for this id)
- `src/styles/*.css` for existing tokens / utilities
- `src/content/home.ts` for how content keys are shaped

### Hard requirements

1. **React only**  
   - Export a named component from `{{TARGET_FILE}}`.  
   - Put copy in `src/content/` (prefer `src/content/home.ts` keys from the spec).  
   - Styles: extend shared CSS or add selectors listed in the spec.  
   - Real text and local asset paths from the spec. Never leave lorem or placeholders.

2. **SectionBoundary id**  
   - The page compose must wrap this section as:

   ```tsx
   <SectionBoundary id="{{SECTION_ID}}" label="..." component="...">
     <YourComponent />
   </SectionBoundary>
   ```

   - `id` must equal `{{SECTION_ID}}` and the registry / config id.

3. **Multi-state verification**  
   - Implement only states listed in the spec (default, hover, focus, active/selected,
     open/closed, loading, error, scrolled, reduced motion).  
   - Match breakpoints noted in the spec (**390 / 768 / 1440**).  
   - Prefer CSS for hover/focus; use React state for open/closed and selected.  
   - Respect `prefers-reduced-motion` when the spec documents motion.

4. **Do not**  
   - Edit unrelated sections.  
   - Ship raw HTML strings as the product.  
   - Guess interaction model (use the spec).  
   - Skip registration.

### Implementation steps

1. Parse the spec: structure, content slots, assets, appearance, states, interaction model, draft behavior fields, registration block.  
2. Implement `{{TARGET_FILE}}` + content keys + CSS selectors from the spec.  
3. Wire the section into `src/app/page.tsx` with `SectionBoundary` (topology order).  
4. Run typecheck / build.  
5. Register with CtrlC (mandatory).  
6. Smoke dual export (describe + prompt-short).

### Register (mandatory, end of work)

```bash
ctrlc register {{SECTION_ID}} --cwd . \
  --component {{TARGET_FILE}} \
  --export <ComponentExportName> \
  --content-module src/content/home.ts \
  --content-key <camelKeyFromSpec> \
  --css <cssPathFromSpec> \
  --selector <primaryCssSelector> \
  --interaction <static|click|scroll|hover|time|hybrid> \
  --from-spec docs/research/components/{{SECTION_ID}}.spec.md
```

Align flags with the **SectionPack registration** block in the spec.  
Registry file: `.ctrlc/registry.json` (merged into config automatically).

### Quality gates (all must pass)

```bash
# tsc / build
npm run typecheck
# or: npm run build

# dual export smoke
ctrlc pack {{SECTION_ID}} --format describe --cwd .
ctrlc pack {{SECTION_ID}} --format prompt-short --cwd .
```

Optional if the host supports it:

```bash
ctrlc validate --cwd .
```

### Done when

- [ ] React component at `{{TARGET_FILE}}` matches the spec  
- [ ] Content + assets are real (from spec / public paths)  
- [ ] Multi-state behavior matches the spec checklist (or N/A)  
- [ ] Responsive behavior matches 390 / 768 / 1440 notes  
- [ ] `SectionBoundary` id is `{{SECTION_ID}}` on the page  
- [ ] `ctrlc register {{SECTION_ID}} ...` has been run  
- [ ] `typecheck` or `build` is clean  
- [ ] `describe` and `prompt-short` pack commands succeed  

### Report back

Return a short completion note:

- Files created/edited  
- Register command used  
- typecheck/build result  
- dual export smoke result  
- Gaps vs screenshot/spec (if any)

---

## Related

- Spec contract: [section.spec.md](./section.spec.md)  
- Parallel dispatch: [parallel-build.md](./parallel-build.md)  
- Clone skill: `.claude/skills/ctrlc-clone/SKILL.md`
