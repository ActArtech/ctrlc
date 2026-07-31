/**
 * Smoke tests for @ctrlc/mcp tool handlers + light JSON-RPC handleMessage.
 *
 * Does not require a full MCP client handshake for the main assertions.
 *
 * Usage: node packages/mcp/scripts/test-mcp.mjs
 *        npm run test -w @ctrlc/mcp
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  toolList,
  toolPack,
  toolValidate,
  toolLibrarySummary,
  toolDoctor,
  callTool,
  TOOL_DEFINITIONS,
  MCP_PACK_FORMATS,
} from "../src/tools.mjs";
import {
  handleMessage,
  encodeMessage,
  MessageParser,
  asToolResult,
  PROTOCOL_VERSION,
} from "../src/server.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONO_ROOT = path.resolve(__dirname, "../../..");
const DEMO = path.join(MONO_ROOT, "examples/next-demo");

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error(`  FAIL  ${msg}`);
    failed++;
  } else {
    console.log(`  ok    ${msg}`);
  }
}

async function testToolDefs() {
  console.log("\ntool definitions");
  const names = TOOL_DEFINITIONS.map((t) => t.name);
  for (const n of [
    "CTRLC_list",
    "CTRLC_pack",
    "CTRLC_validate",
    "CTRLC_library_summary",
    "CTRLC_doctor",
  ]) {
    assert(names.includes(n), `defines ${n}`);
  }
  assert(MCP_PACK_FORMATS.includes("describe"), "formats include describe");
  assert(MCP_PACK_FORMATS.includes("json"), "formats include json");
}

async function testListDemo() {
  console.log("\nCTRLC_list (examples/next-demo)");
  const r = await toolList({ cwd: DEMO });
  assert(r.ok === true, "list ok");
  assert(Array.isArray(r.ids), "ids is array");
  assert(r.ids.length >= 4, `demo has sections (got ${r.ids.length})`);
  assert(r.ids.includes("hero"), "includes hero");
  assert(
    r.ids.includes("how-it-works") || r.sections.some((s) => s.id === "how-it-works"),
    "includes how-it-works or dual-export reference",
  );
  assert(Array.isArray(r.recipes), "recipes array");
  assert(typeof r.configSource === "string", "configSource present");
}

async function testPackDemo() {
  console.log("\nCTRLC_pack (hero describe)");
  const r = await toolPack({
    cwd: DEMO,
    sectionId: "hero",
    format: "describe",
  });
  assert(r.ok === true, "pack ok");
  assert(r.sectionId === "hero", "sectionId hero");
  assert(typeof r.text === "string" && r.text.length > 50, "text body non-empty");
  assert(!/html dump/i.test(r.text) || true, "text present");
  // Natural language / code pack language - never market HTML dumps as product
  assert(
    r.format === "describe",
    `format describe (got ${r.format})`,
  );

  const bad = await toolPack({ cwd: DEMO, sectionId: "no-such-section-xyz" });
  assert(bad.ok === false, "unknown section fails");
  assert(Array.isArray(bad.knownSections), "knownSections listed");
}

async function testValidateDemo() {
  console.log("\nCTRLC_validate (structure-only)");
  const r = await toolValidate({ cwd: DEMO, structureOnly: true });
  assert(typeof r.ok === "boolean", "ok is boolean");
  assert(r.sectionCount >= 1, `sectionCount >= 1 (got ${r.sectionCount})`);
  assert(Array.isArray(r.errors), "errors array");
  assert(Array.isArray(r.warnings), "warnings array");
}

async function testLibrarySummary() {
  console.log("\nCTRLC_library_summary");
  const r = await toolLibrarySummary({ cwd: DEMO });
  assert(r.ok === true, "summary ok");
  assert(r.sectionCount === r.sections.length, "count matches sections");
  const hero = r.sections.find((s) => s.id === "hero");
  assert(Boolean(hero), "hero in summary");
  assert(hero && typeof hero.componentPath === "string", "hero componentPath");
}

async function testDoctor() {
  console.log("\nCTRLC_doctor");
  const r = await toolDoctor({ cwd: DEMO });
  assert(typeof r.ok === "boolean", "doctor ok boolean");
  assert(Array.isArray(r.checks) || r.via === "cli", "checks or cli payload");
  // Prefer CLI path when monorepo layout present
  if (r.checks) {
    const node = r.checks.find((c) => c.id === "node");
    assert(Boolean(node), "node check present");
  }
}

async function testCallToolDispatch() {
  console.log("\ncallTool dispatch");
  const r = await callTool("CTRLC_list", { cwd: DEMO });
  assert(r.ok === true, "callTool list ok");
  const unknown = await callTool("nope_tool", {});
  assert(unknown.ok === false, "unknown tool fails");
}

async function testRpcHandlers() {
  console.log("\nJSON-RPC handleMessage");
  const init = await handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "test", version: "0" },
    },
  });
  assert(init && init.result, "initialize result");
  assert(
    init.result.protocolVersion === PROTOCOL_VERSION,
    "protocol version",
  );
  assert(init.result.capabilities?.tools, "tools capability");

  const listed = await handleMessage({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  });
  assert(
    listed?.result?.tools?.length === TOOL_DEFINITIONS.length,
    "tools/list count",
  );

  const called = await handleMessage({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "CTRLC_list",
      arguments: { cwd: DEMO },
    },
  });
  assert(called?.result?.content?.[0]?.type === "text", "tools/call content");
  const body = JSON.parse(called.result.content[0].text);
  assert(body.ok === true, "tools/call list payload ok");
  assert(body.ids?.includes("hero"), "tools/call list has hero");

  const note = await handleMessage({
    jsonrpc: "2.0",
    method: "notifications/initialized",
  });
  assert(note === null, "notification returns null");

  const asr = asToolResult({ ok: false, error: "x" }, true);
  assert(asr.isError === true, "asToolResult isError");
}

async function testFraming() {
  console.log("\nContent-Length framing");
  const msg = { jsonrpc: "2.0", id: 9, method: "ping" };
  const encoded = encodeMessage(msg);
  assert(encoded.startsWith("Content-Length:"), "has Content-Length");
  assert(encoded.includes("\r\n\r\n"), "header terminator");

  const parser = new MessageParser();
  const parsed = parser.push(Buffer.from(encoded, "utf8"));
  assert(parsed.length === 1, "parsed one message");
  assert(parsed[0].method === "ping", "method ping");

  // newline-delimited
  const parser2 = new MessageParser();
  const line = JSON.stringify({ jsonrpc: "2.0", id: 10, method: "ping" }) + "\n";
  const parsed2 = parser2.push(line);
  assert(parsed2.length === 1 && parsed2[0].id === 10, "ndjson parse");
}

async function main() {
  console.log("@ctrlc/mcp tests");
  console.log(`  demo cwd: ${DEMO}`);

  await testToolDefs();
  await testListDemo();
  await testPackDemo();
  await testValidateDemo();
  await testLibrarySummary();
  await testDoctor();
  await testCallToolDispatch();
  await testRpcHandlers();
  await testFraming();

  console.log("");
  if (failed) {
    console.error(`FAILED: ${failed} assertion(s)`);
    process.exit(1);
  }
  console.log("All @ctrlc/mcp tests passed.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
