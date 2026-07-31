# Export formats

Base API (demo): `/api/dev/section-pack`  
CLI: `ctrlc pack <id> --format <format>`

## Single-section formats

Query: `?id=<sectionId>&format=<format>`

| Format | Shape | What you get |
|--------|-------|--------------|
| `describe` | markdown | Natural-language brief (primary NL export) |
| `prompt` | markdown | Full agent code pack + tree + related |
| `prompt-short` | markdown | Compact code pack |
| `component` | text | Component TSX only |
| `content` | text | Content key extract |
| `css` | css | Matching selectors + shared utils/keyframes when needed |
| `template` | text | Drop-in usage snippet |
| `cursor-rule` | text | Cursor / AGENTS-style fragment |
| `json` | json | Structured pack (hashes, tree, surfaces) |
| `zip` | zip | Downloadable folder |

Default when `format` is omitted: `json`.

### Dual export mapping

| Intent | Formats |
|--------|---------|
| Natural language | `describe` |
| Code as-is | `prompt`, `prompt-short`, surfaces, `json`, `zip` |

## Multi-section formats

Query: `?ids=hero,features,cta&format=<format>`

| Format | Notes |
|--------|-------|
| `describe` | Combined NL briefs |
| `prompt` / `prompt-short` | Combined code packs |
| `json` | Multi pack payload (`builtAt`, `buildMs`) |
| `zip` | Multi folder zip |

## Recipes

Query: `?recipe=landing-core&format=<format>`

Recipes expand to ordered section ids from config, then use multi-pack builders.

## Brand variables

Override placeholders in prompt/describe pipelines:

```text
var.productName=Acme
var.tagline=Hello
var.demoHref=/demo
var.email=hello@acme.example
var.primaryCta=Start
```

## Related

- [CLI](./cli.md)
- [HTTP API](./api.md)
- [Dual export](../concepts/dual-export.md)
