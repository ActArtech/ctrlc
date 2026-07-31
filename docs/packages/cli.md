# `@ctrlc/cli`

Binary: **`CtrlC`**

```bash
npm run ctrlc -- <command>
# or: node packages/cli/bin/ctrlc.mjs <command>
```

## Command map

| Command | Purpose |
|---------|---------|
| `list` | Sections + recipes |
| `validate` | Config structure / paths |
| `pack` | Single section export |
| `pack-multi` | Multi section export |
| `scan` | Draft config from `sections/*.tsx` |
| `schema` | Print JSON Schema |
| `graph` | Dependency mermaid/json/md |
| `snapshot` | Write contentHash baselines |
| `watch` | Rebuild packs on file change |
| `library` | Offline NL + code library tree |

Full details: [CLI reference](../reference/cli.md).

## Root npm aliases

| Script | Command |
|--------|---------|
| `npm run snapshot` | snapshot next-demo |
| `npm run watch` | watch next-demo |
| `npm run library` | library for next-demo |
| `npm run check:drift` | fingerprint CI check |
