# @ctrlc/mcp

Lightweight **MCP** (Model Context Protocol) server for **CtrlC SectionPack** tools.

Agents get **packs first** (list sections, describe/prompt packs, validate config) without running a full clone pipeline or dumping HTML.

- **Zero hard dependency** on `@modelcontextprotocol/sdk` (optional only)
- Minimal **stdio JSON-RPC 2.0** subset: `initialize`, `tools/list`, `tools/call`, `ping`
- Framing: **Content-Length** headers (same style as the official SDK)

## Requirements

- Node.js **>= 20**
- Built monorepo: `npm install && npm run build` (needs `@ctrlc/core`)
- For TypeScript host configs (`section-pack-config.ts`): `tsx` available (monorepo root has it)

## Tools

| Tool | Purpose |
|------|---------|
| `CTRLC_list` | Section ids + recipes for `--cwd` |
| `CTRLC_pack` | Pack one section: `describe` \| `prompt` \| `prompt-short` \| `json` |
| `CTRLC_validate` | Validate config structure (paths optional) |
| `CTRLC_library_summary` | Short section catalog (no full library write) |
| `CTRLC_doctor` | Environment checks via CLI doctor (or inline fallback) |

Common args:

- `cwd` - project root (default: `CTRLC_CWD` env or `process.cwd()`)
- `configPath` - optional config module path

## Run

```bash
# from monorepo root
node packages/mcp/bin/ctrlc-mcp.mjs

# or workspace
npm start -w @ctrlc/mcp
```

## Cursor / Claude config

Point the host at the bin entry (absolute path recommended):

```json
{
  "mcpServers": {
    "CtrlC": {
      "command": "node",
      "args": ["D:/path/to/CtrlC/packages/mcp/bin/ctrlc-mcp.mjs"],
      "env": {
        "CTRLC_CWD": "D:/path/to/your/host-project"
      }
    }
  }
}
```

Claude Desktop uses the same shape under its MCP settings. Restart the host after editing.

### Optional SDK

`@modelcontextprotocol/sdk` is an **optional peer** only. This package does **not** require it; the built-in JSON-RPC server is enough for Cursor/Claude stdio. Install the SDK only if you wrap tool handlers yourself:

```bash
npm i @modelcontextprotocol/sdk -w @ctrlc/mcp
```

Handlers are importable without stdio:

```js
import { toolList, toolPack, callTool } from "@ctrlc/mcp/tools";

const list = await toolList({ cwd: "examples/next-demo" });
const pack = await toolPack({
  cwd: "examples/next-demo",
  sectionId: "hero",
  format: "describe",
});
```

## Tests

Does **not** block monorepo root `npm test` unless you opt in.

```bash
npm run test -w @ctrlc/mcp
# or
node packages/mcp/scripts/test-mcp.mjs
```

## Design notes

- Prefer **SectionPack** natural language + multi-file React code (never HTML dumps).
- `CTRLC_pack` omits zip/binary formats on purpose (stdio text tools).
- `CTRLC_validate` defaults to `structureOnly: true` so agents do not fail on path checks outside a full host tree.

## Related

- CLI: `@ctrlc/cli` (`ctrlc list`, `pack`, `validate`, `library`, `doctor`)
- Core: `@ctrlc/core`
- Backlog: docs/backlog/CLONE_PIPELINE_BACKLOG.md (G3)
