# @ctrlc/next-demo (Northline)

Runnable Next.js marketing page that wires **CtrlC SectionPack**:

- React sections only (no HTML dumps)
- Hover inspector for natural language + code packs
- Dev API at `/api/dev/section-pack`
- Catalog at `/dev/packs`

**Brand:** Northline (fictional product analytics startup)

## Run

From the monorepo root:

```bash
npm install
npm run build
npm run dev:demo
```

Open:

| URL | What |
|-----|------|
| http://localhost:3040 | Homepage |
| http://localhost:3040/dev/packs | Pack catalog |
| http://localhost:3040/api/dev/section-pack?list=1 | Section list JSON |

## Catalog preview thumbs

Optional images under `public/ctrlc-previews/<section-id>.{png,svg,...}` show in `/dev/packs`. This demo ships monogram SVGs for each section id.

## Inspector

- Default **on** in development
- Toggle: **Ctrl/Cmd + Shift + P**, or the floating dock control
- URL force: `?packs=1` / `?packs=0`
- Hover a section chip → copy **Natural language** or **Code as-is**
- Multi-select checkboxes → tray actions for multi packs / zip

## Sections (canonical)

Wired in `src/app/page.tsx` and `src/lib/section-pack-config.ts`.

| id | Component | File |
|----|-----------|------|
| promo | PromoBar | `src/components/sections/PromoBar.tsx` |
| header | SiteHeader | `src/components/sections/SiteHeader.tsx` |
| hero | Hero | `src/components/sections/Hero.tsx` |
| features | Features | `src/components/sections/Features.tsx` |
| how-it-works | HowItWorks | `src/components/sections/HowItWorks.tsx` |
| cta | Cta | `src/components/sections/Cta.tsx` |
| footer | SiteFooter | `src/components/sections/SiteFooter.tsx` |

- Config: `src/lib/section-pack-config.ts` (paths must match disk)
- Copy: `src/content/home.ts`
- Styles: `src/styles/demo.css` (`.nl-*` design system)
- Barrel: `src/components/sections/index.ts`

## API examples

```bash
curl "http://localhost:3040/api/dev/section-pack?list=1"
curl "http://localhost:3040/api/dev/section-pack?id=hero&format=describe"
curl "http://localhost:3040/api/dev/section-pack?id=hero&format=prompt-short"
curl "http://localhost:3040/api/dev/section-pack?recipe=landing-core&format=prompt"
curl "http://localhost:3040/api/dev/section-pack?ids=hero,features,cta&format=zip" -o packs.zip
```

## Docker

Containers are Linux images (works from Windows via Docker Desktop). Build context is the **monorepo root** so npm workspaces can resolve `@ctrlc/*`.

From the monorepo root:

```bash
npm run docker:demo
# same as: docker compose up --build demo
```

Or:

```bash
docker build -f examples/next-demo/Dockerfile -t ctrlc-demo .
docker run --rm -p 3040:3040 -e SECTION_PACK_ENABLED=true ctrlc-demo
```

Then open http://localhost:3040 (catalog: `/dev/packs`).

Compose sets `SECTION_PACK_ENABLED=true` so the SectionPack API works in production mode. Docker is optional; it is not required for `npm test` or CI.

## Catalog preview thumbs (optional)

Drop section screenshots into:

```text
public/ctrlc-previews/<section-id>.png
```

Examples: `public/ctrlc-previews/hero.png`, `features.png`. Supported extensions: `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`.

Or set `previewImage` / `thumbnail` on the entry in `src/lib/section-pack-config.ts` (public-relative path). The catalog at `/dev/packs` shows thumbs or a monogram placeholder; click for the preview drawer.

## Notes

- Pack file reads use `process.cwd()` (the example root when you run `next dev` for this workspace package).
- Outside development the API returns 403 unless `SECTION_PACK_ENABLED=true` or `CTRLC_SECTION_PACK=1`.
