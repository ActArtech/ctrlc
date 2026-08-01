# Getting started

## What you get

| Piece | Role |
|-------|------|
| **CtrlC** | **React section packs + recreation guidance** (not full website creation, not HTML scraping) |
| **SectionPack** | Per-section dual export: **natural language** guidance + **code as-is** packs |
| **Northline demo** | Fictional analytics brand on port **3040** - only product demo brand in this repo |

Read [Responsible use](./responsible-use.md) before capturing third-party URLs.

## Prerequisites

- Node.js **20+** (see `.nvmrc`)
- npm **10+** (workspaces)
- Optional: Playwright for live URL capture; Docker for `npm run docker:demo`

## Install and run the demo

From monorepo root:

```bash
npm install
npm run build
npm test
npm run validate
npm run validate:demo
npm run dev:demo
```

| URL | What |
|-----|------|
| http://localhost:3040 | Northline home + SectionPack inspector |
| http://localhost:3040/dev/packs | Pack catalog |
| http://localhost:3040/api/dev/section-pack?list=1 | Section list JSON |

### Inspector shortcuts

| Action | Shortcut |
|--------|----------|
| Toggle packs | `Ctrl/Cmd + Shift + P` |
| Force on/off | `?packs=1` / `?packs=0` |
| Copy open panel format | `Ctrl/Cmd + Shift + C` |
| Select all visible sections | `Ctrl/Cmd + Shift + A` |
| Clear selection | `Ctrl/Cmd + Shift + D` |
| Cycle focused section | `[` / `]` |

Hover a section chip → **Natural language** or **Code as-is**.

Pack HUD (top-right when packs are on): section count, selection count, last copy, catalog link.

## Scaffold a new app

```bash
npm run create -- ../my-app
cd ../my-app
npm install
npm run dev
```

Copies the React-only next-demo skeleton and points `@ctrlc/*` at monorepo `file:` packages.

## Wire SectionPack into an existing Next app

### 1. Dependencies

```bash
npm install @ctrlc/core @ctrlc/react @ctrlc/next
```

```ts
// next.config
transpilePackages: ["@ctrlc/react", "@ctrlc/core", "@ctrlc/next"]
```

### 2. Config

```ts
// lib/section-pack-config.ts
import { defineSectionPackConfig } from "@ctrlc/core";

export const sectionPackConfig = defineSectionPackConfig({
  schemaVersion: 1,
  defaultVariables: {
    productName: "Acme",
    tagline: "Ship faster",
    demoHref: "/demo",
    email: "hello@acme.example",
    primaryCta: "Get started",
  },
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
      tags: ["hero", "cta"],
      promptRole: "Landing hero",
    },
  ],
  recipes: [
    {
      id: "landing-core",
      label: "Landing core",
      sectionIds: ["hero"],
    },
  ],
});
```

### 3. Provider + CSS

```tsx
// app/layout.tsx
import { SectionPackProvider } from "@ctrlc/react";
import "@ctrlc/react/styles/section-pack.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SectionPackProvider catalogHref="/dev/packs">
          {children}
        </SectionPackProvider>
      </body>
    </html>
  );
}
```

### 4. Boundaries

```tsx
import { SectionBoundary } from "@ctrlc/react";
import { Hero } from "@/components/sections/Hero";

export default function Page() {
  return (
    <main id="main-content">
      <SectionBoundary id="hero" label="Hero" component="Hero">
        <Hero />
      </SectionBoundary>
    </main>
  );
}
```

### 5. API route

```ts
// app/api/dev/section-pack/route.ts
import { createSectionPackGET } from "@ctrlc/next";
import { sectionPackConfig } from "@/lib/section-pack-config";

export const GET = createSectionPackGET(() => sectionPackConfig);
```

### 6. Validate

```bash
npm run ctrlc -- validate --cwd .
npm run ctrlc -- list --cwd .
```

## Capture pipeline (IR to research + registry)

After you have a Page IR (from `ctrlc capture` or a fixture), run the orchestrator:

```bash
# Preview steps only (no downloads, no Playwright)
ctrlc pipeline --ir packages/capture/fixtures/sample-ir.json --cwd . --dry-run

# Apply tokens, registry, specs, assets into a clone project
ctrlc pipeline --ir runs/example.com/ir.json --cwd ../my-clone

# Live capture then post-process (Playwright peer required)
ctrlc pipeline --url https://example.com --cwd ../my-clone --out runs/example.com
```

Environment check: `ctrlc doctor`.

See [Hybrid clone pipeline](../workflows/hybrid-clone-pipeline.md) and [Contributing](../../CONTRIBUTING.md).

## Next steps

- [Principles](./principles.md)
- [Architecture](../concepts/architecture.md)
- [CLI reference](../reference/cli.md)
- [Cloner workflow](../workflows/cloner-integration.md)
- [Hybrid clone pipeline](../workflows/hybrid-clone-pipeline.md)
