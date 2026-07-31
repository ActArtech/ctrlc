/**
 * Materialize Page IR assets[] into a local directory with stable filenames.
 *
 * Downloads fonts/images/video/other from remote URLs (or small data: URLs),
 * sets asset.localPath, and optionally rewrites IR. Never throws on a single
 * asset failure - errors are collected in the result.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { PageIR, PageIRAsset, PageIRAssetKind } from "./ir";

export type MaterializeAssetsOptions = {
  /** Directory where files are written. */
  outDir: string;
  /** Mutate ir.assets[].localPath (default true). */
  rewriteIr?: boolean;
  /** Max parallel downloads (default 4). */
  concurrency?: number;
  /** Per-request timeout ms (default 30000). */
  timeoutMs?: number;
  /** Only compute stable localPath names; do not download or write files. */
  dryRun?: boolean;
  /** Optional fetch for tests (Node 20+ global fetch by default). */
  fetchImpl?: typeof fetch;
};

export type MaterializeWritten = {
  url: string;
  localPath: string;
  ok: boolean;
  error?: string;
};

export type MaterializeAssetsResult = {
  ir: PageIR;
  written: MaterializeWritten[];
  outDir: string;
};

/** Max data: URL payload to write (bytes). Larger ones are skipped. */
const MAX_DATA_URL_BYTES = 256 * 1024;

const KIND_PREFIX: Record<PageIRAssetKind, string> = {
  image: "img",
  font: "font",
  video: "video",
  other: "other",
};

const KNOWN_EXTS = new Set([
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".avif",
  ".ico",
  ".bmp",
  ".mp4",
  ".webm",
  ".ogg",
  ".mov",
  ".css",
  ".js",
  ".json",
]);

const MIME_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/x-icon": ".ico",
  "image/vnd.microsoft.icon": ".ico",
  "font/woff": ".woff",
  "font/woff2": ".woff2",
  "font/ttf": ".ttf",
  "font/otf": ".otf",
  "application/font-woff": ".woff",
  "application/font-woff2": ".woff2",
  "application/x-font-ttf": ".ttf",
  "application/x-font-otf": ".otf",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/ogg": ".ogg",
  "text/css": ".css",
  "application/javascript": ".js",
  "text/javascript": ".js",
  "application/json": ".json",
};

/**
 * Stable, filesystem-safe filename for an asset URL.
 * Pattern: `<kind>-<host>-<path-tail>-<sha256-8><ext>`
 */
export function stableAssetFilename(
  url: string,
  kind: PageIRAssetKind,
  index: number,
): string {
  const prefix = KIND_PREFIX[kind] ?? "other";
  const hash = shortHash(url);

  if (url.startsWith("data:")) {
    const mime = dataUrlMime(url);
    const ext = (mime && MIME_EXT[mime]) || defaultExtForKind(kind);
    return sanitizeFilename(`${prefix}-data-${index}-${hash}${ext}`);
  }

  let host = "asset";
  let pathTail = "";
  let ext = "";

  try {
    const u = new URL(url);
    host = sanitizeSegment(u.hostname.replace(/^www\./i, "")) || "asset";
    const parts = u.pathname
      .replace(/\/+$/, "")
      .split("/")
      .filter(Boolean)
      .map((p) => {
        try {
          return decodeURIComponent(p);
        } catch {
          return p;
        }
      });
    const last = parts[parts.length - 1] || "";
    const prev = parts.length > 1 ? parts[parts.length - 2] : "";
    const baseName = last.replace(/\.[a-z0-9]{1,8}$/i, "");
    pathTail = [prev, baseName]
      .filter(Boolean)
      .map(sanitizeSegment)
      .filter(Boolean)
      .join("-");
    ext = extFromPathname(u.pathname) || extFromContentHint(u) || "";
  } catch {
    pathTail = sanitizeSegment(url.slice(0, 48));
  }

  if (!ext) ext = defaultExtForKind(kind);

  const body = [prefix, host, pathTail].filter(Boolean).join("-");
  // Cap body length so final name stays reasonable on Windows
  const trimmed = body.length > 96 ? body.slice(0, 96) : body;
  return sanitizeFilename(`${trimmed}-${hash}${ext}`);
}

/**
 * Download (or dry-run name) assets from Page IR into outDir.
 * Does not throw for individual asset failures.
 */
