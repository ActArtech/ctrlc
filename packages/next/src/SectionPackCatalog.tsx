"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type CatalogSection = {
  id: string;
  label: string;
  description: string;
  tags: string[];
  componentPath: string;
  componentExport?: string;
  cssSelectors?: string[];
  promptRole?: string;
  /** Public-relative or absolute preview image from config */
  previewImage?: string;
  /** Alias of previewImage */
  thumbnail?: string;
  /** Server-resolved preview URL (from conventional files or entry fields) */
  previewUrl?: string;
};

export type CatalogRecipe = {
  id: string;
  label: string;
  description?: string;
  sectionIds: string[];
  count?: number;
};

export type CatalogListResponse = {
  ids: string[];
  formats: string[];
  multiFormats?: string[];
  count: number;
  sections: CatalogSection[];
  recipes?: CatalogRecipe[];
  recipeIds?: string[];
  defaultVariables?: Record<string, string>;
};

export type SectionPackCatalogProps = {
  /** API base, default `/api/dev/section-pack` */
  apiBase?: string;
  /** Home link */
  homeHref?: string;
  title?: string;
};

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

function parseCsvParam(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function uniquePreserveOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Prefer API previewUrl, then entry fields. */
function sectionPreviewSrc(s: CatalogSection): string | undefined {
  const raw = s.previewUrl || s.previewImage || s.thumbnail;
  if (!raw) return undefined;
  const t = raw.trim();
  if (!t) return undefined;
  if (
    t.startsWith("http://") ||
    t.startsWith("https://") ||
    t.startsWith("data:") ||
    t.startsWith("/")
  ) {
    return t;
  }
  return `/${t.replace(/^public\//, "")}`;
}

/** 1-2 letter monogram from section id. */
function sectionMonogram(id: string): string {
  const parts = id.split(/[-_\s]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return id.slice(0, 2).toUpperCase() || "?";
}

/** Stable hue for placeholder gradient from id. */
function sectionHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

/**
 * Production client catalog for SectionPack:
 * search, tag chips, multi-select, recipes, bulk export, deep links.
 *
 * Deep links (catalog page URL):
 * - `?selected=hero,features` preselects section ids
 * - `?recipe=landing-core` selects that recipe's sections
 */
export function SectionPackCatalog({
  apiBase = "/api/dev/section-pack",
  homeHref = "/",
  title = "Section packs",
}: SectionPackCatalogProps) {
  const [data, setData] = useState<CatalogListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "err">("ok");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [brokenThumbs, setBrokenThumbs] = useState<Set<string>>(() => new Set());

  // Load catalog
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${apiBase}?list=1`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.text();
          throw new Error(body || String(res.status));
        }
        return res.json() as Promise<CatalogListResponse>;
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);

        // Deep links from catalog page URL
        if (typeof window !== "undefined") {
          const sp = new URLSearchParams(window.location.search);
          const recipeParam = sp.get("recipe")?.trim() || null;
          const selectedParam = parseCsvParam(sp.get("selected"));

          if (recipeParam && json.recipes?.length) {
            const recipe = json.recipes.find((r) => r.id === recipeParam);
            if (recipe) {
              setActiveRecipeId(recipe.id);
              setSelected(new Set(recipe.sectionIds));
            }
          } else if (selectedParam.length) {
            const known = new Set(
              (json.sections ?? []).map((s) => s.id).concat(json.ids ?? []),
            );
            const ids = selectedParam.filter((id) => known.has(id));
            if (ids.length) setSelected(new Set(ids));
          }
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  const sections = data?.sections ?? [];
  const recipes = data?.recipes ?? [];

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sections) {
      for (const t of s.tags ?? []) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag, count]) => ({ tag, count }));
  }, [sections]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sections.filter((s) => {
      if (activeTag && !(s.tags ?? []).includes(activeTag)) return false;
      if (!q) return true;
      const hay = [
        s.id,
        s.label,
        s.description,
        s.componentPath,
        s.promptRole ?? "",
        ...(s.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [sections, query, activeTag]);

  const selectedIds = useMemo(
    () => uniquePreserveOrder(sections.map((s) => s.id).filter((id) => selected.has(id))),
    [sections, selected],
  );
  const selectedCount = selectedIds.length;

  const flash = useCallback((msg: string, tone: "ok" | "err" = "ok") => {
    setStatus(msg);
    setStatusTone(tone);
  }, []);

  const toggleOne = useCallback((id: string) => {
    setActiveRecipeId(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllFiltered = useCallback(() => {
    setActiveRecipeId(null);
    setSelected((prev) => {
      const next = new Set(prev);
      for (const s of filtered) next.add(s.id);
      return next;
    });
  }, [filtered]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setActiveRecipeId(null);
    flash("Selection cleared");
  }, [flash]);

  const applyRecipe = useCallback(
    (recipe: CatalogRecipe) => {
      setActiveRecipeId(recipe.id);
      setSelected(new Set(recipe.sectionIds));
      flash(`Selected recipe "${recipe.label}" (${recipe.sectionIds.length})`);
    },
    [flash],
  );

  const fetchCopy = useCallback(
    async (url: string, label: string) => {
      setBusy(label);
      setStatus(null);
      try {
        const res = await fetch(url);
        if (!res.ok) {
          const body = await res.text();
          throw new Error(body || String(res.status));
        }
        const text = await res.text();
        await copyText(text);
        flash(`Copied ${label}`);
      } catch (e) {
        flash(e instanceof Error ? e.message : "Copy failed", "err");
      } finally {
        setBusy(null);
      }
    },
    [flash],
  );

  const copySingle = useCallback(
    (id: string, format: string) => {
      const label = `${id}:${format}`;
      return fetchCopy(
        `${apiBase}?id=${encodeURIComponent(id)}&format=${encodeURIComponent(format)}`,
        label,
      );
    },
    [apiBase, fetchCopy],
  );

  const copyBulk = useCallback(
    (format: string) => {
      if (!selectedIds.length) {
        flash("Select at least one section", "err");
        return;
      }
      const ids = selectedIds.join(",");
      const label = `bulk:${format} (${selectedIds.length})`;
      return fetchCopy(
        `${apiBase}?ids=${encodeURIComponent(ids)}&format=${encodeURIComponent(format)}`,
        label,
      );
    },
    [apiBase, fetchCopy, flash, selectedIds],
  );

  const downloadZip = useCallback(() => {
    if (!selectedIds.length) {
      flash("Select at least one section", "err");
      return;
    }
    const ids = selectedIds.join(",");
    const href = `${apiBase}?ids=${encodeURIComponent(ids)}&format=zip`;
    flash(`Downloading zip for ${selectedIds.length} section(s)...`);
    window.location.assign(href);
  }, [apiBase, flash, selectedIds]);

  const openPack = useCallback(
    (id: string) => {
      window.open(
        `${apiBase}?id=${encodeURIComponent(id)}&format=prompt-short`,
        "_blank",
        "noopener,noreferrer",
      );
    },
    [apiBase],
  );

  const openPreview = useCallback((id: string) => {
    setPreviewId(id);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewId(null);
  }, []);

  // Esc closes preview drawer
  useEffect(() => {
    if (!previewId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setPreviewId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewId]);

  const markThumbBroken = useCallback((id: string) => {
    setBrokenThumbs((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const previewSection = useMemo(
    () =>
      previewId
        ? (sections.find((s) => s.id === previewId) ?? null)
        : null,
    [previewId, sections],
  );

  // --- render states ---

  if (error) {
    return (
      <main className="spack-cat">
        <CatalogStyles />
        <div className="spack-cat__inner">
          <a href={homeHref} className="spack-cat__home">
            Home
          </a>
          <h1 className="spack-cat__title">{title}</h1>
          <div className="spack-cat__banner spack-cat__banner--err" role="alert">
            Failed to load catalog: {error}
          </div>
        </div>
      </main>
    );
  }

  if (loading || !data) {
    return (
      <main className="spack-cat">
        <CatalogStyles />
        <div className="spack-cat__inner">
          <a href={homeHref} className="spack-cat__home">
            Home
          </a>
          <h1 className="spack-cat__title">{title}</h1>
          <p className="spack-cat__sub">Loading packs...</p>
          <div className="spack-cat__skeleton" aria-hidden>
            <div className="spack-cat__skel-row" />
            <div className="spack-cat__skel-row" />
            <div className="spack-cat__skel-row" />
          </div>
        </div>
      </main>
    );
  }

  const formats = data.formats ?? [];
  const multiFormats = data.multiFormats ?? [];

  return (
    <main className="spack-cat">
      <CatalogStyles />
      <div className="spack-cat__inner">
        <a href={homeHref} className="spack-cat__home">
          Home
        </a>
        <header className="spack-cat__header">
          <h1 className="spack-cat__title">{title}</h1>
          <p className="spack-cat__sub">
            {data.count} section{data.count === 1 ? "" : "s"} registered.
            {formats.length ? (
              <>
                {" "}
                Formats: <code className="spack-cat__code">{formats.join(", ")}</code>
              </>
            ) : null}
            {multiFormats.length ? (
              <>
                {" "}
                Multi:{" "}
                <code className="spack-cat__code">{multiFormats.join(", ")}</code>
              </>
            ) : null}
          </p>
          <p className="spack-cat__meta">
            Source <code className="spack-cat__code">{apiBase}?list=1</code>
            {selectedCount > 0 ? (
              <>
                {" "}
                | Deep link{" "}
                <code className="spack-cat__code">
                  ?selected={selectedIds.join(",")}
                </code>
              </>
            ) : null}
          </p>
        </header>

        {/* Recipes */}
        {recipes.length > 0 ? (
          <section className="spack-cat__recipes" aria-label="Recipes">
            <div className="spack-cat__section-head">
              <h2 className="spack-cat__h2">Recipes</h2>
              <span className="spack-cat__muted">{recipes.length} presets</span>
            </div>
            <div className="spack-cat__recipe-list">
              {recipes.map((r) => {
                const isActive = activeRecipeId === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={
                      isActive
                        ? "spack-cat__recipe is-active"
                        : "spack-cat__recipe"
                    }
                    title={r.description || r.label}
                    onClick={() => applyRecipe(r)}
                  >
                    <span className="spack-cat__recipe-label">{r.label}</span>
                    <span className="spack-cat__recipe-count">
                      {r.count ?? r.sectionIds.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Toolbar: search + tags + bulk */}
        <section className="spack-cat__toolbar" aria-label="Filters and bulk actions">
          <div className="spack-cat__search-row">
            <label className="spack-cat__search">
              <span className="spack-cat__sr">Search sections</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search id, label, tags, path..."
                className="spack-cat__input"
                autoComplete="off"
              />
            </label>
            <div className="spack-cat__sel-badge" aria-live="polite">
              {selectedCount} selected
            </div>
          </div>

          {allTags.length > 0 ? (
            <div className="spack-cat__tags" role="group" aria-label="Filter by tag">
              <button
                type="button"
                className={
                  activeTag == null
                    ? "spack-cat__tag-chip is-active"
                    : "spack-cat__tag-chip"
                }
                onClick={() => setActiveTag(null)}
              >
                All
              </button>
              {allTags.map(({ tag, count }) => (
                <button
                  key={tag}
                  type="button"
                  className={
                    activeTag === tag
                      ? "spack-cat__tag-chip is-active"
                      : "spack-cat__tag-chip"
                  }
                  onClick={() =>
                    setActiveTag((cur) => (cur === tag ? null : tag))
                  }
                >
                  {tag}
                  <span className="spack-cat__tag-n">{count}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="spack-cat__bulk">
            <button
              type="button"
              className="spack-cat__btn"
              onClick={selectAllFiltered}
              disabled={!filtered.length}
            >
              Select visible
            </button>
            <button
              type="button"
              className="spack-cat__btn"
              onClick={clearSelection}
              disabled={!selectedCount}
            >
              Clear
            </button>
            <span className="spack-cat__bulk-sep" aria-hidden />
            <button
              type="button"
              className="spack-cat__btn spack-cat__btn--primary"
              disabled={!selectedCount || busy != null}
              onClick={() => void copyBulk("describe")}
            >
              {busy?.startsWith("bulk:describe")
                ? "Copying..."
                : "Copy natural language"}
            </button>
            <button
              type="button"
              className="spack-cat__btn spack-cat__btn--primary"
              disabled={!selectedCount || busy != null}
              onClick={() => void copyBulk("prompt")}
            >
              {busy?.startsWith("bulk:prompt") && !busy.includes("prompt-short")
                ? "Copying..."
                : "Copy code as-is"}
            </button>
            <button
              type="button"
              className="spack-cat__btn"
              disabled={!selectedCount}
              onClick={downloadZip}
            >
              Download zip
            </button>
          </div>
        </section>

        {/* Section list */}
        {filtered.length === 0 ? (
          <div className="spack-cat__empty">
            <p>
              {sections.length === 0
                ? "No sections registered in this config."
                : "No sections match your search or tag filter."}
            </p>
            {query || activeTag ? (
              <button
                type="button"
                className="spack-cat__btn"
                onClick={() => {
                  setQuery("");
                  setActiveTag(null);
                }}
              >
                Reset filters
              </button>
            ) : null}
          </div>
        ) : (
          <ul className="spack-cat__list">
            {filtered.map((s) => {
              const isOn = selected.has(s.id);
              const checkId = `spack-cat-check-${s.id}`;
              const thumbSrc = sectionPreviewSrc(s);
              const showImg = Boolean(thumbSrc) && !brokenThumbs.has(s.id);
              const hue = sectionHue(s.id);
              return (
                <li key={s.id}>
                  <article
                    className={
                      isOn ? "spack-cat__card is-selected" : "spack-cat__card"
                    }
                  >
                    <div className="spack-cat__card-top">
                      <label className="spack-cat__check" htmlFor={checkId}>
                        <input
                          id={checkId}
                          type="checkbox"
                          checked={isOn}
                          onChange={() => toggleOne(s.id)}
                          aria-label={`Select ${s.label}`}
                        />
                        <span className="spack-cat__check-box" aria-hidden />
                      </label>
                      <button
                        type="button"
                        className="spack-cat__thumb"
                        onClick={() => openPreview(s.id)}
                        aria-label={`Preview ${s.label}`}
                        title={`Preview ${s.label}`}
                        style={
                          showImg
                            ? undefined
                            : {
                                background: `linear-gradient(135deg, hsl(${hue} 55% 42%) 0%, hsl(${(hue + 40) % 360} 50% 28%) 100%)`,
                              }
                        }
                      >
                        {showImg ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumbSrc}
                            alt=""
                            className="spack-cat__thumb-img"
                            loading="lazy"
                            onError={() => markThumbBroken(s.id)}
                          />
                        ) : (
                          <span className="spack-cat__monogram" aria-hidden>
                            {sectionMonogram(s.id)}
                          </span>
                        )}
                      </button>
                      <div className="spack-cat__card-main">
                        <div className="spack-cat__title-row">
                          <h2 className="spack-cat__label">
                            <button
                              type="button"
                              className="spack-cat__label-btn"
                              onClick={() => openPreview(s.id)}
                              aria-label={`Open preview for ${s.label}`}
                            >
                              {s.label}
                            </button>
                          </h2>
                          <span className="spack-cat__id">{s.id}</span>
                        </div>
                        {s.description ? (
                          <p className="spack-cat__desc">{s.description}</p>
                        ) : null}
                        {s.tags?.length ? (
                          <div className="spack-cat__row-tags">
                            {s.tags.map((t) => (
                              <button
                                key={t}
                                type="button"
                                className="spack-cat__mini-tag"
                                onClick={() =>
                                  setActiveTag((cur) => (cur === t ? null : t))
                                }
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        <p className="spack-cat__path">
                          <code>{s.componentPath}</code>
                          {s.componentExport ? (
                            <span className="spack-cat__muted">
                              {" "}
                              | export {s.componentExport}
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </div>
                    <div className="spack-cat__actions">
                      <button
                        type="button"
                        className="spack-cat__btn"
                        onClick={() => openPreview(s.id)}
                        aria-label={`Preview ${s.label}`}
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        className="spack-cat__btn"
                        disabled={busy === `${s.id}:describe`}
                        onClick={() => void copySingle(s.id, "describe")}
                      >
                        {busy === `${s.id}:describe` ? "..." : "Copy NL"}
                      </button>
                      <button
                        type="button"
                        className="spack-cat__btn"
                        disabled={busy === `${s.id}:prompt-short`}
                        onClick={() => void copySingle(s.id, "prompt-short")}
                      >
                        {busy === `${s.id}:prompt-short`
                          ? "..."
                          : "Copy short"}
                      </button>
                      <button
                        type="button"
                        className="spack-cat__btn"
                        disabled={busy === `${s.id}:prompt`}
                        onClick={() => void copySingle(s.id, "prompt")}
                      >
                        {busy === `${s.id}:prompt` ? "..." : "Copy full"}
                      </button>
                      <a
                        className="spack-cat__btn spack-cat__btn--link"
                        href={`${apiBase}?id=${encodeURIComponent(s.id)}&format=prompt-short`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          e.preventDefault();
                          openPack(s.id);
                        }}
                      >
                        Open pack
                      </a>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}

        {previewSection ? (
          <PreviewDrawer
            section={previewSection}
            busy={busy}
            brokenThumb={brokenThumbs.has(previewSection.id)}
            onClose={closePreview}
            onThumbError={() => markThumbBroken(previewSection.id)}
            onCopyNl={() => void copySingle(previewSection.id, "describe")}
            onCopyCode={() => void copySingle(previewSection.id, "prompt")}
            onTag={(t) => {
              setActiveTag((cur) => (cur === t ? null : t));
              closePreview();
            }}
          />
        ) : null}

        {status ? (
          <div
            className={
              statusTone === "err"
                ? "spack-cat__toast spack-cat__toast--err"
                : "spack-cat__toast"
            }
            role="status"
          >
            {status}
          </div>
        ) : null}
      </div>
    </main>
  );
}

type PreviewDrawerProps = {
  section: CatalogSection;
  busy: string | null;
  brokenThumb: boolean;
  onClose: () => void;
  onThumbError: () => void;
  onCopyNl: () => void;
  onCopyCode: () => void;
  onTag: (tag: string) => void;
};

function PreviewDrawer({
  section: s,
  busy,
  brokenThumb,
  onClose,
  onThumbError,
  onCopyNl,
  onCopyCode,
  onTag,
}: PreviewDrawerProps) {
  const thumbSrc = sectionPreviewSrc(s);
  const showImg = Boolean(thumbSrc) && !brokenThumb;
  const hue = sectionHue(s.id);
  const titleId = `spack-cat-preview-title-${s.id}`;

  return (
    <div className="spack-cat__drawer-root">
      <button
        type="button"
        className="spack-cat__drawer-backdrop"
        aria-label="Close preview"
        onClick={onClose}
      />
      <div
        className="spack-cat__drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="spack-cat__drawer-head">
          <div>
            <h2 id={titleId} className="spack-cat__drawer-title">
              {s.label}
            </h2>
            <p className="spack-cat__drawer-id">
              <code>{s.id}</code>
              {s.promptRole ? (
                <span className="spack-cat__muted"> · {s.promptRole}</span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            className="spack-cat__btn"
            onClick={onClose}
            aria-label="Close preview"
          >
            Close
          </button>
        </div>

        <div
          className="spack-cat__drawer-visual"
          style={
            showImg
              ? undefined
              : {
                  background: `linear-gradient(135deg, hsl(${hue} 55% 42%) 0%, hsl(${(hue + 40) % 360} 50% 28%) 100%)`,
                }
          }
        >
          {showImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbSrc}
              alt={`Preview of ${s.label}`}
              className="spack-cat__drawer-img"
              onError={onThumbError}
            />
          ) : (
            <span className="spack-cat__drawer-mono" aria-hidden>
              {sectionMonogram(s.id)}
            </span>
          )}
        </div>

        {s.description ? (
          <p className="spack-cat__drawer-desc">{s.description}</p>
        ) : (
          <p className="spack-cat__drawer-desc spack-cat__muted">
            No description for this section.
          </p>
        )}

        {s.tags?.length ? (
          <div className="spack-cat__row-tags" aria-label="Tags">
            {s.tags.map((t) => (
              <button
                key={t}
                type="button"
                className="spack-cat__mini-tag"
                onClick={() => onTag(t)}
              >
                {t}
              </button>
            ))}
          </div>
        ) : null}

        <p className="spack-cat__path">
          <code>{s.componentPath}</code>
          {s.componentExport ? (
            <span className="spack-cat__muted">
              {" "}
              | export {s.componentExport}
            </span>
          ) : null}
        </p>

        <div className="spack-cat__drawer-actions">
          <button
            type="button"
            className="spack-cat__btn spack-cat__btn--primary"
            disabled={busy === `${s.id}:describe`}
            onClick={onCopyNl}
            aria-label={`Copy natural language pack for ${s.label}`}
          >
            {busy === `${s.id}:describe` ? "Copying..." : "Natural language"}
          </button>
          <button
            type="button"
            className="spack-cat__btn spack-cat__btn--primary"
            disabled={busy === `${s.id}:prompt`}
            onClick={onCopyCode}
            aria-label={`Copy code as-is pack for ${s.label}`}
          >
            {busy === `${s.id}:prompt` ? "Copying..." : "Code as-is"}
          </button>
        </div>
        <p className="spack-cat__drawer-hint">Press Esc to close</p>
      </div>
    </div>
  );
}

/** Scoped catalog styles (prefix: spack-cat-) */
function CatalogStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: CATALOG_CSS,
      }}
    />
  );
}

const CATALOG_CSS = `
.spack-cat {
  min-height: 100vh;
  background: #f8fafc;
  color: #0f172a;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.5;
}
.spack-cat__inner {
  max-width: 960px;
  margin: 0 auto;
  padding: 2.25rem 1.25rem 5rem;
}
.spack-cat__home {
  color: #4f46e5;
  font-weight: 600;
  text-decoration: none;
  font-size: 0.9rem;
}
.spack-cat__home:hover { text-decoration: underline; }
.spack-cat__header { margin-top: 0.85rem; margin-bottom: 1.25rem; }
.spack-cat__title {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0 0 0.35rem;
  letter-spacing: -0.02em;
}
.spack-cat__sub {
  color: #64748b;
  margin: 0 0 0.35rem;
  font-size: 0.95rem;
}
.spack-cat__meta {
  color: #94a3b8;
  margin: 0;
  font-size: 0.8rem;
}
.spack-cat__code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.78em;
  background: #eef2ff;
  color: #3730a3;
  padding: 0.1em 0.35em;
  border-radius: 4px;
}
.spack-cat__h2 {
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
}
.spack-cat__section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.55rem;
}
.spack-cat__muted { color: #94a3b8; font-size: 0.8rem; }
.spack-cat__recipes { margin-bottom: 1.25rem; }
.spack-cat__recipe-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}
.spack-cat__recipe {
  appearance: none;
  border: 1px solid #c7d2fe;
  background: #eef2ff;
  color: #312e81;
  border-radius: 999px;
  padding: 0.4rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
}
.spack-cat__recipe:hover {
  background: #e0e7ff;
  border-color: #a5b4fc;
}
.spack-cat__recipe.is-active {
  background: #4f46e5;
  border-color: #4338ca;
  color: #fff;
  box-shadow: 0 1px 2px rgba(79, 70, 229, 0.35);
}
.spack-cat__recipe-count {
  font-size: 0.72rem;
  font-weight: 700;
  opacity: 0.85;
  background: rgba(15, 23, 42, 0.08);
  border-radius: 999px;
  padding: 0.05rem 0.4rem;
}
.spack-cat__recipe.is-active .spack-cat__recipe-count {
  background: rgba(255, 255, 255, 0.2);
}
.spack-cat__toolbar {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 0.9rem 1rem;
  margin-bottom: 1rem;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  position: sticky;
  top: 0.5rem;
  z-index: 5;
}
.spack-cat__search-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
}
.spack-cat__search { flex: 1 1 220px; min-width: 0; }
.spack-cat__input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.55rem 0.75rem;
  font-size: 0.9rem;
  background: #f8fafc;
  color: #0f172a;
  outline: none;
}
.spack-cat__input:focus {
  border-color: #a5b4fc;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  background: #fff;
}
.spack-cat__sel-badge {
  font-size: 0.8rem;
  font-weight: 700;
  color: #4338ca;
  background: #eef2ff;
  border-radius: 999px;
  padding: 0.35rem 0.7rem;
  white-space: nowrap;
}
.spack-cat__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.spack-cat__tag-chip {
  appearance: none;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #475569;
  border-radius: 999px;
  padding: 0.25rem 0.55rem;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}
