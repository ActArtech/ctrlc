# Library export

Export every section as offline agent context: natural language + code-as-is.

## Generate

```bash
npm run library
# ctrlc library --cwd examples/next-demo
```

Custom host:

```bash
ctrlc library --cwd path/to/app --out .ctrlc/library
```

Default out: `<cwd>/.ctrlc/library` (gitignored). Regenerate after source/config changes.

## Layout

```text
.ctrlc/library/
  index.json
  index.md
  sections/<id>/
    NATURAL_LANGUAGE.md    # describe
    CODE_PACK.md           # prompt
    meta.json              # contentHash, byteSizes, tags
```

## Using as agent context

| File | When |
|------|------|
| `index.md` | Choose which sections to load |
| `NATURAL_LANGUAGE.md` | Redesign / behavior-first prompts |
| `CODE_PACK.md` | Implement / port exact structure |
| `meta.json` | Drift checks via `contentHash` |

## Related

- [Dual export](../concepts/dual-export.md)
- [CLI](../reference/cli.md)
