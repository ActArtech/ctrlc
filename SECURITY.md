# Security

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes (best effort) |

## Reporting a vulnerability

Please **do not** open a public issue for security-sensitive reports.

Email or private channel preferred (repository owner). Include:

- Affected package / command
- Reproduction steps
- Impact (data exposure, RCE, supply chain, etc.)
- Any suggested fix

You should get an acknowledgement when the maintainer is available.

## Scope notes

- CtrlC can fetch public URLs for **capture** and **asset materialization**. Only use it on sites you have rights to inspect and rebuild.
- Product goal is **section extraction + React recreation guidance**, not guaranteed full-site mirroring or private data exfiltration.
- Do not point capture at authenticated product backends or paywalled content.
- Optional peers (Playwright, pngjs, pixelmatch) are third-party; keep them updated when installed.
- Generated apps are user code: treat secrets, env files, and deploy credentials carefully.
- See [docs/guide/responsible-use.md](docs/guide/responsible-use.md).

## Supply chain

- Prefer `npm ci` / lockfile in CI when publishing becomes active
- `prepublishOnly` runs package builds on publishable workspaces
- Review `publishConfig` before any first npm release
