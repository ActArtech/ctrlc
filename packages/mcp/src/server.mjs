/**
 * Minimal MCP stdio server (JSON-RPC 2.0).
 *
 * Zero hard dependency on @modelcontextprotocol/sdk: implements the subset
 * agents need (initialize, tools/list, tools/call, ping).
 *
 * Framing: Content-Length headers (same as official SDK / LSP-style).
 * Also accepts newline-delimited JSON for simple test harnesses.
 */

import { TOOL_DEFINITIONS, callTool } from "./tools.mjs";

export const SERVER_NAME = "CtrlC";
export const SERVER_VERSION = "0.1.0";
/** Protocol version widely accepted by Cursor / Claude clients. */
export const PROTOCOL_VERSION = "2024-11-05";

/**
 * @typedef {{
 *   jsonrpc: "2.0",
 *   id?: string | number | null,
 *   method?: string,
 *   params?: any,
 *   result?: any,
 *   error?: { code: number, message: string, data?: any },
 * }} JsonRpcMessage
 */

/**
 * Build a successful JSON-RPC response.
 * @param {string | number | null | undefined} id
 * @param {any} result
 * @returns {JsonRpcMessage}
 */
export function rpcResult(id, result) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

/**
 * Build a JSON-RPC error response.
 * @param {string | number | null | undefined} id
 * @param {number} code
 * @param {string} message
 * @param {any} [data]
 * @returns {JsonRpcMessage}
 */
export function rpcError(id, code, message, data) {
  /** @type {JsonRpcMessage} */
  const msg = {
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message },
  };
  if (data !== undefined) msg.error.data = data;
  return msg;
}

/**
 * Format tool result as MCP content blocks.
 * @param {any} payload
 * @param {boolean} [isError]
 */
export function asToolResult(payload, isError = false) {
  const text =
    typeof payload === "string"
      ? payload
      : JSON.stringify(payload, null, 2);
  return {
    content: [{ type: "text", text }],
    isError: Boolean(isError || (payload && payload.ok === false)),
  };
}

/**
 * Handle one JSON-RPC request/notification.
 * @param {JsonRpcMessage} msg
 * @returns {Promise<JsonRpcMessage | null>} null for notifications
 */
export async function handleMessage(msg) {
  if (!msg || msg.jsonrpc !== "2.0") {
    return rpcError(msg?.id, -32600, "Invalid Request: expected jsonrpc 2.0");
  }

  const { method, id, params } = msg;

  // Notifications have no id
  const isNotification = id === undefined || id === null;

  if (!method) {
    return rpcError(id, -32600, "Invalid Request: missing method");
  }

  switch (method) {
    case "initialize": {
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {
          tools: { listChanged: false },
        },
        serverInfo: {
          name: SERVER_NAME,
          version: SERVER_VERSION,
        },
        instructions:
          "CtrlC MCP: list sections, build SectionPacks (describe/prompt/json), validate config. Prefer packs over full HTML clone dumps.",
      });
    }

    case "notifications/initialized":
    case "initialized":
      return null;

    case "ping":
      return isNotification ? null : rpcResult(id, {});

    case "tools/list": {
      return rpcResult(id, { tools: TOOL_DEFINITIONS });
    }

    case "tools/call": {
      const name = params?.name;
      const args = params?.arguments ?? params?.args ?? {};
      if (!name || typeof name !== "string") {
        return rpcError(id, -32602, "tools/call requires params.name");
      }
      try {
        const payload = await callTool(name, args);
        const isErr =
          payload &&
          typeof payload === "object" &&
          "ok" in payload &&
          payload.ok === false;
        return rpcResult(id, asToolResult(payload, isErr));
      } catch (e) {
        const err = /** @type {Error} */ (e);
        return rpcResult(
          id,
          asToolResult(
            { ok: false, error: String(err?.message ?? err) },
            true,
          ),
        );
      }
    }

    case "resources/list":
      return rpcResult(id, { resources: [] });

    case "prompts/list":
      return rpcResult(id, { prompts: [] });

    default: {
      if (isNotification) return null;
      return rpcError(id, -32601, `Method not found: ${method}`);
    }
  }
}

/**
 * Encode a message with Content-Length framing.
 * @param {JsonRpcMessage} msg
 * @returns {string}
 */
export function encodeMessage(msg) {
  const json = JSON.stringify(msg);
  const len = Buffer.byteLength(json, "utf8");
  return `Content-Length: ${len}\r\n\r\n${json}`;
}

/**
 * Parse a stream buffer into complete JSON-RPC messages.
 * Supports Content-Length framing and newline-delimited JSON.
 */
export class MessageParser {
  constructor() {
    /** @type {Buffer} */
    this.buf = Buffer.alloc(0);
  }

