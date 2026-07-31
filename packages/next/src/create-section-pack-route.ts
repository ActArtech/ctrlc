/**
 * App Router GET factory for SectionPack dev API.
 *
 * Query surface:
 *   ?list=1
 *   ?id=<section>&format=<format>
 *   ?ids=a,b,c&format=<format>
 *   ?recipe=<recipeId>&format=<format>
 *   var.productName=Acme (variable overrides)
 *
 * Formats: component | content | css | template | prompt | prompt-short |
 *          describe | cursor-rule | json | zip
 *
 * List enrichment: optional previewUrl from entry.previewImage / thumbnail
 * or conventional files under public/ctrlc-previews/ and
 * docs/research/baselines/ (public-served paths only for usable URLs).
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  COPY_FORMATS,
  MULTI_COPY_FORMATS,
  PackCache,
  buildMultiSectionPack,
  buildRecipePack,
  buildSectionPackById,
  buildSectionZip,
  buildMultiSectionZip,
  formatMultiPackForCopy,
  formatPackForCopy,
  getCachedSectionPack,
  getSectionEntry,
  listSectionIds,
  mergeVariables,
  packSourceMtimeKey,
  parseCopyFormat,
  parseIdsParam,
  parseMultiFormat,
  parseVarQueryParams,
  summarizeSectionEntry,
  type CopyFormat,
  type MultiCopyFormat,
  type SectionPackConfig,
  type SectionPackEntry,
} from "@ctrlc/core";

const PREVIEW_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".svg"] as const;

/**
 * Normalize entry.previewImage / thumbnail to a browser URL.
 * Accepts http(s)/data URLs, site-absolute paths, or public-relative paths.
 */
function normalizePreviewField(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const t = raw.trim();
  if (!t) return undefined;
  if (
    t.startsWith("http://") ||
    t.startsWith("https://") ||
    t.startsWith("data:")
  ) {
    return t;
  }
  if (t.startsWith("/")) return t;
  const stripped = t.replace(/^public[\\/]/, "").replace(/\\/g, "/");
  return `/${stripped.replace(/^\//, "")}`;
}

/**
 * Resolve a catalog-usable preview URL for a section.
 * Never throws; missing files simply yield undefined.
 *
 * Lookup order:
 * 1. entry.previewImage / entry.thumbnail (public-relative, site path, or absolute URL)
 * 2. public/ctrlc-previews/<id>.{png,jpg,jpeg,webp,svg}
 * 3. public/docs/research/baselines/<id>.{ext} (mirrored baselines under public)
 * 4. docs/research/baselines/<id>.{ext} when a matching file exists and the host
 *    also exposes it under public/ (we map to /ctrlc-previews only if present;
 *    bare docs/ is not web-served by Next so no URL is emitted for docs alone)
 */
