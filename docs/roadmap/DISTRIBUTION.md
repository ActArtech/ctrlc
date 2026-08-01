# Distribution checklist (leave pure MVP)

CtrlC is **0.1.x MVP** until this list is honestly checked. Do not treat monorepo-only demos as a public 1.0 launch.

Related: [VERSIONING.md](./VERSIONING.md), [PATH_TO_1.0.md](./PATH_TO_1.0.md), [API_FREEZE.md](./API_FREEZE.md).

## Checklist

### npm publish (ordered by deps)

Publish only after freeze + readiness gate below. Do **not** run publish as part of routine CI docs work.

Recommended order (workspace packages under `packages/`):

| Order | Package | Depends on |
|-------|---------|------------|
| 1 | `@ctrlc/core` | (none in scope) |
| 2a | `@ctrlc/react` | peer `react` / `react-dom` only |
| 2b | `@ctrlc/capture` | optional peer `playwright` |
| 3a | `@ctrlc/next` | `@ctrlc/core` |
| 3b | `@ctrlc/cli` | `@ctrlc/core`, `@ctrlc/capture` |
| 3c | `@ctrlc/mcp` | `@ctrlc/core` |

- [ ] `@ctrlc/core` published (`publishConfig.access=public`, `prepublishOnly` build green)
- [ ] `@ctrlc/react` published
- [ ] `@ctrlc/capture` published
- [ ] `@ctrlc/next` published
- [ ] `@ctrlc/cli` published (`ctrlc` bin)
- [ ] `@ctrlc/mcp` published (`ctrlc-mcp` bin)
- [ ] Install smoke from a clean folder: `npm i @ctrlc/cli` (and app deps) resolves without monorepo link

### API freeze

- [ ] Freeze note written and linked: [API_FREEZE.md](./API_FREEZE.md)
- [ ] Public surfaces listed (core types, pack formats, React exports, Next helpers, CLI commands, MCP tools)
- [ ] CHANGELOG entry for freeze version

### Public before / after examples

Rights-cleared only. **Never** commit third-party full clones under `examples/`.

- [ ] 2-3 public before/after case notes
  - Preferred: **outside** this monorepo, or
  - Under `docs/examples-gallery/` with **screenshots + anonymized metrics only**
- [ ] No third-party product rebuild trees in `examples/`
- [ ] Northline remains the only in-repo interactive demo brand

### Demo media

- [ ] Short demo GIF or video: inspector + dual export
- [ ] Stored under [docs/media/](../media/) (see [docs/media/README.md](../media/README.md))
- [ ] Northline only; no third-party brands

### Optional hosting / DX

- [ ] Codespace or [devcontainer](../../.devcontainer/devcontainer.json) (Node 20, port 3040)
- [ ] Hosted playground (optional later; not a 1.0 blocker)

## Publish readiness gate

All of the following before calling a release "ready to publish":

| Gate | Done when |
|------|-----------|
| **API freeze** | [API_FREEZE.md](./API_FREEZE.md) exists and matches shipped surfaces |
| **Eval corpus baseline** | Scores documented under [docs/eval/](../eval/) (see [AGENT_EVAL.md](../eval/AGENT_EVAL.md)) |
| **Acceptance suite** | Root `doctor` + monorepo `build` / `test` / `test:mcp` green |
| **Positioning** | README still leads with React section packs + recreation guidance; not full-site clone promises |

## Explicit non-goals for this checklist

- Shipping third-party site clones as product demos
- Treating HTML mirrors as the deliverable
- npm publish without freeze + baseline eval notes