  /**
   * @param {Buffer | string} chunk
   * @returns {JsonRpcMessage[]}
   */
  push(chunk) {
    const piece = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8");
    this.buf = Buffer.concat([this.buf, piece]);
    /** @type {JsonRpcMessage[]} */
    const out = [];

    while (this.buf.length > 0) {
      // Prefer Content-Length headers
      const headerEnd = indexOfHeaderEnd(this.buf);
      if (headerEnd !== -1) {
        const headerText = this.buf.subarray(0, headerEnd).toString("utf8");
        const match = /Content-Length:\s*(\d+)/i.exec(headerText);
        if (!match) {
          // Malformed header block: drop through to line mode below
          break;
        }
        const bodyLen = Number(match[1]);
        const bodyStart = headerEnd + 4; // \r\n\r\n
        if (this.buf.length < bodyStart + bodyLen) {
          break; // wait for more data
        }
        const body = this.buf.subarray(bodyStart, bodyStart + bodyLen).toString("utf8");
        this.buf = this.buf.subarray(bodyStart + bodyLen);
        try {
          out.push(JSON.parse(body));
        } catch {
          // skip bad body
        }
        continue;
      }

      // Newline-delimited JSON fallback (no Content-Length yet)
      const nl = this.buf.indexOf(0x0a); // \n
      if (nl === -1) break;
      const line = this.buf.subarray(0, nl).toString("utf8").replace(/\r$/, "");
      this.buf = this.buf.subarray(nl + 1);
      const trimmed = line.trim();
      if (!trimmed || trimmed.toLowerCase().startsWith("content-length:")) {
        // Partial header without body terminator yet; re-buffer with rest
        if (trimmed.toLowerCase().startsWith("content-length:")) {
          this.buf = Buffer.concat([Buffer.from(line + "\n", "utf8"), this.buf]);
          break;
        }
        continue;
      }
      try {
        out.push(JSON.parse(trimmed));
      } catch {
        // ignore non-JSON lines
      }
    }

    return out;
  }
}

/**
 * @param {Buffer} buf
 * @returns {number} index of start of \r\n\r\n, or -1
 */
function indexOfHeaderEnd(buf) {
  for (let i = 0; i < buf.length - 3; i++) {
    if (
      buf[i] === 0x0d &&
      buf[i + 1] === 0x0a &&
      buf[i + 2] === 0x0d &&
      buf[i + 3] === 0x0a
    ) {
      return i;
    }
  }
  return -1;
}

/**
 * Write a JSON-RPC message to stdout (Content-Length framed).
 * @param {NodeJS.WriteStream} stream
 * @param {JsonRpcMessage} msg
 */
export function writeMessage(stream, msg) {
  stream.write(encodeMessage(msg));
}

/**
 * Run the MCP server on stdio until stdin closes.
 * @param {{
 *   stdin?: NodeJS.ReadStream,
 *   stdout?: NodeJS.WriteStream,
 *   stderr?: NodeJS.WriteStream,
 * }} [opts]
 */
export async function runStdioServer(opts = {}) {
  const stdin = opts.stdin ?? process.stdin;
  const stdout = opts.stdout ?? process.stdout;
  const stderr = opts.stderr ?? process.stderr;

  const parser = new MessageParser();

  // Avoid interfering with JSON-RPC on stdout
  const log = (/** @type {string} */ line) => {
    try {
      stderr.write(`[ctrlc-mcp] ${line}\n`);
    } catch {
      // ignore
    }
  };

  log(`starting ${SERVER_NAME} v${SERVER_VERSION} (stdio JSON-RPC MCP subset)`);

  /** Serialize handlers so pack builds do not interleave responses. */
  let chain = Promise.resolve();

  stdin.on("data", (chunk) => {
    const messages = parser.push(chunk);
    for (const msg of messages) {
      chain = chain
        .then(async () => {
          try {
            const response = await handleMessage(msg);
            if (response) writeMessage(stdout, response);
          } catch (e) {
            const err = /** @type {Error} */ (e);
            if (msg.id !== undefined && msg.id !== null) {
              writeMessage(
                stdout,
                rpcError(msg.id, -32603, String(err?.message ?? err)),
              );
            } else {
              log(`handler error: ${err?.message ?? err}`);
            }
          }
        })
        .catch((e) => {
          log(`chain error: ${/** @type {Error} */ (e)?.message ?? e}`);
        });
    }
  });

  await new Promise((resolve) => {
    stdin.on("end", () => {
      chain.finally(resolve);
    });
    stdin.on("close", () => {
      chain.finally(resolve);
    });
  });

  log("stdin closed; exiting");
}

export { TOOL_DEFINITIONS, callTool } from "./tools.mjs";
