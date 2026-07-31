# `@ctrlc/mcp`

Lightweight **stdio MCP** server for SectionPack tools (packs first, not full clone).

## Tools

| Tool | Purpose |
|------|---------|
| `CTRLC_list` | Section ids + recipes for a project cwd |
| `CTRLC_pack` | describe / prompt / prompt-short / json for one section |
| `CTRLC_validate` | Config validation |
| `CTRLC_library_summary` | Short catalog summary |
| `CTRLC_doctor` | Environment health |

## Run

```bash
node packages/mcp/bin/ctrlc-mcp.mjs
# or
npm start -w @ctrlc/mcp

npm run test:mcp
```

## Client config (Cursor / Claude)

```json
{
  "mcpServers": {
    "CtrlC": {
      "command": "node",
      "args": ["path/to/CtrlC/packages/mcp/bin/ctrlc-mcp.mjs"],
      "env": { "CTRLC_CWD": "path/to/host-project" }
    }
  }
}
```

Full notes: [packages/mcp/README.md](../../packages/mcp/README.md).