export async function materializeAssets(
  ir: PageIR,
  options: MaterializeAssetsOptions,
): Promise<MaterializeAssetsResult> {
  if (!options?.outDir || typeof options.outDir !== "string") {
    throw new Error("materializeAssets requires options.outDir");
  }

  const outDir = path.resolve(options.outDir);
  const rewriteIr = options.rewriteIr !== false;
  const concurrency = Math.max(1, options.concurrency ?? 4);
  const timeoutMs = options.timeoutMs ?? 30_000;
  const dryRun = options.dryRun === true;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  if (!dryRun) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Shallow clone IR + assets so callers can keep original unless rewrite desired
  const nextIr: PageIR = {
    ...ir,
    assets: (ir.assets ?? []).map((a) => ({ ...a })),
  };

  const assets = nextIr.assets;
  const written: MaterializeWritten[] = [];

  // Precompute filenames (stable even on failure)
  const planned: Array<{
    asset: PageIRAsset;
    index: number;
    filename: string;
    localPath: string;
  }> = assets.map((asset, index) => {
    const filename = stableAssetFilename(asset.url, asset.kind, index);
    const localPath = filename.replace(/\\/g, "/");
    return { asset, index, filename, localPath };
  });

  async function processOne(item: (typeof planned)[number]): Promise<void> {
    const { asset, filename, localPath } = item;
    const dest = path.join(outDir, filename);

    if (dryRun) {
      if (rewriteIr) asset.localPath = localPath;
      written.push({ url: asset.url, localPath, ok: true });
      return;
    }

    try {
      if (asset.url.startsWith("data:")) {
        const decoded = decodeDataUrl(asset.url);
        if (!decoded) {
          written.push({
            url: asset.url,
            localPath,
            ok: false,
            error: "unsupported or empty data: URL",
          });
          if (rewriteIr) asset.localPath = localPath;
          return;
        }
        if (decoded.bytes.byteLength > MAX_DATA_URL_BYTES) {
          written.push({
            url: asset.url.slice(0, 64) + "...",
            localPath,
            ok: false,
            error: `data: URL exceeds ${MAX_DATA_URL_BYTES} bytes; skipped`,
          });
          // Still assign path for deterministic IR even if not written
          if (rewriteIr) asset.localPath = localPath;
          return;
        }
        fs.writeFileSync(dest, decoded.bytes);
        if (rewriteIr) asset.localPath = localPath;
        written.push({ url: asset.url.slice(0, 64) + (asset.url.length > 64 ? "..." : ""), localPath, ok: true });
        return;
      }

      if (asset.url.startsWith("file:")) {
        const filePath = fileUrlToPath(asset.url);
        if (!fs.existsSync(filePath)) {
          throw new Error(`file not found: ${filePath}`);
        }
        fs.copyFileSync(filePath, dest);
        if (rewriteIr) asset.localPath = localPath;
        written.push({ url: asset.url, localPath, ok: true });
        return;
      }

      if (typeof fetchImpl !== "function") {
        throw new Error("fetch is not available; pass fetchImpl or use Node 20+");
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetchImpl(asset.url, {
          signal: controller.signal,
          redirect: "follow",
          headers: {
            // Some CDNs prefer a UA
            "user-agent": "ctrlc-capture/0.1 (asset materialize)",
            accept: "*/*",
          },
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText || ""}`.trim());
        }
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(dest, buf);
        if (rewriteIr) asset.localPath = localPath;
        written.push({ url: asset.url, localPath, ok: true });
      } finally {
        clearTimeout(timer);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (rewriteIr) asset.localPath = localPath;
      written.push({ url: asset.url, localPath, ok: false, error: msg });
    }
  }

  await mapPool(planned, concurrency, processOne);

  // Preserve input order in written results
  written.sort((a, b) => {
    const ia = planned.findIndex((p) => p.localPath === a.localPath && p.asset.url === a.url);
    const ib = planned.findIndex((p) => p.localPath === b.localPath && p.asset.url === b.url);
    return ia - ib;
  });

  return { ir: nextIr, written, outDir };
}

/**
 * Load IR from disk, materialize assets, write updated IR.
 *
 * Default out IR path: `<irDir>/ir.materialized.json` (or sibling of irPath).
 * Pass outIrPath to choose destination; use same path as irPath to overwrite
 * (a `.bak` backup is written first when overwriting).
 */
export async function materializeAssetsFromFile(
  irPath: string,
  options: MaterializeAssetsOptions & { outIrPath?: string },
): Promise<MaterializeAssetsResult> {
  const absIr = path.resolve(irPath);
  if (!fs.existsSync(absIr)) {
    throw new Error(`Page IR not found: ${absIr}`);
  }

  const raw = fs.readFileSync(absIr, "utf8");
  let ir: PageIR;
  try {
    ir = JSON.parse(raw) as PageIR;
  } catch (e) {
    throw new Error(`Invalid Page IR JSON: ${absIr}: ${e instanceof Error ? e.message : e}`);
  }

  if (!ir || typeof ir !== "object" || !Array.isArray(ir.assets)) {
    // Tolerate missing assets array
    if (!ir || typeof ir !== "object") {
      throw new Error(`Invalid Page IR (not an object): ${absIr}`);
    }
    ir = { ...ir, assets: ir.assets ?? [] };
  }

  const result = await materializeAssets(ir, options);

  const outIrPath =
    options.outIrPath != null
      ? path.resolve(options.outIrPath)
      : defaultMaterializedIrPath(absIr);

  if (!options.dryRun) {
    writeIrFile(outIrPath, result.ir, absIr);
  }

  return result;
}

function defaultMaterializedIrPath(irPath: string): string {
  const dir = path.dirname(irPath);
  const base = path.basename(irPath, path.extname(irPath));
  return path.join(dir, `${base}.materialized.json`);
}

function writeIrFile(outIrPath: string, ir: PageIR, originalIrPath: string): void {
  const abs = path.resolve(outIrPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });

  if (path.resolve(originalIrPath) === abs && fs.existsSync(abs)) {
    const bak = abs + ".bak";
    fs.copyFileSync(abs, bak);
  }

  fs.writeFileSync(abs, JSON.stringify(ir, null, 2) + "\n", "utf8");
}

function shortHash(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex").slice(0, 8);
}

function sanitizeSegment(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function sanitizeFilename(name: string): string {
  // Strip path separators and control chars; keep one extension
  let n = name.replace(/[/\\?%*:|"<>]/g, "-").replace(/-+/g, "-");
  if (n.length > 180) {
    const extMatch = n.match(/(\.[a-z0-9]{1,8})$/i);
    const ext = extMatch ? extMatch[1] : "";
    n = n.slice(0, 180 - ext.length) + ext;
  }
  return n || "asset.bin";
}

function extFromPathname(pathname: string): string {
  const base = pathname.split("/").pop() || "";
  const m = base.match(/(\.[a-z0-9]{1,8})$/i);
  if (!m) return "";
  const ext = m[1].toLowerCase();
  if (ext === ".jpeg") return ".jpg";
  return KNOWN_EXTS.has(ext) ? ext : "";
}

function extFromContentHint(u: URL): string {
  // format=woff2 style query
  const format = u.searchParams.get("format") || u.searchParams.get("f");
  if (format) {
    const f = format.toLowerCase().replace(/[^a-z0-9]/g, "");
    const asExt = `.${f}`;
    if (KNOWN_EXTS.has(asExt)) return asExt;
  }
  return "";
}

function defaultExtForKind(kind: PageIRAssetKind): string {
  switch (kind) {
    case "image":
      return ".bin";
    case "font":
      return ".woff2";
    case "video":
      return ".mp4";
    default:
      return ".bin";
  }
}

function dataUrlMime(url: string): string | null {
  const m = /^data:([^;,]+)/i.exec(url);
  return m ? m[1].trim().toLowerCase() : null;
}

function decodeDataUrl(
  url: string,
): { bytes: Buffer; mime: string | null } | null {
  const m = /^data:([^;,]+)?((?:;[^,]*)*),([\s\S]*)$/i.exec(url);
  if (!m) return null;
  const mime = (m[1] || "").trim().toLowerCase() || null;
  const meta = m[2] || "";
  const data = m[3] || "";
  const isBase64 = /;base64/i.test(meta);
  try {
    if (isBase64) {
      return { bytes: Buffer.from(data, "base64"), mime };
    }
    return { bytes: Buffer.from(decodeURIComponent(data), "utf8"), mime };
  } catch {
    return null;
  }
}

function fileUrlToPath(fileUrl: string): string {
  const u = new URL(fileUrl);
  let p = decodeURIComponent(u.pathname);
  // Windows: /C:/path -> C:/path
  if (/^\/[a-zA-Z]:\//.test(p)) {
    p = p.slice(1);
  }
  return path.normalize(p);
}

/**
 * Run async work over items with a fixed concurrency pool.
 */
async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) break;
      await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
}
