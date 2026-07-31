# Section spec: `{{id}}`

> Contract between recon/capture and the React builder.  
> Fill before building. Builders must not guess missing values.

## Meta

| Field | Value |
|-------|--------|
| **id** | `{{id}}` |
| **label** | {{label}} |
| **Source URL** | {{sourceUrl}} |
| **Scope** | {{scope}} |
| **INTERACTION MODEL** | {{interactionModel}} |
| **Priority** | P0 / P1 / P2 |

## Structure

DOM outline (semantic):

```text
{{structure}}
```

## Content (real text)

| Slot | Text |
|------|------|
{{contentRows}}

## Text sample

{{textSample}}

## Assets (local paths after download)

| Role | Path |
|------|------|
{{assetRows}}

## Appearance (computed / IR)

| Element | Property | Value |
|---------|----------|-------|
{{styleRows}}

## States

Multi-state extraction checklist (C3). Mark N/A when the section has no such state.
Fill computed styles / content diffs under each applicable state.

### Checklist

- [ ] **Default** - resting appearance at load
- [ ] **Hover** - pointer hover on primary controls / cards / links
- [ ] **Focus** - keyboard focus rings on interactive elements
- [ ] **Active / selected** - pressed button, selected tab, current nav item
- [ ] **Open / closed** - accordion, menu, dropdown, dialog, disclosure
- [ ] **Loading** - skeleton, spinner, disabled-while-fetch (if any)
- [ ] **Error** - validation / empty / failed state (if any)
- [ ] **Scrolled** - sticky header shrink, reveal, parallax, snap
- [ ] **Reduced motion** - `prefers-reduced-motion`: static fallbacks
- [ ] **Breakpoints** - document 390 / 768 / 1440 (see Responsive)

### Default

{{stateDefault}}

### Hover

{{stateHover}}

### Focus

{{stateFocus}}

### Active / selected

{{stateActive}}

### Open / closed (accordion, menu, dialog)

{{stateOpenClosed}}

### Loading

{{stateLoading}}

### Error

{{stateError}}

### Scrolled (if any)

{{stateScrolled}}

### Reduced motion

{{stateReducedMotion}}

### Responsive

Capture notes at **390**, **768**, and **1440** width (plus any extra breakpoints the source uses).

| Breakpoint | Changes |
|------------|---------|
| 390 | {{responsive390}} |
| 768 | {{responsive768}} |
| 1440 | {{responsive1440}} |
{{responsiveRows}}

## Behavior (for SectionPack NL brief)

| Field | Draft |
|-------|--------|
| whatItIs | {{whatItIs}} |
| function | {{function}} |
| behavior | {{behavior}} |
| motion | {{motion}} |
| layout | {{layout}} |
| color | {{color}} |
| type | {{type}} |
| responsive | {{responsive}} |
| a11y | {{a11y}} |
| influences | {{influences}} |
| rebuildGuidance | {{rebuildGuidance}} |

## SectionPack registration

```ts
{
  id: "{{id}}",
  label: "{{label}}",
  description: "{{description}}",
  componentPath: "src/components/sections/{{Pascal}}.tsx",
  componentExport: "{{Pascal}}",
  contentModulePath: "src/content/home.ts",
  contentKeys: ["{{camel}}"],
  cssModulePath: "src/styles/sections.css",
  cssSelectors: [".{{class}}"],
  tags: [],
  promptRole: "{{label}}",
}
```

## Builder checklist

- [ ] React component only (no HTML dump)
- [ ] Real content and assets
- [ ] Interaction model matches live page
- [ ] Multi-state checklist completed (or N/A justified)
- [ ] Responsive notes for 390 / 768 / 1440
- [ ] `tsc` / build clean
- [ ] `SectionBoundary` id matches config
- [ ] describe + prompt exports work