export function resolveSectionPreviewUrl(
  entry: Pick<SectionPackEntry, "id" | "previewImage" | "thumbnail">,
  cwd: string = process.cwd(),
): string | undefined {
  const fromField = normalizePreviewField(
    entry.previewImage || entry.thumbnail,
  );
  if (fromField) {
    if (
      fromField.startsWith("http://") ||
      fromField.startsWith("https://") ||
      fromField.startsWith("data:")
    ) {
      return fromField;
    }
    // Prefer confirming the file under public/ when it is a site path
    const underPublic = join(cwd, "public", fromField.replace(/^\//, ""));
    if (existsSync(underPublic)) return fromField;
    // Author-declared path: still return so static hosts / CDNs can serve it
    return fromField;
  }

  for (const ext of PREVIEW_EXTS) {
    const publicPreview = join(
      cwd,
      "public",
      "ctrlc-previews",
      `${entry.id}${ext}`,
    );
    if (existsSync(publicPreview)) {
      return `/ctrlc-previews/${entry.id}${ext}`;
    }
  }

  for (const ext of PREVIEW_EXTS) {
    const publicBaseline = join(
      cwd,
      "public",
      "docs",
      "research",
      "baselines",
      `${entry.id}${ext}`,
    );
    if (existsSync(publicBaseline)) {
      return `/docs/research/baselines/${entry.id}${ext}`;
    }
  }

  // docs/research/baselines/<id>.png is the capture convention. Next only serves
  // public/, so a bare research baseline does not yield a previewUrl. Copy or
  // symlink into public/ctrlc-previews/<id>.png (or set entry.previewImage).
  return undefined;
}

export type GetSectionPackConfig =
  | SectionPackConfig
  | (() => SectionPackConfig | Promise<SectionPackConfig>);

export type CreateSectionPackGETOptions = {
  /**
   * When true (default), refuse outside development unless
   * SECTION_PACK_ENABLED=true or CTRLC_SECTION_PACK=1.
   */
  devOnly?: boolean;
  /**
   * In-memory single-section pack cache (id + source mtimes).
   * - default / true: enable a handler-local PackCache (max 64)
   * - false: always rebuild
   * - PackCache instance: use a shared cache across handlers
   */
  cache?: boolean | PackCache;
};

function resolvePackCache(
  cacheOpt: boolean | PackCache | undefined,
): PackCache | null {
  if (cacheOpt === false) return null;
  if (cacheOpt instanceof PackCache) return cacheOpt;
  return new PackCache();
}

function isAllowed(devOnly: boolean): boolean {
  if (!devOnly) return true;
  if (process.env.SECTION_PACK_ENABLED === "true") return true;
  if (process.env.CTRLC_SECTION_PACK === "1") return true;
  return process.env.NODE_ENV !== "production";
}

async function resolveConfig(
  getConfig: GetSectionPackConfig,
): Promise<SectionPackConfig> {
  return typeof getConfig === "function" ? await getConfig() : getConfig;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function text(body: string, contentType: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
}

function zipResponse(bytes: Uint8Array, filename: string): Response {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Response(copy, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function contentTypeFor(format: string): string {
  if (format === "json") return "application/json; charset=utf-8";
  if (format === "css") return "text/css; charset=utf-8";
  if (
    format === "component" ||
    format === "content" ||
    format === "template" ||
    format === "cursor-rule"
  ) {
    return "text/plain; charset=utf-8";
  }
  return "text/markdown; charset=utf-8";
}

function listPayload(config: SectionPackConfig, cwd: string = process.cwd()) {
  const sections = config.sections.map((entry) => {
    const summary = summarizeSectionEntry(entry);
    const previewUrl = resolveSectionPreviewUrl(entry, cwd);
    return previewUrl ? { ...summary, previewUrl } : summary;
  });
  const recipes = (config.recipes ?? []).map((r) => ({
    id: r.id,
    label: r.label,
    description: r.description,
    sectionIds: r.sectionIds,
    count: r.sectionIds.length,
  }));

  return {
    ids: listSectionIds(config),
    sections,
    /** @deprecated alias for older clients */
    slices: sections,
    formats: [...COPY_FORMATS],
    multiFormats: [...MULTI_COPY_FORMATS],
    recipes,
    recipeIds: recipes.map((r) => r.id),
    count: sections.length,
    defaultVariables: mergeVariables(config),
  };
}

/**
 * Create a Next.js App Router `GET` handler for SectionPack.
 *
 * @example
 * ```ts
 * import { createSectionPackGET } from "@ctrlc/next";
 * import { sectionPackConfig } from "@/lib/section-pack-config";
 * export const GET = createSectionPackGET(() => sectionPackConfig);
 * ```
 */
export function createSectionPackGET(
  getConfig: GetSectionPackConfig,
  options: CreateSectionPackGETOptions = {},
): (request: Request) => Promise<Response> {
  const devOnly = options.devOnly !== false;
  const packCache = resolvePackCache(options.cache);

  return async function GET(request: Request): Promise<Response> {
    if (!isAllowed(devOnly)) {
      return json(
        {
          error:
            "SectionPack API is disabled outside development. Set SECTION_PACK_ENABLED=true to enable.",
        },
        403,
      );
    }

    let config: SectionPackConfig;
    try {
      config = await resolveConfig(getConfig);
    } catch (err) {
      return json(
        {
          error: "Failed to load SectionPack config",
          detail: err instanceof Error ? err.message : String(err),
        },
        500,
      );
    }

    if (!config?.sections?.length) {
      return json({ error: "SectionPack config has no sections" }, 500);
    }

    const url = new URL(request.url);
    const sp = url.searchParams;

    if (sp.get("list") === "1" || sp.get("list") === "true") {
      return json(listPayload(config, process.cwd()));
    }

    const vars = mergeVariables(config, parseVarQueryParams(sp));
    const formatRaw = (sp.get("format") || "json").trim();
    const id = sp.get("id")?.trim() || null;
    const recipeId = sp.get("recipe")?.trim() || null;
    const ids = parseIdsParam(sp.get("ids"));

    // Recipe multi pack
    if (recipeId) {
      const multiFormat = parseMultiFormat(formatRaw);
      if (!multiFormat) {
        return json(
          {
            error: `Invalid multi format "${formatRaw}"`,
            known: MULTI_COPY_FORMATS,
          },
          400,
        );
      }
      const built = buildRecipePack(config, recipeId);
      if ("error" in built) {
        return json(
          {
            error: built.error,
            known: built.knownRecipes ?? [],
            knownRecipes: built.knownRecipes,
            unknownSections: built.unknownSections,
          },
          built.status ?? 404,
        );
      }
      if (multiFormat === "zip") {
        const z = buildMultiSectionZip(built);
        return zipResponse(z.bytes, z.filename);
      }
      const body = formatMultiPackForCopy(built, multiFormat, vars);
      return text(body, contentTypeFor(multiFormat));
    }

    // Multi ids
    if (ids.length > 0 && !id) {
      const multiFormat = parseMultiFormat(formatRaw);
      if (!multiFormat) {
        return json(
          {
            error: `Invalid multi format "${formatRaw}"`,
            known: MULTI_COPY_FORMATS,
          },
          400,
        );
      }
      const known = new Set(config.sections.map((s) => s.id));
      const unknown = ids.filter((x) => !known.has(x));
      if (unknown.length) {
        return json(
          {
            error: `Unknown section id(s): ${unknown.join(", ")}`,
            known: [...known],
            unknown,
          },
          400,
        );
      }
      const multi = buildMultiSectionPack(config, ids);
      if (multiFormat === "zip") {
        const z = buildMultiSectionZip(multi);
        return zipResponse(z.bytes, z.filename);
      }
      const body = formatMultiPackForCopy(multi, multiFormat, vars);
      return text(body, contentTypeFor(multiFormat));
    }

    if (!id) {
      return json(
        {
          error:
            "Missing id, ids, or recipe. Use ?id=hero, ?ids=hero,features, ?recipe=landing-core, or ?list=1",
          formats: COPY_FORMATS,
          multiFormats: MULTI_COPY_FORMATS,
          ids: listSectionIds(config),
          recipeIds: (config.recipes ?? []).map((r) => r.id),
        },
        400,
      );
    }

    const format = parseCopyFormat(formatRaw) as CopyFormat | null;
    if (!format) {
      return json(
        {
          error: `Invalid format "${formatRaw}"`,
          known: COPY_FORMATS,
        },
        400,
      );
    }

    const entry = getSectionEntry(config, id);
    if (!entry) {
      return json(
        { error: `Unknown section id: ${id}`, known: listSectionIds(config) },
        404,
      );
    }

    const cwd = process.cwd();
    const cacheKey = packCache
      ? packSourceMtimeKey(entry, cwd)
      : undefined;

    let pack;
    try {
      pack = getCachedSectionPack(
        id,
        () => buildSectionPackById(config, id, { cwd }),
        { cache: packCache, key: cacheKey },
      );
    } catch (err) {
      return json(
        {
          error: `Failed to build section pack: ${id}`,
          detail: err instanceof Error ? err.message : String(err),
          known: listSectionIds(config),
        },
        500,
      );
    }

    if (format === "zip") {
      const z = buildSectionZip(pack);
      return zipResponse(z.bytes, z.filename);
    }

    const body = formatPackForCopy(pack, format, {
      ...vars,
      sectionId: pack.id,
      sectionLabel: pack.label,
    });
    return text(body, contentTypeFor(format));
  };
}

/**
 * Returns `{ GET }` for App Router route modules.
 */
export function createSectionPackHandlers(
  getConfig: GetSectionPackConfig,
  options?: CreateSectionPackGETOptions,
) {
  return {
    GET: createSectionPackGET(getConfig, options),
  };
}

// Silence unused MultiCopyFormat type import if only used in comments
export type { CopyFormat, MultiCopyFormat };
