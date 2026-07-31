import {
  COPY_FORMATS,
  MULTI_COPY_FORMATS,
  buildMultiSectionPack,
  buildRecipePack,
  buildSectionPack,
  formatMultiPackForCopy,
  formatPackForCopy,
  getEntryFromConfig,
  listRecipes,
  listSectionIds,
  mergeVariables,
  parseIdsParam,
  parseVarQueryParams,
  summarizeSectionEntry,
  validateMultiSectionIds,
  type CopyFormat,
  type MultiCopyFormat,
  type SectionPackConfig,
} from "@ctrlc/core";

export type GetSectionPackConfig =
  | SectionPackConfig
  | (() => SectionPackConfig | Promise<SectionPackConfig>);

export type CreateSectionPackHandlerOptions = {
  /**
   * Gate the API. Default: development OR SECTION_PACK_ENABLED=true
   */
  isEnabled?: () => boolean;
  /** Response header prefix, default X-Section-Pack */
  headerPrefix?: string;
};

function defaultIsEnabled() {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.SECTION_PACK_ENABLED === "true"
  );
}

async function resolveConfig(
  getConfig: GetSectionPackConfig,
): Promise<SectionPackConfig> {
  return typeof getConfig === "function" ? await getConfig() : getConfig;
}

function parseFormat(raw: string | null): CopyFormat | null {
  const format = (raw || "json") as CopyFormat;
  if (!COPY_FORMATS.includes(format)) return null;
  return format;
}

function parseMultiFormat(raw: string | null): MultiCopyFormat | null {
  const format = (raw || "json") as MultiCopyFormat;
  if (!MULTI_COPY_FORMATS.includes(format)) return null;
  return format;
}

function listPayload(config: SectionPackConfig) {
  const ids = listSectionIds(config);
  const recipes = listRecipes(config).map((r) => ({
    id: r.id,
    label: r.label,
    description: r.description ?? "",
    sectionIds: r.sectionIds,
    count: r.sectionIds.length,
  }));
  return {
    ids,
    formats: COPY_FORMATS,
    multiFormats: MULTI_COPY_FORMATS,
    count: ids.length,
    sections: config.sections.map(summarizeSectionEntry),
    recipes,
    recipeIds: recipes.map((r) => r.id),
    variableKeys: [
      "productName",
      "tagline",
      "demoHref",
      "email",
      "primaryCta",
      "sectionId",
      "sectionLabel",
    ],
    defaultVariables: mergeVariables(config),
    sharedUtilSelectors: config.sharedUtilSelectors ?? [],
  };
}

/**
 * App Router GET handler factory for SectionPack.
 *
 * Usage:
 * ```ts
 * // app/api/dev/section-pack/route.ts
 * import { createSectionPackGET } from "@ctrlc/next";
 * import { sectionPackConfig } from "@/lib/section-pack-config";
 * export const GET = createSectionPackGET(() => sectionPackConfig);
 * ```
 *
 * Query:
 * - `?list=1`
 * - `?id=hero&format=prompt|prompt-short|describe|component|content|css|template|cursor-rule|json`
 * - `?ids=hero,features&format=prompt|prompt-short|describe|json`
 * - `?recipe=landing-core&format=...`
 * - `var.productName=Acme` brand overrides
 */
