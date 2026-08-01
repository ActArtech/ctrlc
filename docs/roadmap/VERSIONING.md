# Versioning (path to 1.0)

SemVer once **1.0.0** is cut. Pre-1.0 APIs may change. Package versions today: **0.1.x**.

## Line map

| Range | Focus |
|-------|--------|
| **0.1.x** | Current MVP. Local monorepo, Northline demo, CLI / skill / MCP, dual export. APIs may evolve. |
| **0.2 - 0.4** | Real-page runs + freeze prep + first npm publish. Rights-cleared examples, API freeze note, distribution checklist. |
| **0.5 - 0.8** | Agent reliability. Eval corpus, structure scores, fix-up metrics, parallel-builder discipline with human review. |
| **1.0** | Stable public API + external proof. Freeze honored, baseline eval scores documented, publish readiness gate green. |

## Rules of thumb

- Bump **minor** for intentional surface changes before freeze; **patch** for fixes that do not break callers.
- After freeze (see [API_FREEZE.md](./API_FREEZE.md) when present), breaking changes wait for a major or an explicit freeze amendment.
- Changelog: root [CHANGELOG.md](../../CHANGELOG.md).

## Related

- [PATH_TO_1.0.md](./PATH_TO_1.0.md) - hub checklist
- [DISTRIBUTION.md](./DISTRIBUTION.md) - leave pure MVP territory
- [Agent eval](../eval/README.md) - reliability measurement
