/**
 * Asset URL normalization for materialize / capture.
 * - Rewrite Next.js /_next/image?url=… to the real source when possible
 * - Prefer real file extensions over .bin
 * - Detect logo / hero roles for friendly public/ paths
 */

import type { PageIRAssetKind } from "./ir";

export type AssetRole =
  | "logo"
  | "hero"
  | "favicon"
  | "og"
  | "font"
  | "video"
  | "image"
  | "other";

export type ResolvedAssetUrl = {
  /** URL to download */
  fetchUrl: string;
  /** Original IR url (unchanged) */
  originalUrl: string;
  /** True when Next image optimizer was unwrapped */
  rewritten: boolean;
  /** Extension hint from resolved path (.png, .webp, …) */
  hintExt: string;
  /** Basename hint without extension (logo, slide_1, …) */
  hintName: string;
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
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/ogg": ".ogg",
};

/**
 * Unwrap Next.js image optimizer URLs and extract name/ext hints.
 */
export function resolveAssetFetchUrl(
  url: string,
  pageBase?: string,
): ResolvedAssetUrl {
  const originalUrl = url;
  let fetchUrl = url;
  let rewritten = false;
  let hintExt = "";
  let hintName = "";

  if (!url || url.startsWith("data:")) {
    return { fetchUrl: url, originalUrl, rewritten: false, hintExt: "", hintName: "" };
  }

  try {
    const base = pageBase || undefined;
    let u: URL;
    try {
      u = new URL(url, base);
    } catch {
      return { fetchUrl: url, originalUrl, rewritten: false, hintExt: "", hintName: "" };
    }

    // Next.js image optimizer: /_next/image?url=…&w=…&q=…
    if (
      u.pathname.includes("/_next/image") ||
      /\/_next\/image\/?$/i.test(u.pathname)
    ) {
      const nested = u.searchParams.get("url");
      if (nested) {
        let decoded = nested;
        try {
          decoded = decodeURIComponent(nested);
        } catch {
          // keep nested
        }
        // Nested may itself be absolute or site-relative
        try {
          const inner = new URL(decoded, u.origin);
          fetchUrl = inner.href;
          rewritten = true;
          u = inner;
        } catch {
          // relative path only
          try {
            const inner = new URL(decoded, u.origin + "/");
            fetchUrl = inner.href;
            rewritten = true;
            u = inner;
          } catch {
            // leave as-is
          }
        }
      }
    }

    // Vercel / Next static media often: /_next/static/media/name.hash.ext
    const pathForHints = u.pathname;
    hintExt = extFromPathname(pathForHints) || extFromQuery(u);
    hintName = basenameHint(pathForHints);

    // Query format= hints (fonts, some CDNs)
    if (!hintExt) {
      const format = u.searchParams.get("format") || u.searchParams.get("f");
      if (format) {
        const f = `.${format.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
        if (KNOWN_EXTS.has(f === ".jpeg" ? ".jpg" : f)) {
          hintExt = f === ".jpeg" ? ".jpg" : f;
        }
      }
    }
  } catch {
    // keep defaults
  }

  return {
    fetchUrl,
    originalUrl,
    rewritten,
    hintExt,
    hintName,
  };
}

/**
 * Classify asset for friendly public/ placement.
 */
export function detectAssetRole(
  url: string,
  kind: PageIRAssetKind,
  hints?: { name?: string; sectionIds?: string[] },
): AssetRole {
  if (kind === "font") return "font";
  if (kind === "video") return "video";
  if (kind === "other") return "other";

  const hay = `${url} ${hints?.name || ""}`.toLowerCase();
  const name = (hints?.name || "").toLowerCase();

  if (
    /favicon|apple-touch-icon|site\.webmanifest/i.test(hay) ||
    /\.ico(\?|$)/i.test(url)
  ) {
    return "favicon";
  }
  if (
    /\blogo\b|wordmark|brand-mark|brandlogo|logotype|site-logo|nav-logo/i.test(
      hay,
    ) ||
    /^logo/i.test(name)
  ) {
    return "logo";
  }
  if (
    /\bog[-_]?image\b|opengraph|twitter[-_]?card|social[-_]?share/i.test(hay)
  ) {
    return "og";
  }
  if (
    /\bhero\b|banner|jumbotron|masthead|hero-image|hero_bg|hero-bg|landing-hero/i.test(
      hay,
    ) ||
    /^hero/i.test(name)
  ) {
    return "hero";
  }

  // Section association (when provided)
  const sections = hints?.sectionIds || [];
  if (sections.some((id) => /hero|header/i.test(id))) {
    if (/\.svg(\?|$)/i.test(url) || /logo/i.test(hay)) return "logo";
  }

  return kind === "image" ? "image" : "other";
}

/**
 * Friendly relative path under public/ for hero/logo/favicon/og.
 * e.g. logos/logo.png, images/hero.webp
 */
export function friendlyPublicRelPath(
  role: AssetRole,
  ext: string,
  index: number,
): string | null {
  const e = normalizeExt(ext) || ".png";
  switch (role) {
    case "logo":
      return index === 0 ? `logos/logo${e}` : `logos/logo-${index + 1}${e}`;
    case "favicon":
      return index === 0 ? `logos/favicon${e === ".bin" ? ".ico" : e}` : `logos/favicon-${index + 1}${e}`;
    case "hero":
      return index === 0 ? `images/hero${e}` : `images/hero-${index + 1}${e}`;
    case "og":
      return index === 0
        ? `images/og-image${e}`
        : `images/og-image-${index + 1}${e}`;
    default:
      return null;
  }
}

/**
 * Map Content-Type header to a known extension.
 */
export function extFromContentType(contentType: string | null | undefined): string {
  if (!contentType) return "";
  const mime = contentType.split(";")[0].trim().toLowerCase();
  return MIME_EXT[mime] || "";
}

/**
 * Sniff image/font magic bytes when extension is missing or .bin.
 */
export function extFromMagicBytes(buf: Buffer): string {
  if (!buf || buf.length < 4) return "";
  // PNG
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return ".png";
  }
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return ".jpg";
  // GIF
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return ".gif";
  // WEBP: RIFF....WEBP
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return ".webp";
  }
  // SVG / XML text
  const head = buf.slice(0, 64).toString("utf8").trimStart();
  if (head.startsWith("<svg") || head.startsWith("<?xml")) return ".svg";
  // ICO
  if (buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x01 && buf[3] === 0x00) {
    return ".ico";
  }
  // WOFF
  if (buf[0] === 0x77 && buf[1] === 0x4f && buf[2] === 0x46 && buf[3] === 0x46) {
    return ".woff";
  }
  // WOFF2
  if (buf[0] === 0x77 && buf[1] === 0x4f && buf[2] === 0x46 && buf[3] === 0x32) {
    return ".woff2";
  }
  // MP4 ftyp
  if (buf.length >= 8 && buf.slice(4, 8).toString("ascii") === "ftyp") {
    return ".mp4";
  }
  return "";
}

export function normalizeExt(ext: string): string {
  if (!ext) return "";
  let e = ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  if (e === ".jpeg") e = ".jpg";
  return KNOWN_EXTS.has(e) ? e : e.length <= 6 ? e : "";
}

export function extFromPathname(pathname: string): string {
  const base = pathname.split("/").pop() || "";
  // strip Next contenthash: name.abc123def.png
  const m = base.match(/(\.[a-z0-9]{1,8})$/i);
  if (!m) return "";
  return normalizeExt(m[1]);
}

function extFromQuery(u: URL): string {
  const format = u.searchParams.get("format") || u.searchParams.get("f");
  if (format) {
    return normalizeExt(`.${format}`);
  }
  return "";
}

function basenameHint(pathname: string): string {
  const base = pathname.split("/").pop() || "";
  // name.hash.ext or name.ext
  let name = base.replace(/\.[a-z0-9]{1,8}$/i, "");
  // strip content hash segments often 8+ hex/alnum
  name = name.replace(/\.[a-f0-9]{8,}$/i, "");
  name = name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  name = name.replace(/^-+|-+$/g, "").slice(0, 48);
  return name.toLowerCase();
}

export { MIME_EXT, KNOWN_EXTS };
