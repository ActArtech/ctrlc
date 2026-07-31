"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_PACK_CATALOG_PATH,
  DEFAULT_SECTION_PACK_API,
  type MultiCopyFormat,
  type PackListItem,
  type PackRecipe,
  type PackToast,
} from "./types";
import { useSectionPackMode } from "./useSectionPackMode";

type ActiveCopyHandler = (() => void | Promise<void>) | null;

export type SectionPackContextValue = {
  enabled: boolean;
  ready: boolean;
  toggle: () => void;
  setMode: (v: boolean) => void;
  packs: PackListItem[];
  /** Alias of packs for hosts that prefer "sections" naming */
  sections: PackListItem[];
  /** Recipe presets from list=1 when the API provides them */
  recipes: PackRecipe[];
  packsLoading: boolean;
  sectionsLoading: boolean;
  pushToast: (message: string, tone?: PackToast["tone"]) => void;
  registerActiveCopy: (fn: ActiveCopyHandler) => void;
  navOpen: boolean;
  setNavOpen: (v: boolean) => void;
  selectedIds: string[];
  isSelected: (id: string) => boolean;
  toggleSelected: (id: string) => void;
  setSelected: (ids: string[]) => void;
  selectAllVisible: () => void;
  clearSelection: () => void;
  applyRecipe: (recipeId: string) => void;
  focusedPackId: string | null;
  apiBase: string;
  catalogPath: string;
  catalogHref: string;
};

const SectionPackContext = createContext<SectionPackContextValue | null>(null);

let toastSeq = 0;

const PACK_HUD_COLLAPSED_KEY = "ctrlc:pack-hud-collapsed";

function readHudCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PACK_HUD_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeHudCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem(
      PACK_HUD_COLLAPSED_KEY,
      collapsed ? "1" : "0",
    );
  } catch {
    /* ignore quota / private mode */
  }
}

/** Prefer a short human label from ok toast messages for the Pack HUD. */
function extractLastCopiedLabel(message: string): string | null {
  const m = message.trim();
  if (!m) return null;
  if (/^copied\b/i.test(m) || /^downloaded\b/i.test(m)) return m;
  return null;
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (t.isContentEditable) return true;
  return Boolean(t.closest("[contenteditable='true']"));
}

function queryVisiblePackIds(): string[] {
  const nodes = document.querySelectorAll<HTMLElement>("[data-section-pack]");
  const ids: string[] = [];
  const seen = new Set<string>();
  nodes.forEach((el) => {
    const id = el.getAttribute("data-section-pack");
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  });
  return ids;
}

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

function multiPackUrl(apiBase: string, ids: string[], format: MultiCopyFormat) {
  return `${apiBase}?ids=${ids.map(encodeURIComponent).join(",")}&format=${format}`;
}

function joinMultiPacks(
  parts: { id: string; text: string }[],
  format: MultiCopyFormat,
): string {
  const title =
    format === "describe"
      ? "Multi-pack natural language briefs"
      : format === "prompt-short"
        ? "Multi-pack short code packs"
        : "Multi-pack code packs (as-is)";
  const header = [
    `# ${title}`,
    "",
    `Packs (${parts.length}): ${parts.map((p) => p.id).join(", ")}`,
    "",
    "---",
    "",
  ].join("\n");

  const body = parts
    .map((p, i) => {
      const heading = `## [${i + 1}/${parts.length}] ${p.id} (\`${p.id}\`)`;
      return `${heading}\n\n${p.text.trim()}\n`;
    })
    .join("\n---\n\n");

  return `${header}${body}`;
}