export function createSectionPackGET(
  getConfig: GetSectionPackConfig,
  options: CreateSectionPackHandlerOptions = {},
) {
  const isEnabled = options.isEnabled ?? defaultIsEnabled;
  const prefix = options.headerPrefix ?? "X-Section-Pack";

  return async function GET(req: Request): Promise<Response> {
    if (!isEnabled()) {
      return Response.json(
        {
          error:
            "SectionPack API is disabled outside development. Set SECTION_PACK_ENABLED=true to enable.",
        },
        { status: 403 },
      );
    }

    const config = await resolveConfig(getConfig);
    const url = new URL(req.url);

    if (url.searchParams.get("list") === "1") {
      return Response.json(listPayload(config));
    }

    const vars = mergeVariables(config, parseVarQueryParams(url.searchParams));

    const recipeParam = url.searchParams.get("recipe");
    if (recipeParam != null && recipeParam !== "") {
      return handleRecipe(config, recipeParam, url.searchParams.get("format"), vars, prefix);
    }

    const idsParam = url.searchParams.get("ids");
    if (idsParam != null) {
      return handleMulti(config, idsParam, url.searchParams.get("format"), vars, prefix);
    }

    const id = url.searchParams.get("id");
    if (!id) {
      return Response.json(
        {
          error:
            "Missing id, ids, or recipe. Use ?id=hero, ?ids=hero,features, ?recipe=landing-core, or ?list=1",
          formats: COPY_FORMATS,
          multiFormats: MULTI_COPY_FORMATS,
          ids: listSectionIds(config),
          recipeIds: listRecipes(config).map((r) => r.id),
        },
        { status: 400 },
      );
    }

    const entry = getEntryFromConfig(config, id);
    if (!entry) {
      return Response.json(
        { error: `Unknown section id: ${id}`, known: listSectionIds(config) },
        { status: 404 },
      );
    }

    const pack = buildSectionPack(entry, {
      rootDir: config.rootDir ?? process.cwd(),
      sharedUtilSelectors: config.sharedUtilSelectors,
    });

    const format = parseFormat(url.searchParams.get("format"));
    if (!format) {
      return Response.json(
        { error: `Invalid format. Use: ${COPY_FORMATS.join(", ")}` },
        { status: 400 },
      );
    }

    if (format === "zip") {
      return Response.json(
        {
          error:
            "Zip export is not enabled in this package build. Use format=json or prompt.",
          id,
        },
        { status: 501 },
      );
    }

    const body = formatPackForCopy(pack, format, {
      ...vars,
      sectionId: pack.id,
      sectionLabel: pack.label,
    });

    const isJson = format === "json";
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": isJson
          ? "application/json; charset=utf-8"
          : "text/plain; charset=utf-8",
        [`${prefix}-Id`]: id,
        [`${prefix}-Format`]: format,
        [`${prefix}-Label`]: pack.label,
        [`${prefix}-Content-Hash`]: pack.contentHash,
        [`${prefix}-Bytes`]: String(Buffer.byteLength(body, "utf8")),
      },
    });
  };
}

/**
 * Returns `{ GET }` for App Router route modules that prefer a handlers object.
 */
export function createSectionPackHandlers(
  getConfig: GetSectionPackConfig,
  options?: CreateSectionPackHandlerOptions,
) {
  return {
    GET: createSectionPackGET(getConfig, options),
  };
}

async function handleMulti(
  config: SectionPackConfig,
  idsParam: string,
  formatRaw: string | null,
  vars: Record<string, string>,
  prefix: string,
): Promise<Response> {
  const validation = validateMultiSectionIds(config, parseIdsParam(idsParam));
  if (!validation.ok) {
    return Response.json(
      {
        error: validation.error,
        known: validation.known,
        unknown: validation.unknown,
      },
      { status: validation.status },
    );
  }

  const format = parseMultiFormat(formatRaw);
  if (!format) {
    return Response.json(
      { error: `Invalid multi format. Use: ${MULTI_COPY_FORMATS.join(", ")}` },
      { status: 400 },
    );
  }

  if (format === "zip") {
    return Response.json(
      { error: "Zip export is not enabled for multi packs in this build." },
      { status: 501 },
    );
  }

  const multi = buildMultiSectionPack(config, validation.ids);
  const body = formatMultiPackForCopy(multi, format, vars);
  const isJson = format === "json";
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": isJson
        ? "application/json; charset=utf-8"
        : "text/plain; charset=utf-8",
      [`${prefix}-Ids`]: multi.ids.join(","),
      [`${prefix}-Format`]: format,
      [`${prefix}-Bytes`]: String(Buffer.byteLength(body, "utf8")),
    },
  });
}

async function handleRecipe(
  config: SectionPackConfig,
  recipeId: string,
  formatRaw: string | null,
  vars: Record<string, string>,
  prefix: string,
): Promise<Response> {
  const result = buildRecipePack(config, recipeId);
  if ("error" in result) {
    return Response.json(result, { status: 404 });
  }

  const format = parseMultiFormat(formatRaw);
  if (!format) {
    return Response.json(
      { error: `Invalid multi format. Use: ${MULTI_COPY_FORMATS.join(", ")}` },
      { status: 400 },
    );
  }

  if (format === "zip") {
    return Response.json(
      { error: "Zip export is not enabled for recipe packs in this build." },
      { status: 501 },
    );
  }

  const body = formatMultiPackForCopy(result, format, vars);
  const isJson = format === "json";
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": isJson
        ? "application/json; charset=utf-8"
        : "text/plain; charset=utf-8",
      [`${prefix}-Recipe`]: recipeId,
      [`${prefix}-Ids`]: result.ids.join(","),
      [`${prefix}-Format`]: format,
      [`${prefix}-Bytes`]: String(Buffer.byteLength(body, "utf8")),
    },
  });
}