.spack-cat__tag-chip:hover { border-color: #c7d2fe; color: #3730a3; }
.spack-cat__tag-chip.is-active {
  background: #4f46e5;
  border-color: #4338ca;
  color: #fff;
}
.spack-cat__tag-n {
  opacity: 0.75;
  font-variant-numeric: tabular-nums;
}
.spack-cat__bulk {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
}
.spack-cat__bulk-sep {
  width: 1px;
  height: 1.25rem;
  background: #e2e8f0;
  margin: 0 0.15rem;
}
.spack-cat__btn {
  appearance: none;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 8px;
  padding: 0.4rem 0.65rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  color: #0f172a;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  line-height: 1.2;
}
.spack-cat__btn:hover:not(:disabled) {
  background: #fff;
  border-color: #cbd5e1;
}
.spack-cat__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.spack-cat__btn--primary {
  background: #4f46e5;
  border-color: #4338ca;
  color: #fff;
}
.spack-cat__btn--primary:hover:not(:disabled) {
  background: #4338ca;
  border-color: #3730a3;
}
.spack-cat__btn--link {
  color: #4f46e5;
  background: #eef2ff;
  border-color: #c7d2fe;
}
.spack-cat__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}
.spack-cat__card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 0.95rem 1.05rem;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.spack-cat__card.is-selected {
  border-color: #a5b4fc;
  box-shadow: 0 0 0 1px #a5b4fc, 0 1px 2px rgba(15, 23, 42, 0.04);
}
.spack-cat__card-top {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}
.spack-cat__thumb {
  appearance: none;
  border: 1px solid #e2e8f0;
  flex: 0 0 auto;
  width: 4.5rem;
  height: 3.35rem;
  border-radius: 8px;
  padding: 0;
  margin: 0;
  overflow: hidden;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e2e8f0;
  position: relative;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.04);
}
.spack-cat__thumb:hover {
  border-color: #a5b4fc;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
}
.spack-cat__thumb:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.4);
}
.spack-cat__thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.spack-cat__monogram {
  font-size: 0.85rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 1px 2px rgba(15, 23, 42, 0.25);
  user-select: none;
}
.spack-cat__label-btn {
  appearance: none;
  border: none;
  background: none;
  padding: 0;
  margin: 0;
  font: inherit;
  font-weight: 700;
  color: inherit;
  cursor: pointer;
  text-align: left;
}
.spack-cat__label-btn:hover { color: #4338ca; }
.spack-cat__label-btn:focus-visible {
  outline: 2px solid #6366f1;
  outline-offset: 2px;
  border-radius: 3px;
}
.spack-cat__check {
  flex: 0 0 auto;
  margin-top: 0.2rem;
  cursor: pointer;
  position: relative;
  width: 1.15rem;
  height: 1.15rem;
}
.spack-cat__check input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}
.spack-cat__check-box {
  display: block;
  width: 1.15rem;
  height: 1.15rem;
  border: 1.5px solid #cbd5e1;
  border-radius: 5px;
  background: #fff;
  box-sizing: border-box;
}
.spack-cat__check input:checked + .spack-cat__check-box {
  background: #4f46e5;
  border-color: #4338ca;
}
.spack-cat__check input:checked + .spack-cat__check-box::after {
  content: "";
  display: block;
  width: 0.28rem;
  height: 0.5rem;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
  margin: 0.12rem 0 0 0.35rem;
}
.spack-cat__check input:focus-visible + .spack-cat__check-box {
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.35);
}
.spack-cat__card-main { flex: 1 1 auto; min-width: 0; }
.spack-cat__title-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: baseline;
  justify-content: space-between;
}
.spack-cat__label {
  font-weight: 700;
  font-size: 1rem;
  margin: 0;
}
.spack-cat__id {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.78rem;
  color: #64748b;
}
.spack-cat__desc {
  color: #475569;
  font-size: 0.9rem;
  margin: 0.35rem 0 0.5rem;
}
.spack-cat__row-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-bottom: 0.45rem;
}
.spack-cat__mini-tag {
  appearance: none;
  border: none;
  font-size: 0.7rem;
  font-weight: 600;
  color: #4f46e5;
  background: #eef2ff;
  padding: 0.12rem 0.45rem;
  border-radius: 999px;
  cursor: pointer;
}
.spack-cat__mini-tag:hover { background: #e0e7ff; }
.spack-cat__path {
  margin: 0;
  font-size: 0.78rem;
  color: #64748b;
}
.spack-cat__path code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.78rem;
}
.spack-cat__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.75rem;
  padding-left: calc(1.15rem + 0.75rem + 4.5rem + 0.75rem);
}
.spack-cat__drawer-root {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  justify-content: flex-end;
}
.spack-cat__drawer-backdrop {
  appearance: none;
  border: none;
  padding: 0;
  margin: 0;
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  cursor: pointer;
}
.spack-cat__drawer {
  position: relative;
  z-index: 1;
  width: min(420px, 100vw);
  height: 100%;
  background: #fff;
  box-shadow: -8px 0 32px rgba(15, 23, 42, 0.18);
  padding: 1.15rem 1.2rem 2rem;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  animation: spack-cat-drawer-in 0.18s ease-out;
}
@keyframes spack-cat-drawer-in {
  from { transform: translateX(12px); opacity: 0.6; }
  to { transform: translateX(0); opacity: 1; }
}
.spack-cat__drawer-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}
.spack-cat__drawer-title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.spack-cat__drawer-id {
  margin: 0.2rem 0 0;
  font-size: 0.8rem;
  color: #64748b;
}
.spack-cat__drawer-id code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.8rem;
}
.spack-cat__drawer-visual {
  width: 100%;
  aspect-ratio: 16 / 10;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e2e8f0;
}
.spack-cat__drawer-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.spack-cat__drawer-mono {
  font-size: 2.25rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 2px 8px rgba(15, 23, 42, 0.3);
  user-select: none;
}
.spack-cat__drawer-desc {
  margin: 0;
  color: #334155;
  font-size: 0.92rem;
  line-height: 1.55;
}
.spack-cat__drawer-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.25rem;
}
.spack-cat__drawer-hint {
  margin: 0.25rem 0 0;
  font-size: 0.72rem;
  color: #94a3b8;
}
.spack-cat__empty {
  text-align: center;
  padding: 2.5rem 1rem;
  color: #64748b;
  background: #fff;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
}
.spack-cat__empty p { margin: 0 0 0.85rem; }
.spack-cat__banner {
  padding: 1rem;
  border-radius: 10px;
  margin-top: 1rem;
  font-size: 0.9rem;
}
.spack-cat__banner--err {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}
.spack-cat__toast {
  position: fixed;
  bottom: 1.25rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 50;
  max-width: min(520px, calc(100vw - 2rem));
  padding: 0.7rem 1rem;
  border-radius: 10px;
  background: #ecfdf5;
  color: #065f46;
  border: 1px solid #a7f3d0;
  font-size: 0.85rem;
  font-weight: 600;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
}
.spack-cat__toast--err {
  background: #fef2f2;
  color: #991b1b;
  border-color: #fecaca;
}
.spack-cat__skeleton { margin-top: 1rem; display: flex; flex-direction: column; gap: 0.65rem; }
.spack-cat__skel-row {
  height: 5.5rem;
  border-radius: 12px;
  background: linear-gradient(90deg, #e2e8f0 0%, #f1f5f9 50%, #e2e8f0 100%);
  background-size: 200% 100%;
  animation: spack-cat-shimmer 1.2s ease-in-out infinite;
}
@keyframes spack-cat-shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}
.spack-cat__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@media (max-width: 560px) {
  .spack-cat__actions { padding-left: 0; }
  .spack-cat__toolbar { position: static; }
  .spack-cat__drawer { width: 100vw; }
  .spack-cat__thumb { width: 3.75rem; height: 2.85rem; }
}
`;
