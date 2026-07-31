# Config schema

Host apps define a **`SectionPackConfig`** (usually `src/lib/section-pack-config.ts`).

## Minimal shape

```ts
import { defineSectionPackConfig } from "@ctrlc/core";

export const sectionPackConfig = defineSectionPackConfig({
  schemaVersion: 1,
  defaultVariables: {
    productName: "Acme",
    tagline: "...",
    demoHref: "/demo",
    email: "hello@acme.example",
    primaryCta: "Get started",
  },
  sharedUtilSelectors: [".btn", ".container"],
  sections: [
    {
      id: "hero",
      label: "Hero",
      description: "Primary landing hero",
      componentPath: "src/components/sections/Hero.tsx",
      componentExport: "Hero",
      contentModulePath: "src/content/home.ts",
      contentKeys: ["hero"],
      cssModulePath: "src/styles/sections.css",
      cssSelectors: [".hero"],
      relatedPaths: ["src/components/sections/shared/Reveal.tsx"],
      tags: ["hero", "cta"],
      promptRole: "Landing hero",
      behavior: {
        /* optional BehaviorBriefSpec fields */
      },
    },
  ],
  recipes: [
    {
      id: "landing-core",
      label: "Landing core",
      description: "Primary conversion path",
      sectionIds: ["header", "hero", "features", "cta"],
    },
  ],
});
```

## Field notes

| Field | Notes |
|-------|--------|
| `schemaVersion` | Optional; missing treated as `1`. Unsupported major versions fail validate. |
| `sections[].id` | Stable kebab-id; used in API, boundaries, recipes |
| Paths | Relative to host **cwd** (project root) |
| `contentKeys` | Named exports extracted from the content module |
| `cssSelectors` | Drive CSS extract for packs |
| `behavior` | Optional NL brief; auto-draft fills gaps |
| `previewImage` / `thumbnail` | Optional catalog thumb (public-relative path, site path, or URL). Prefer `public/ctrlc-previews/<id>.png` |

## JSON Schema

```bash
npm run ctrlc -- schema > section-pack-config.schema.json
```

Also exported as `@ctrlc/core/schema.json` when published.

## Validate

```bash
npm run ctrlc -- validate --cwd examples/next-demo
npm run validate:demo
```

Programmatic:

```ts
import { validateSectionPackConfig, assertConfigShape } from "@ctrlc/core";

const result = validateSectionPackConfig(config, { cwd: process.cwd() });
// result.ok, result.errors, result.warnings
```
