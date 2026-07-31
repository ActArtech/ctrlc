/**
 * Materialize Page IR assets[] into a local directory with stable filenames.
 *
 * - Rewrites Next.js `/_next/image?url=` to the real source when possible
 * - Prefers real extensions (path, Content-Type, magic bytes) over `.bin`
 * - Optionally copies logo/hero/favicon/og into project `public/` with friendly names
 *
 * Never throws on a single asset failure - errors are collected in the result.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { PageIR, PageIRAsset, PageIRAssetKind } from "./ir";
import {
  resolveAssetFetchUrl,
  detectAssetRole,
  friendlyPublicRelPath,
  extFromContentType,
  extFromMagicBytes,
  normalizeExt,
  extFromPathname,
  type AssetRole,
} from "./asset-urls";

export type MaterializeAssetsOptions = {
  /** Directory where hashed capture assets are written. */
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
  /**
   * Project public/ directory (or parent project cwd's public).
   * When set, logo/hero/favicon/og copies go here with friendly names.
   */
  publicDir?: string;
  /** Copy logo/hero/favicon/og into publicDir (default true when publicDir set). */
  friendlyPublic?: boolean;
  /** Base URL for resolving relative asset URLs (usually IR sourceUrl). */
  pageBase?: string;
};

export type MaterializeWritten = {
  url: string;
  localPath: string;
  ok: boolean;
  error?: string;
  /** Resolved fetch URL when Next image was unwrapped */
  fetchUrl?: string;
  rewritten?: boolean;
  /** Friendly public path if copied (e.g. logos/logo.png) */
  publicPath?: string;
  role?: AssetRole;
};

export type MaterializeAssetsResult = {
  ir: PageIR;
  written: MaterializeWritten[];
  outDir: string;
  publicCopies: Array<{ role: AssetRole; from: string; to: string }>;
};

/** Max data: URL payload to write (bytes). Larger ones are skipped. */
const MAX_DATA_URL_BYTES = 256 * 1024;

const KIND_PREFIX: Record<PageIRAssetKind, string> = {
  image: "img",
  font: "font",
  video: "video",
  other: "other",
};

/**
 * Stable, filesystem-safe filename for an asset URL.
 * Pattern: `<kind>-<host>-<path-tail>-<sha256-8><ext>`
 */