async function fetchMultiPack(
  apiBase: string,
  ids: string[],
  format: MultiCopyFormat,
): Promise<{ text: string; source: "multi-api" | "client-concat" }> {
  if (ids.length === 0) throw new Error("No packs selected");

  if (ids.length === 1) {
    const res = await fetch(
      `${apiBase}?id=${encodeURIComponent(ids[0])}&format=${format}`,
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        (body as { error?: string }).error || `Fetch failed (${res.status})`,
      );
    }
    return { text: await res.text(), source: "multi-api" };
  }

  try {
    const res = await fetch(multiPackUrl(apiBase, ids, format));
    if (res.ok) {
      const ct = res.headers.get("Content-Type") || "";
      if (
        ct.includes("text/plain") ||
        ct.includes("text/markdown") ||
        !ct.includes("json")
      ) {
        const text = await res.text();
        if (!(text.trimStart().startsWith("{") && text.includes('"error"'))) {
          return { text, source: "multi-api" };
        }
      }
    }
  } catch {
    /* client concat */
  }

  const parts: { id: string; text: string }[] = [];
  for (const id of ids) {
    const res = await fetch(
      `${apiBase}?id=${encodeURIComponent(id)}&format=${format}`,
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        (body as { error?: string }).error ||
          `Fetch failed (${res.status}) for ${id}`,
      );
    }
    parts.push({ id, text: await res.text() });
  }
  return { text: joinMultiPacks(parts, format), source: "client-concat" };
}

export type SectionPackProviderProps = {
  children: ReactNode;
  /** SectionPack API base path. Default: /api/dev/section-pack */
  apiBase?: string;
  /** Catalog page path. Default: /dev/packs */
  catalogPath?: string;
  /** Alias of catalogPath for hosts using catalogHref naming */
  catalogHref?: string;
  /** Default inspector on when no localStorage / query. Default true */
  defaultEnabled?: boolean;
  /** Hide fixed dock (master toggle + navigator). Default false */
  hideDock?: boolean;
  /** Alias of !hideDock */
  showChrome?: boolean;
};

