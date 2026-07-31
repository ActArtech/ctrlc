# HTTP API

Demo route: **`/api/dev/section-pack`**  
Factory: `createSectionPackGET(getConfig, options?)` from `@ctrlc/next`.

## Access control

By default the handler is **dev-only** unless:

- `SECTION_PACK_ENABLED=true`, or  
- `CTRLC_SECTION_PACK=1`, or  
- `options.devOnly === false`

## Endpoints (GET)

### List

```http
GET /api/dev/section-pack?list=1
```

Typical payload:

```json
{
  "sections": [{ "id": "hero", "label": "Hero", "tags": [], "componentPath": "..." }],
  "recipes": [{ "id": "landing-core", "sectionIds": ["header", "hero"] }],
  "formats": ["describe", "prompt", "..."]
}
```

### Single section

```http
GET /api/dev/section-pack?id=hero&format=describe
GET /api/dev/section-pack?id=hero&format=prompt
GET /api/dev/section-pack?id=hero&format=zip
```

### Multi section

```http
GET /api/dev/section-pack?ids=hero,features,cta&format=describe
GET /api/dev/section-pack?ids=hero,cta&format=zip
```

### Recipe

```http
GET /api/dev/section-pack?recipe=landing-core&format=prompt-short
```

### Variables

```http
GET /api/dev/section-pack?id=hero&format=describe&var.productName=Acme&var.tagline=Hello
```

## Formats

See [Export formats](./export-formats.md).

## Caching

Single-id packs may be cached by source mtimes. Disable:

```ts
export const GET = createSectionPackGET(() => config, { cache: false });
```

## Catalog page

`SectionPackCatalog` from `@ctrlc/next` consumes `?list=1` and deep links:

- `?selected=hero,features`
- `?recipe=landing-core`

List items may include optional `previewUrl` (and passthrough `previewImage` / `thumbnail` from config) when a conventional preview file exists under `public/ctrlc-previews/<id>.png` (or related extensions). See [Package: next](../packages/next.md#visual-previews-d12).