export function stableAssetFilename(
  url: string,
  kind: PageIRAssetKind,
  index: number,
  opts?: { pageBase?: string; preferredExt?: string },
): string {
  const prefix = KIND_PREFIX[kind] ?? "other";
  const resolved = resolveAssetFetchUrl(url, opts?.pageBase);
  const hash = shortHash(resolved.fetchUrl || url);

  if (url.startsWith("data:")) {
    const mime = dataUrlMime(url);
    const ext =
      opts?.preferredExt ||
      (mime &&
        {
          "image/png": ".png",
          "image/jpeg": ".jpg",
          "image/svg+xml": ".svg",
          "image/webp": ".webp",
          "image/gif": ".gif",
        }[mime]) ||
      defaultExtForKind(kind);
    return sanitizeFilename(`${prefix}-data-${index}-${hash}${normalizeExt(ext) || ext}`);
  }

  let host = "asset";
  let pathTail = resolved.hintName || "";
  let ext =
    opts?.preferredExt ||
    resolved.hintExt ||
    "";

  try {
    const u = new URL(resolved.fetchUrl);
    host = sanitizeSegment(u.hostname.replace(/^www\./i, "")) || "asset";
    if (!pathTail) {
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
    }
    if (!ext) {
      ext = extFromPathname(u.pathname) || "";
      const format = u.searchParams.get("format") || u.searchParams.get("f");
      if (!ext && format) {
        const f = normalizeExt(`.${format}`);
        if (f) ext = f;
      }
    }
  } catch {
    pathTail = pathTail || sanitizeSegment(url.slice(0, 48));
  }

  // Prefer real image/font extensions; only fall back to .bin when unknown
  if (!ext) ext = defaultExtForKind(kind);
  // Avoid useless .bin when we have a name hint that includes an ext-like suffix
  if (ext === ".bin" && resolved.hintExt) ext = resolved.hintExt;

  const body = [prefix, host, pathTail].filter(Boolean).join("-");
  const trimmed = body.length > 96 ? body.slice(0, 96) : body;
  return sanitizeFilename(`${trimmed}-${hash}${normalizeExt(ext) || ext}`);
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
  const pageBase = options.pageBase || ir.sourceUrl;
  const publicDir = options.publicDir
    ? path.resolve(options.publicDir)
    : undefined;
  const friendlyPublic =
    options.friendlyPublic !== false && Boolean(publicDir);

  if (!dryRun) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const nextIr: PageIR = {
    ...ir,
    assets: (ir.assets ?? []).map((a) => ({ ...a })),
  };

  const assets = nextIr.assets;
  const written: MaterializeWritten[] = [];
  const publicCopies: MaterializeAssetsResult["publicCopies"] = [];
  const roleCounters: Partial<Record<AssetRole, number>> = {};

  type Planned = {
    asset: PageIRAsset;
    index: number;
    resolved: ReturnType<typeof resolveAssetFetchUrl>;
    role: AssetRole;
    filename: string;
    localPath: string;
  };

  const planned: Planned[] = assets.map((asset, index) => {
    const resolved = resolveAssetFetchUrl(asset.url, pageBase);
    const role = detectAssetRole(resolved.fetchUrl || asset.url, asset.kind, {
      name: resolved.hintName,
    });
    const filename = stableAssetFilename(asset.url, asset.kind, index, {
      pageBase,
      preferredExt: resolved.hintExt || undefined,
    });
    return {
      asset,
      index,
      resolved,
      role,
      filename,
      localPath: filename.replace(/\\/g, "/"),
    };
  });

  async function processOne(item: Planned): Promise<void> {
    let { asset, filename, localPath, resolved, role } = item;
    let dest = path.join(outDir, filename);

    if (dryRun) {
      if (rewriteIr) {
        asset.localPath = localPath;
        // Store resolved URL in notes-style field? keep original url; add resolved as optional
        if (resolved.rewritten) {
          (asset as PageIRAsset & { resolvedUrl?: string }).resolvedUrl =
            resolved.fetchUrl;
        }
      }
      written.push({
        url: asset.url,
        localPath,
        ok: true,
        fetchUrl: resolved.rewritten ? resolved.fetchUrl : undefined,
        rewritten: resolved.rewritten || undefined,
        role,
      });
      return;
    }

    try {
      let buf: Buffer | null = null;

      if (asset.url.startsWith("data:")) {
        const decoded = decodeDataUrl(asset.url);
        if (!decoded) {
          written.push({
            url: asset.url,
            localPath,
            ok: false,
            error: "unsupported or empty data: URL",
            role,
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
            role,
          });
          if (rewriteIr) asset.localPath = localPath;
          return;
        }
        buf = decoded.bytes;
      } else if (asset.url.startsWith("file:") || resolved.fetchUrl.startsWith("file:")) {
        const filePath = fileUrlToPath(
          resolved.fetchUrl.startsWith("file:")
            ? resolved.fetchUrl
            : asset.url,
        );
        if (!fs.existsSync(filePath)) {
          throw new Error(`file not found: ${filePath}`);
        }
        buf = fs.readFileSync(filePath);
      } else {
        if (typeof fetchImpl !== "function") {
          throw new Error(
            "fetch is not available; pass fetchImpl or use Node 20+",
          );
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetchImpl(resolved.fetchUrl, {
            signal: controller.signal,
            redirect: "follow",
            headers: {
              "user-agent": "ctrlc-capture/0.1 (asset materialize)",
              accept: "*/*",
            },
          });
          if (!res.ok) {
            throw new Error(
              `HTTP ${res.status} ${res.statusText || ""}`.trim(),
            );
          }
          buf = Buffer.from(await res.arrayBuffer());

          // Fix extension from Content-Type / magic when we only had .bin
          const ctExt = extFromContentType(res.headers.get("content-type"));
          const magicExt = extFromMagicBytes(buf);
          const bestExt = magicExt || ctExt || resolved.hintExt;
          if (bestExt && (localPath.endsWith(".bin") || !hasRealExt(localPath))) {
            const renamed = replaceExt(filename, bestExt);
            filename = renamed;
            localPath = renamed.replace(/\\/g, "/");
            dest = path.join(outDir, filename);
          } else if (bestExt && path.extname(filename).toLowerCase() === ".bin") {
            const renamed = replaceExt(filename, bestExt);
            filename = renamed;
            localPath = renamed.replace(/\\/g, "/");
            dest = path.join(outDir, filename);
          }
        } finally {
          clearTimeout(timer);
        }
      }

      if (!buf) throw new Error("empty body");

      // Final magic-byte fix for data/file paths too
      if (localPath.endsWith(".bin") || !hasRealExt(localPath)) {
        const magicExt = extFromMagicBytes(buf);
        if (magicExt) {
          filename = replaceExt(filename, magicExt);
          localPath = filename.replace(/\\/g, "/");
          dest = path.join(outDir, filename);
        }
      }

      fs.writeFileSync(dest, buf);
      if (rewriteIr) {
        asset.localPath = localPath;
        if (resolved.rewritten) {
          (asset as PageIRAsset & { resolvedUrl?: string }).resolvedUrl =
            resolved.fetchUrl;
        }
      }

      let publicPath: string | undefined;
      if (friendlyPublic && publicDir) {
        const idx = roleCounters[role] ?? 0;
        roleCounters[role] = idx + 1;
        const rel = friendlyPublicRelPath(
          role,
          path.extname(filename) || resolved.hintExt || ".png",
          idx,
        );
        if (rel) {
          const pubAbs = path.join(publicDir, rel);
          fs.mkdirSync(path.dirname(pubAbs), { recursive: true });
          fs.copyFileSync(dest, pubAbs);
          publicPath = rel.replace(/\\/g, "/");
          publicCopies.push({
            role,
            from: localPath,
            to: publicPath,
          });
          (asset as PageIRAsset & { publicPath?: string }).publicPath =
            publicPath;
        }
      }

      written.push({
        url: asset.url,
        localPath,
        ok: true,
        fetchUrl: resolved.rewritten ? resolved.fetchUrl : undefined,
        rewritten: resolved.rewritten || undefined,
        publicPath,
        role,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (rewriteIr) asset.localPath = localPath;
      written.push({
        url: asset.url,
        localPath,
        ok: false,
        error: msg,
        fetchUrl: resolved.rewritten ? resolved.fetchUrl : undefined,
        rewritten: resolved.rewritten || undefined,
        role,
      });
    }
  }

  await mapPool(planned, concurrency, processOne);

  written.sort((a, b) => {
    const ia = planned.findIndex(
      (p) => p.asset.url === a.url,
    );
    const ib = planned.findIndex(
      (p) => p.asset.url === b.url,
    );
    return ia - ib;
  });

  return { ir: nextIr, written, outDir, publicCopies };
}

/**
 * Load IR from disk, materialize assets, write updated IR.
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
    throw new Error(
      `Invalid Page IR JSON: ${absIr}: ${e instanceof Error ? e.message : e}`,
    );
  }

  if (!ir || typeof ir !== "object") {
    throw new Error(`Invalid Page IR (not an object): ${absIr}`);
  }
  ir = { ...ir, assets: ir.assets ?? [] };

  const result = await materializeAssets(ir, {
    ...options,
    pageBase: options.pageBase || ir.sourceUrl,
  });

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

function writeIrFile(
  outIrPath: string,
  ir: PageIR,
  originalIrPath: string,
): void {
  const abs = path.resolve(outIrPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });

  if (path.resolve(originalIrPath) === abs && fs.existsSync(abs)) {
    const bak = abs + ".bak";
    fs.copyFileSync(abs, bak);
  }

  fs.writeFileSync(abs, JSON.stringify(ir, null, 2) + "\n", "utf8");
}

function shortHash(input: string): string {
  return crypto
    .createHash("sha256")
    .update(input, "utf8")
    .digest("hex")
    .slice(0, 8);
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
  let n = name.replace(/[/\\?%*:|"<>]/g, "-").replace(/-+/g, "-");
  if (n.length > 180) {
    const extMatch = n.match(/(\.[a-z0-9]{1,8})$/i);
    const ext = extMatch ? extMatch[1] : "";
    n = n.slice(0, 180 - ext.length) + ext;
  }
  return n || "asset.bin";
}

function defaultExtForKind(kind: PageIRAssetKind): string {
  switch (kind) {
    case "image":
      // Prefer unknown images get sniffed later; use .bin only as last resort
      return ".bin";
    case "font":
      return ".woff2";
    case "video":
      return ".mp4";
    default:
      return ".bin";
  }
}

function hasRealExt(filename: string): boolean {
  const e = path.extname(filename).toLowerCase();
  return Boolean(e && e !== ".bin" && e.length <= 6);
}

function replaceExt(filename: string, ext: string): string {
  const e = normalizeExt(ext) || ext;
  const base = filename.replace(/\.[a-z0-9]{1,8}$/i, "");
  return sanitizeFilename(`${base}${e}`);
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
  if (/^\/[a-zA-Z]:\//.test(p)) {
    p = p.slice(1);
  }
  return path.normalize(p);
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length || 1) },
    async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) break;
        await fn(items[i]!, i);
      }
    },
  );
  await Promise.all(workers);
}

// Re-export URL helpers for consumers / tests
export {
  resolveAssetFetchUrl,
  detectAssetRole,
  friendlyPublicRelPath,
  extFromContentType,
  extFromMagicBytes,
} from "./asset-urls";