export function SectionPackProvider({
  children,
  apiBase = DEFAULT_SECTION_PACK_API,
  catalogPath,
  catalogHref: catalogHrefProp,
  defaultEnabled = true,
  hideDock,
  showChrome,
}: SectionPackProviderProps) {
  const catalogPathResolved =
    catalogPath ?? catalogHrefProp ?? DEFAULT_PACK_CATALOG_PATH;
  const showDock =
    hideDock === true ? false : showChrome === false ? false : true;

  const mode = useSectionPackMode(defaultEnabled);
  const [packs, setPacks] = useState<PackListItem[]>([]);
  const [recipes, setRecipes] = useState<PackRecipe[]>([]);
  const [packsLoading, setPacksLoading] = useState(false);
  const [packsLoadError, setPacksLoadError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<PackToast[]>([]);
  const [navOpen, setNavOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [focusedPackId, setFocusedPackId] = useState<string | null>(null);
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(null);
  const [multiFormats, setMultiFormats] = useState<string[]>([
    "prompt",
    "prompt-short",
    "json",
    "zip",
  ]);
  const [trayBusy, setTrayBusy] = useState(false);
  const [lastCopiedLabel, setLastCopiedLabel] = useState<string | null>(null);
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [hudReady, setHudReady] = useState(false);
  const activeCopyRef = useRef<ActiveCopyHandler>(null);
  const fetchedRef = useRef(false);
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const apiBaseRef = useRef(apiBase);
  apiBaseRef.current = apiBase;

  // Hydrate HUD collapse from localStorage after mount (SSR-safe)
  useEffect(() => {
    setHudCollapsed(readHudCollapsed());
    setHudReady(true);
  }, []);

  const toggleHudCollapsed = useCallback(() => {
    setHudCollapsed((prev) => {
      const next = !prev;
      writeHudCollapsed(next);
      return next;
    });
  }, []);

  const pushToast = useCallback(
    (message: string, tone: PackToast["tone"] = "ok") => {
      const id = ++toastSeq;
      setToasts((prev) => [...prev.slice(-4), { id, message, tone }]);
      if (tone === "ok") {
        const label = extractLastCopiedLabel(message);
        if (label) setLastCopiedLabel(label);
      }
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2600);
    },
    [],
  );

  const registerActiveCopy = useCallback((fn: ActiveCopyHandler) => {
    activeCopyRef.current = fn;
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.includes(id),
    [selectedIds],
  );

  const toggleSelected = useCallback((id: string) => {
    setActiveRecipeId(null);
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  }, []);

  const setSelected = useCallback((ids: string[]) => {
    const seen = new Set<string>();
    const next: string[] = [];
    for (const id of ids) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      next.push(id);
    }
    setActiveRecipeId(null);
    setSelectedIds(next);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    setActiveRecipeId(null);
  }, []);

  const selectAllVisible = useCallback(() => {
    const ids = queryVisiblePackIds();
    if (ids.length === 0) {
      pushToast("No section boundaries on this page", "info");
      return;
    }
    setSelectedIds(ids);
    setActiveRecipeId(null);
    pushToast(
      `Selected ${ids.length} pack${ids.length === 1 ? "" : "s"}`,
      "ok",
    );
  }, [pushToast]);

  const applyRecipe = useCallback(
    (recipeId: string) => {
      const recipe = recipes.find((r) => r.id === recipeId);
      if (!recipe) {
        pushToast(`Unknown recipe "${recipeId}"`, "info");
        return;
      }
      const ids = recipe.sectionIds.filter(Boolean);
      if (ids.length === 0) {
        pushToast(`Recipe "${recipe.label}" has no sections`, "info");
        return;
      }
      setSelectedIds(ids);
      setActiveRecipeId(recipe.id);
      pushToast(
        `Recipe "${recipe.label}" (${ids.length} pack${ids.length === 1 ? "" : "s"})`,
        "ok",
      );
    },
    [recipes, pushToast],
  );

  const flashBoundary = useCallback((id: string) => {
    const el = document.querySelector<HTMLElement>(
      `[data-section-pack="${CSS.escape(id)}"]`,
    );
    if (!el) return null;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("is-nav-flash");
    window.setTimeout(() => el.classList.remove("is-nav-flash"), 1200);
    return el;
  }, []);

  const cycleFocus = useCallback(
    (dir: 1 | -1) => {
      const ids = queryVisiblePackIds();
      if (ids.length === 0) {
        pushToast("No section boundaries on this page", "info");
        return;
      }
      setFocusedPackId((prev) => {
        const cur = prev ? ids.indexOf(prev) : -1;
        let nextIdx: number;
        if (cur < 0) {
          nextIdx = dir === 1 ? 0 : ids.length - 1;
        } else {
          nextIdx = (cur + dir + ids.length) % ids.length;
        }
        const nextId = ids[nextIdx];
        flashBoundary(nextId);
        return nextId;
      });
    },
    [flashBoundary, pushToast],
  );

  useEffect(() => {
    if (!mode.enabled || !mode.ready) {
      if (!mode.enabled) {
        setNavOpen(false);
        setSelectedIds([]);
        setFocusedPackId(null);
        setActiveRecipeId(null);
        setPacksLoadError(null);
        setRecipes([]);
        fetchedRef.current = false;
      }
      return;
    }
    if (fetchedRef.current) return;
    let cancelled = false;
    setPacksLoading(true);
    setPacksLoadError(null);
    fetch(`${apiBase}?list=1`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`List failed (${res.status})`);
        return res.json() as Promise<{
          packs?: PackListItem[];
          sections?: PackListItem[];
          slices?: PackListItem[];
          multiFormats?: string[];
          recipes?: PackRecipe[];
        }>;
      })
      .then((data) => {
        if (cancelled) return;
        setPacks(data.packs ?? data.sections ?? data.slices ?? []);
        setPacksLoadError(null);
        if (Array.isArray(data.multiFormats) && data.multiFormats.length) {
          setMultiFormats(data.multiFormats);
        }
        // Recipes are optional - skip gracefully when API omits them
        if (Array.isArray(data.recipes) && data.recipes.length) {
          setRecipes(
            data.recipes
              .filter(
                (r): r is PackRecipe =>
                  !!r &&
                  typeof r.id === "string" &&
                  typeof r.label === "string" &&
                  Array.isArray(r.sectionIds),
              )
              .map((r) => ({
                id: r.id,
                label: r.label,
                description:
                  typeof r.description === "string" ? r.description : "",
                sectionIds: r.sectionIds.filter(
                  (id): id is string => typeof id === "string" && !!id,
                ),
                count:
                  typeof r.count === "number"
                    ? r.count
                    : r.sectionIds.length,
              })),
          );
        } else {
          setRecipes([]);
        }
        fetchedRef.current = true;
        setNavOpen(true);
      })
      .catch(() => {
        if (!cancelled) {
          setPacks([]);
          setRecipes([]);
          setPacksLoadError(
            "Could not load the section pack list. The API may be offline or misconfigured.",
          );
          setNavOpen(true);
          pushToast("Could not load pack list", "err");
        }
      })
      .finally(() => {
        if (!cancelled) setPacksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode.enabled, mode.ready, apiBase, pushToast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!mode.enabled) return;
      if (isTypingTarget(e.target)) return;

      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (mod && e.shiftKey && key === "c") {
        if (!activeCopyRef.current) return;
        e.preventDefault();
        void activeCopyRef.current();
        return;
      }

      if (mod && e.shiftKey && key === "a") {
        e.preventDefault();
        selectAllVisible();
        return;
      }

      if (mod && e.shiftKey && key === "d") {
        e.preventDefault();
        clearSelection();
        pushToast("Selection cleared", "info");
        return;
      }

      if (!mod && !e.altKey && e.key === "[") {
        e.preventDefault();
        cycleFocus(-1);
        return;
      }
      if (!mod && !e.altKey && e.key === "]") {
        e.preventDefault();
        cycleFocus(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    mode.enabled,
    selectAllVisible,
    clearSelection,
    cycleFocus,
    pushToast,
  ]);

  const jumpTo = useCallback(
    (id: string) => {
      const el = flashBoundary(id);
      if (!el) {
        pushToast(`Section "${id}" not on this page`, "info");
        return;
      }
      setFocusedPackId(id);
    },
    [flashBoundary, pushToast],
  );

  const copyMulti = useCallback(
    async (format: MultiCopyFormat) => {
      const ids = selectedIdsRef.current;
      if (ids.length === 0) {
        pushToast("Select at least one pack", "info");
        return;
      }
      setTrayBusy(true);
      try {
        const { text, source } = await fetchMultiPack(
          apiBaseRef.current,
          ids,
          format,
        );
        await copyText(text);
        const label =
          format === "describe"
            ? "natural language"
            : format === "prompt-short"
              ? "short code"
              : "code as-is";
        const via =
          source === "client-concat" && ids.length > 1 ? " (merged)" : "";
        pushToast(`Copied multi ${label} (${ids.length})${via}`, "ok");
      } catch (err) {
        pushToast(
          err instanceof Error ? err.message : "Multi copy failed",
          "err",
        );
      } finally {
        setTrayBusy(false);
      }
    },
    [pushToast],
  );

  const downloadZip = useCallback(async () => {
    const ids = selectedIdsRef.current;
    if (ids.length === 0) {
      pushToast("Select at least one pack for zip", "info");
      return;
    }
    setTrayBusy(true);
    try {
      const res = await fetch(
        `${apiBaseRef.current}?ids=${ids.map(encodeURIComponent).join(",")}&format=zip`,
      );
      if (!res.ok) {
        let detail = `Zip export unavailable (${res.status})`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body?.error) detail = body.error;
        } catch {
          /* keep status message */
        }
        throw new Error(detail);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        ids.length === 1
          ? `pack-${ids[0]}.zip`
          : `packs-${ids.slice(0, 4).join("-")}${ids.length > 4 ? `-plus${ids.length - 4}` : ""}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      pushToast(`Downloaded zip (${ids.length} packs)`, "ok");
    } catch (err) {
      pushToast(
        err instanceof Error ? err.message : "Zip download failed",
        "err",
      );
    } finally {
      setTrayBusy(false);
    }
  }, [pushToast]);

  const zipSupported =
    multiFormats.includes("zip") || multiFormats.length === 0;
  const catalogLink =
    selectedIds.length > 0
      ? `${catalogPathResolved}?selected=${selectedIds.map(encodeURIComponent).join(",")}`
      : catalogPathResolved;

  const value = useMemo<SectionPackContextValue>(
    () => ({
      enabled: mode.enabled,
      ready: mode.ready,
      toggle: mode.toggle,
      setMode: mode.setMode,
      packs,
      sections: packs,
      recipes,
      packsLoading,
      sectionsLoading: packsLoading,
      pushToast,
      registerActiveCopy,
      navOpen,
      setNavOpen,
      selectedIds,
      isSelected,
      toggleSelected,
      setSelected,
      selectAllVisible,
      clearSelection,
      applyRecipe,
      focusedPackId,
      apiBase,
      catalogPath: catalogPathResolved,
      catalogHref: catalogPathResolved,
    }),
    [
      mode.enabled,
      mode.ready,
      mode.toggle,
      mode.setMode,
      packs,
      recipes,
      packsLoading,
      pushToast,
      registerActiveCopy,
      navOpen,
      selectedIds,
      isSelected,
      toggleSelected,
      setSelected,
      selectAllVisible,
      clearSelection,
      applyRecipe,
      focusedPackId,
      apiBase,
      catalogPathResolved,
    ],
  );

  return (
    <SectionPackContext.Provider value={value}>
      {children}
      {showDock && mode.ready ? (
        <div className="spack-dock" data-spack-dock>
          {mode.enabled && navOpen ? (
            <aside className="spack-nav" aria-label="SectionPack navigator">
              <header className="spack-nav__head">
                <span className="spack-nav__title">Sections</span>
                <button
                  type="button"
                  className="spack-nav__collapse"
                  onClick={() => setNavOpen(false)}
                  aria-label="Collapse section navigator"
                >
                  -
                </button>
              </header>
              {packsLoading ? (
                <p className="spack-nav__empty">Loading sections...</p>
              ) : packsLoadError ? (
                <div className="spack-nav__empty-state" role="status">
                  <p className="spack-nav__empty-title">Packs unavailable</p>
                  <p className="spack-nav__empty-body">
                    No section list right now. Check that{" "}
                    <code className="spack-nav__code">{apiBase}</code> is
                    running, then toggle Packs off and on to retry.
                  </p>
                  <p className="spack-nav__empty-hint">
                    Boundaries on this page still work for hover copy when the
                    API serves individual packs.
                  </p>
                </div>
              ) : packs.length === 0 ? (
                <div className="spack-nav__empty-state" role="status">
                  <p className="spack-nav__empty-title">No packs yet</p>
                  <p className="spack-nav__empty-body">
                    The API returned an empty list. Add section pack entries or
                    wrap page regions with{" "}
                    <code className="spack-nav__code">SectionBoundary</code>.
                  </p>
                </div>
              ) : (
                <>
                  {recipes.length > 0 ? (
                    <div
                      className="spack-nav__recipes"
                      aria-label="Recipe quick picks"
                    >
                      <p className="spack-nav__recipes-label">Recipes</p>
                      <div className="spack-nav__recipes-chips">
                        {recipes.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            className={`spack-nav__recipe${
                              activeRecipeId === r.id ? " is-active" : ""
                            }`}
                            title={
                              r.description ||
                              `${r.label}: ${(r.sectionIds || []).join(", ")}`
                            }
                            onClick={() => applyRecipe(r.id)}
                          >
                            {r.label}
                            <span className="spack-nav__recipe-count">
                              {r.count ?? r.sectionIds.length}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <ul className="spack-nav__list">
                    {packs.map((s) => {
                      const on = selectedIds.includes(s.id);
                      return (
                        <li key={s.id}>
                          <button
                            type="button"
                            className={`spack-nav__item${on ? " is-selected" : ""}${
                              focusedPackId === s.id ? " is-focused" : ""
                            }`}
                            title={s.description}
                            onClick={() => jumpTo(s.id)}
                            aria-label={`${s.label} (${s.id})${on ? ", selected" : ""}`}
                          >
                            <span className="spack-nav__id">{s.id}</span>
                            <span className="spack-nav__label">{s.label}</span>
                            {s.tags?.length ? (
                              <span className="spack-nav__tags">
                                {s.tags.slice(0, 2).join(" / ")}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </aside>
          ) : null}

          <div className="spack-dock__bar">
            {mode.enabled &&
            !navOpen &&
            (packs.length > 0 || !!packsLoadError || !packsLoading) ? (
              <button
                type="button"
                className="spack-nav-toggle"
                onClick={() => setNavOpen(true)}
                title="Open section navigator"
                aria-label="Open section navigator"
              >
                Nav
              </button>
            ) : null}
            <button
              type="button"
              className={`spack-master ${mode.enabled ? "is-on" : ""}`}
              title="Toggle SectionPack inspector (Ctrl/Cmd+Shift+P)"
              aria-pressed={mode.enabled}
              aria-label={`SectionPack inspector ${mode.enabled ? "on" : "off"}`}
              onClick={mode.toggle}
            >
              <span className="spack-master__dot" aria-hidden="true" />
              Packs {mode.enabled ? "ON" : "OFF"}
            </button>
          </div>
        </div>
      ) : null}

      {mode.ready && mode.enabled && selectedIds.length > 0 ? (
        <div
          className="spack-tray"
          role="region"
          aria-label={`Pack selection tray, ${selectedIds.length} selected`}
        >
          <div className="spack-tray__meta">
            <strong className="spack-tray__count">{selectedIds.length}</strong>
            <span className="spack-tray__label">
              pack{selectedIds.length === 1 ? "" : "s"} selected
              {activeRecipeId
                ? ` · ${recipes.find((r) => r.id === activeRecipeId)?.label ?? activeRecipeId}`
                : ""}
            </span>
          </div>
          {recipes.length > 0 ? (
            <div
              className="spack-tray__recipes"
              role="group"
              aria-label="Recipe quick picks"
            >
              <span className="spack-tray__recipes-label">Recipes</span>
              {recipes.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`spack-tray__recipe${
                    activeRecipeId === r.id ? " is-active" : ""
                  }`}
                  disabled={trayBusy}
                  title={
                    r.description ||
                    `Select ${r.sectionIds.length} packs from ${r.label}`
                  }
                  onClick={() => applyRecipe(r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          ) : null}
          <div
            className="spack-tray__chips"
            role="list"
            aria-label="Selected section ids"
          >
            {selectedIds.map((id) => (
              <span key={id} className="spack-tray__chip" role="listitem">
                <span className="spack-tray__chip-id">{id}</span>
                <button
                  type="button"
                  className="spack-tray__chip-remove"
                  disabled={trayBusy}
                  onClick={() => {
                    setActiveRecipeId(null);
                    toggleSelected(id);
                  }}
                  aria-label={`Remove ${id} from selection`}
                  title={`Remove ${id}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="spack-tray__actions">
            <button
              type="button"
              className="spack-tray__btn spack-tray__btn--primary"
              disabled={trayBusy}
              onClick={() => void copyMulti("describe")}
              aria-label="Copy natural language for selection"
              title="Copy NL for selection: function, motion, behavior, styling, multi-file influences"
            >
              Copy NL for selection
            </button>
            <button
              type="button"
              className="spack-tray__btn spack-tray__btn--code"
              disabled={trayBusy}
              onClick={() => void copyMulti("prompt")}
              aria-label="Copy multi-pack code packs as-is"
              title="Code as-is multi pack (component + content + CSS)"
            >
              Code as-is
            </button>
            <button
              type="button"
              className="spack-tray__btn"
              disabled={trayBusy}
              onClick={() => void copyMulti("prompt-short")}
              aria-label="Copy multi-pack short code packs"
              title="Short code packs"
            >
              Short code
            </button>
            {zipSupported ? (
              <button
                type="button"
                className="spack-tray__btn"
                disabled={trayBusy}
                onClick={() => void downloadZip()}
                aria-label="Download selected packs as zip"
                title="Download zip (toast on fail)"
              >
                Zip
              </button>
            ) : null}
            <a
              className="spack-tray__btn spack-tray__btn--link"
              href={catalogLink}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open selected packs in catalog"
              title={`Open ${catalogPathResolved} with this selection`}
            >
              Catalog
            </a>
            <button
              type="button"
              className="spack-tray__btn spack-tray__btn--ghost"
              disabled={trayBusy}
              onClick={() => {
                clearSelection();
                pushToast("Selection cleared", "info");
              }}
              aria-label="Clear pack selection"
              title="Clear selection (Ctrl/Cmd+Shift+D)"
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}

      {mode.ready && mode.enabled && hudReady ? (
        <div
          className={`spack-hud${hudCollapsed ? " is-collapsed" : ""}`}
          role="region"
          aria-label="SectionPack live HUD"
          data-spack-hud
        >
          <div className="spack-hud__bar">
            <span className="spack-hud__title">Pack HUD</span>
            <button
              type="button"
              className="spack-hud__toggle"
              onClick={toggleHudCollapsed}
              aria-expanded={!hudCollapsed}
              aria-controls={hudCollapsed ? undefined : "spack-hud-body"}
              title={hudCollapsed ? "Expand Pack HUD" : "Collapse Pack HUD"}
            >
              {hudCollapsed ? "+" : "-"}
            </button>
          </div>
          {hudCollapsed ? (
            <button
              type="button"
              className="spack-hud__pill"
              onClick={toggleHudCollapsed}
              title="Expand Pack HUD"
              aria-label={`Pack HUD collapsed: ${packs.length} sections, ${selectedIds.length} selected. Expand.`}
            >
              <span className="spack-hud__pill-count">{packs.length}</span>
              <span className="spack-hud__pill-sep">/</span>
              <span className="spack-hud__pill-sel">{selectedIds.length}</span>
            </button>
          ) : (
            <div className="spack-hud__body" id="spack-hud-body">
              <dl className="spack-hud__stats">
                <div className="spack-hud__stat">
                  <dt className="spack-hud__stat-label">Sections</dt>
                  <dd className="spack-hud__stat-value">
                    {packsLoading ? "..." : packs.length}
                  </dd>
                </div>
                <div className="spack-hud__stat">
                  <dt className="spack-hud__stat-label">Selected</dt>
                  <dd className="spack-hud__stat-value">
                    {selectedIds.length}
                  </dd>
                </div>
              </dl>
              <div className="spack-hud__last">
                <span className="spack-hud__last-label">Last copy</span>
                <span
                  className="spack-hud__last-value"
                  title={lastCopiedLabel ?? undefined}
                >
                  {lastCopiedLabel ?? "None yet"}
                </span>
              </div>
              <a
                className="spack-hud__link"
                href={catalogLink}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open pack catalog (${catalogPathResolved})`}
              >
                Open catalog
              </a>
            </div>
          )}
        </div>
      ) : null}

      <div className="spack-toasts" aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`spack-toast spack-toast--${t.tone}`}
            role="status"
          >
            {t.message}
          </div>
        ))}
      </div>
    </SectionPackContext.Provider>
  );
}

const fallbackCtx: SectionPackContextValue = {
  enabled: false,
  ready: true,
  toggle: () => {},
  setMode: () => {},
  packs: [],
  sections: [],
  recipes: [],
  packsLoading: false,
  sectionsLoading: false,
  pushToast: (_m: string, _t?: PackToast["tone"]) => {},
  registerActiveCopy: (_fn: ActiveCopyHandler) => {},
  navOpen: false,
  setNavOpen: (_v: boolean) => {},
  selectedIds: [],
  isSelected: () => false,
  toggleSelected: () => {},
  setSelected: () => {},
  selectAllVisible: () => {},
  clearSelection: () => {},
  applyRecipe: (_id: string) => {},
  focusedPackId: null,
  apiBase: DEFAULT_SECTION_PACK_API,
  catalogPath: DEFAULT_PACK_CATALOG_PATH,
  catalogHref: DEFAULT_PACK_CATALOG_PATH,
};

/** Access SectionPack inspector state. Safe outside provider (no-op fallback). */
export function useSectionPack() {
  const ctx = useContext(SectionPackContext);
  return ctx ?? fallbackCtx;
}

/** Null when provider is absent (boundaries can no-op). */
export function useSectionPackOptional() {
  return useContext(SectionPackContext);
}
