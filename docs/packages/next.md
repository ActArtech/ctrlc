# `@ctrlc/next`

Next.js App Router helpers.

## Exports

| Export | Role |
|--------|------|
| `createSectionPackGET` | Dev API route factory |
| `SectionPackCatalog` | Full catalog UI (search, multi, recipes, visual previews) |

## Route

```ts
// app/api/dev/section-pack/route.ts
import { createSectionPackGET } from "@ctrlc/next";
import { sectionPackConfig } from "@/lib/section-pack-config";

export const GET = createSectionPackGET(() => sectionPackConfig);
// export const GET = createSectionPackGET(() => sectionPackConfig, { cache: false });
```

## Catalog page

```tsx
// app/dev/packs/page.tsx
import { SectionPackCatalog } from "@ctrlc/next";

export default function PacksPage() {
  return <SectionPackCatalog apiBase="/api/dev/section-pack" />;
}
```

Deep links: `?selected=hero,cta` · `?recipe=landing-core`

### Visual previews (D12)

The catalog shows a thumbnail on each section card (or a monogram placeholder) and a preview drawer with description, tags, and **Natural language** / **Code as-is** actions. Esc closes the drawer.

`?list=1` may attach `previewUrl` when a file is found. Lookup order:

1. Entry fields `previewImage` or `thumbnail` (public-relative path, site path `/...`, or absolute URL)
2. `public/ctrlc-previews/<section-id>.{png,jpg,jpeg,webp,svg}`
3. `public/docs/research/baselines/<section-id>.{ext}` (if you mirror research baselines under `public/`)

Research files at `docs/research/baselines/<id>.png` are not web-served by Next alone. Copy or symlink into `public/ctrlc-previews/<id>.png` (or set `previewImage` on the entry).

```ts
// In section pack config
{
  id: "hero",
  label: "Hero",
  // ...
  previewImage: "ctrlc-previews/hero.png", // under public/
}
```

How to add a thumb for section `hero`:

```bash
# From the Next app root
mkdir -p public/ctrlc-previews
# Drop a PNG/JPG/WebP/SVG named after the section id
cp path/to/screenshot.png public/ctrlc-previews/hero.png
```

No PNGs are required in the repo; missing files fall back to a gradient monogram.

## Related

- [HTTP API](../reference/api.md)
- [Package: core](./core.md)
