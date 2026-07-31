# Watch and pack drift

Track SectionPack fingerprints (`contentHash`) while developing and in CI.

## Snapshot baselines

```bash
npm run snapshot
# ctrlc snapshot --cwd examples/next-demo
```

Writes:

```text
examples/next-demo/.ctrlc/snapshots/<id>.json
```

Commit these files so CI is stable.

## Drift check

```bash
npm run check:drift
```

Exit `1` if any section's live `contentHash` differs from baseline.  
Refresh with `npm run snapshot` after intentional changes.

## Watch mode

```bash
npm run watch
# ctrlc watch --cwd examples/next-demo
# ctrlc watch --cwd examples/next-demo --snapshot
```

Polls source files from config; rebuilds affected packs and prints hash + summary.  
`--snapshot` also rewrites snapshot files. Ctrl+C exits cleanly.

## CI

`.github/workflows/ci.yml` runs build → test → validate → drift check.

## Related

- [CLI](../reference/cli.md)
- [Package: core](../packages/core.md) (`snapshotSectionPack`, `diffSectionPacks`)
