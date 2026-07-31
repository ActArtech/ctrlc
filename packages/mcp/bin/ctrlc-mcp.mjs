#!/usr/bin/env node
/**
 * ctrlc-mcp - MCP stdio server for SectionPack tools
 *
 * Usage:
 *   node packages/mcp/bin/ctrlc-mcp.mjs
 *   npx ctrlc-mcp
 *
 * Cursor / Claude Desktop example:
 *   {
 *     "mcpServers": {
 *       "CtrlC": {
 *         "command": "node",
 *         "args": ["path/to/packages/mcp/bin/ctrlc-mcp.mjs"],
 *         "env": { "CTRLC_CWD": "path/to/your/project" }
 *       }
 *     }
 *   }
 *
 * Optional: if @modelcontextprotocol/sdk is installed, this entry still uses
 * the built-in JSON-RPC subset (no hard SDK dependency). The SDK is listed
 * as optionalDependencies for hosts that prefer to wrap tools themselves.
 */

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.join(__dirname, "../src/server.mjs");

// Prefer tsx for TypeScript host configs (same need as CLI)
async function main() {
  // Register tsx if available so section-pack-config.ts loads
  try {
    const api = await import("tsx/esm/api");
    if (typeof api.register === "function") api.register();
  } catch {
    // optional; .mjs configs still work
  }

  const { runStdioServer } = await import(pathToFileURL(serverEntry).href);
  await runStdioServer();
}

main().catch((err) => {
  console.error("[ctrlc-mcp] fatal:", err?.message ?? err);
  process.exit(1);
});
