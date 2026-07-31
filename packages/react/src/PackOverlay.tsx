"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { cn } from "./cn";
import type {
  CopyFormat,
  PackFileTreeEntry,
  PackMeta,
  PackOverlayMeta,
} from "./types";
import { useSectionPack } from "./SectionPackProvider";

export type { PackOverlayMeta };

export type PackOverlayProps = {
  meta: PackOverlayMeta;
  active: boolean;
  pinned: boolean;
  selected?: boolean;
  onPinnedChange: (pinned: boolean) => void;
  onToggleSelect?: () => void;
  onOpenChange: (open: boolean) => void;
};

const FORMATS: { id: CopyFormat; label: string; hint: string }[] = [
  {
    id: "describe",
    label: "Natural language",
    hint: "What it is, function, motion, behavior, colors, layout, multi-file influences - no raw dump",
  },
  {
    id: "prompt",
    label: "Code as-is pack",
    hint: "Full code pack - component + content + CSS + related files for agents",
  },
  {
    id: "prompt-short",
    label: "Short code pack",
    hint: "Compact agent context - same sources, denser layout, file tree + deps",
  },
  {
    id: "cursor-rule",
    label: "Cursor rule",
    hint: ".mdc / AGENTS coding-standard fragment for reusing this section",
  },
  {
    id: "component",
    label: "Component TSX",
    hint: "Full React component source only",
  },
  {
    id: "content",
    label: "Content data",
    hint: "TypeScript content exports for this section",
  },
  {
    id: "css",
    label: "CSS extract",
    hint: "Matching rules + design tokens + shared utils + keyframes",
  },
  {
    id: "template",
    label: "Drop-in template",
    hint: "Minimal usage snippet",
  },
  {
    id: "json",
    label: "JSON pack",
    hint: "Machine-readable full pack (fileTree, byteSizes, contentHash, importGraph)",
  },
  {
    id: "zip",
    label: "Zip pack",
    hint: "Downloadable folder: README + component + content + CSS + meta + related",
  },
];

type PanelTab = "preview" | "files" | "brief";

type FileRow = {
  path: string;
  role: string;
  bytes?: number;
  content: string;
};

const COPIED_MS = 1200;

async function fetchPack(apiBase: string, id: string, format: CopyFormat) {
  if (format === "zip") {
    const res = await fetch(
      `${apiBase}?id=${encodeURIComponent(id)}&format=zip`,
      { method: "HEAD" },
    );
    if (!res.ok) {
      throw new Error(`Failed (${res.status})`);
    }
    const cd = res.headers.get("Content-Disposition") || "";
    const match = /filename="([^"]+)"/.exec(cd);
    const name = match?.[1] || `pack-${id}.zip`;
    const bytes =
      res.headers.get("X-Section-Pack-Bytes") ||
      res.headers.get("X-Slice-Bytes") ||
      "?";
    const hash =
      res.headers.get("X-Section-Pack-Content-Hash") ||
      res.headers.get("X-Slice-Content-Hash") ||
      "";
    const root =
      res.headers.get("X-Section-Pack-Zip-Root") ||
      res.headers.get("X-Slice-Zip-Root") ||
      `pack-${id}`;
    return [
      `ZIP pack ready for download.`,
      `filename: ${name}`,
      `bytes: ${bytes}`,
      hash ? `contentHash: ${hash}` : "",
      `root: ${root}`,
      "",
      "Layout: README.md, component.tsx, content.ts, styles.css, meta.json, related/",
      "Use Download / Save .zip to get application/zip.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const res = await fetch(
    `${apiBase}?id=${encodeURIComponent(id)}&format=${format}`,
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string }).error || `Failed (${res.status})`,
    );
  }
  if (format === "json") {
    return JSON.stringify(await res.json(), null, 2);
  }
  return res.text();
}

async function downloadPackZip(apiBase: string, id: string) {
  const res = await fetch(
    `${apiBase}?id=${encodeURIComponent(id)}&format=zip`,
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string }).error || `Failed (${res.status})`,
    );
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") || "";
  const match = /filename="([^"]+)"/.exec(cd);
  const name = match?.[1] || `pack-${id}.zip`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  return name;
}

function isFileTreeEntry(v: unknown): v is PackFileTreeEntry {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as PackFileTreeEntry).path === "string"
  );
}

async function fetchPackMeta(apiBase: string, id: string): Promise<PackMeta> {
  const res = await fetch(
    `${apiBase}?id=${encodeURIComponent(id)}&format=json`,
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string }).error || `Failed (${res.status})`,
    );
  }
  const pack = (await res.json()) as {
    tags?: string[];
    description?: string;
    files?: Record<string, string> | string[];
    promptMarkdown?: string;
    contentHash?: string;
    fileTree?: unknown[];
    behaviorBriefMarkdown?: string;
    component?: string;
    content?: string;
    css?: string;
    related?: Record<string, string>;
  };

  const fileTree = Array.isArray(pack.fileTree)
    ? pack.fileTree.filter(isFileTreeEntry).map((f) => ({
        path: f.path,
        role: f.role || "related",
        bytes: typeof f.bytes === "number" ? f.bytes : undefined,
      }))
    : undefined;

  const files: Record<string, string> = {};
  if (pack.files && !Array.isArray(pack.files) && typeof pack.files === "object") {
    for (const [k, v] of Object.entries(pack.files)) {
      if (typeof v === "string") files[k] = v;
    }
  }
  if (pack.related && typeof pack.related === "object") {
    for (const [k, v] of Object.entries(pack.related)) {
      if (typeof v === "string") files[k] = v;
    }
  }
  // JSON pack surfaces (format=json returns component/content/css, not full files map)
  if (fileTree?.length) {
    for (const f of fileTree) {
      if (files[f.path]) continue;
      if (f.role === "component" && typeof pack.component === "string") {
        files[f.path] = pack.component;
      } else if (f.role === "content" && typeof pack.content === "string") {
        files[f.path] = pack.content;
      } else if (f.role === "css" && typeof pack.css === "string") {
        files[f.path] = pack.css;
      }
    }
  } else {
    if (typeof pack.component === "string") {
      files["component.tsx"] = pack.component;
    }
    if (typeof pack.content === "string") {
      files["content.ts"] = pack.content;
    }
    if (typeof pack.css === "string") {
      files["styles.css"] = pack.css;
    }
  }

  return {
    tags: pack.tags ?? [],
    description: pack.description ?? "",
    files,
    promptMarkdown: pack.promptMarkdown ?? "",
    contentHash:
      typeof pack.contentHash === "string" ? pack.contentHash : undefined,
    fileTree,
    behaviorBriefMarkdown:
      typeof pack.behaviorBriefMarkdown === "string"
        ? pack.behaviorBriefMarkdown
        : undefined,
  };
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

function basename(path: string) {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) {
    const kb = n / 1024;
    return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  }
  const mb = n / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

function shortHash(hash: string | undefined): string | null {
  if (!hash) return null;
  const h = hash.trim();
  if (!h) return null;
  return h.slice(0, 8);
}

function buildFileRows(packMeta: PackMeta | null): FileRow[] {
  if (!packMeta) return [];
  if (packMeta.fileTree?.length) {
    return packMeta.fileTree.map((f) => ({
      path: f.path,
      role: f.role || "related",
      bytes: f.bytes,
      content: packMeta.files[f.path] ?? "",
    }));
  }
  return Object.entries(packMeta.files).map(([path, content]) => ({
    path,
    role: "file",
    bytes: undefined,
    content,
  }));
}

export function PackOverlay({
  meta,
  active,
  pinned,
  selected = false,
  onPinnedChange,
  onToggleSelect,
  onOpenChange,
}: PackOverlayProps) {
  const panelId = useId();
  const titleId = useId();
  const descId = useId();
  const checkId = useId();
  const { pushToast, registerActiveCopy, apiBase } = useSectionPack();

  const [open, setOpen] = useState(false);
  /** First open always starts on natural language (describe). */
  const [format, setFormat] = useState<CopyFormat>("describe");
  const [panelTab, setPanelTab] = useState<PanelTab>("brief");
  const openedOnceRef = useRef(false);
  /** Auto-select Brief when format is describe, only once per panel lifetime. */
  const briefAutoOnceRef = useRef(false);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [packMeta, setPackMeta] = useState<PackMeta | null>(null);
  const [packLoading, setPackLoading] = useState(false);
  const [chipFocused, setChipFocused] = useState(false);
  const [briefText, setBriefText] = useState("");
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [relatedOpen, setRelatedOpen] = useState(false);
  /** Which primary control shows "Copied!" (nl | agent | format | file:<path>). */
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copiedTimerRef = useRef<number | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const chipShellRef = useRef<HTMLDivElement>(null);
  const chipBtnRef = useRef<HTMLButtonElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);

  const tags = useMemo(() => {
    const base = packMeta?.tags?.length
      ? [...packMeta.tags]
      : meta.tags?.length
        ? [...meta.tags]
        : [];
    // Graph-related multi-file badge when pack spans more than 2 files
    const fileTreeLen = packMeta?.fileTree?.length ?? 0;
    if (fileTreeLen > 2 && !base.includes("multi-file")) {
      base.push("multi-file");
    }
    return base;
  }, [packMeta?.tags, packMeta?.fileTree, meta.tags]);

  const hash8 = shortHash(packMeta?.contentHash);

  const flashCopied = useCallback((key: string) => {
    if (copiedTimerRef.current != null) {
      window.clearTimeout(copiedTimerRef.current);
    }
    setCopiedKey(key);
    copiedTimerRef.current = window.setTimeout(() => {
      setCopiedKey(null);
      copiedTimerRef.current = null;
    }, COPIED_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current != null) {
        window.clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  const setOpenSafe = useCallback(
    (v: boolean) => {
      if (v && !openedOnceRef.current) {
        openedOnceRef.current = true;
        setFormat("describe");
        // format is describe on first open: auto-select Brief once
        briefAutoOnceRef.current = true;
        setPanelTab("brief");
      }
      setOpen(v);
      onOpenChange(v);
      if (!v) onPinnedChange(false);
    },
    [onOpenChange, onPinnedChange],
  );

  const selectFormat = useCallback((next: CopyFormat) => {
    setFormat(next);
    if (next === "describe") {
      // Auto-select Brief only once when format is describe
      if (!briefAutoOnceRef.current) {
        briefAutoOnceRef.current = true;
        setPanelTab("brief");
      }
    } else {
      setPanelTab("preview");
    }
  }, []);

  useEffect(() => {
    if (!active && !open) return;
    if (packMeta) return;
    let cancelled = false;
    setPackLoading(true);
    fetchPackMeta(apiBase, meta.id)
      .then((data) => {
        if (!cancelled) setPackMeta(data);
      })
      .catch(() => {
        /* tags optional */
      })
      .finally(() => {
        if (!cancelled) setPackLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, open, meta.id, packMeta, apiBase]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPack(apiBase, meta.id, format)
      .then((text) => {
        if (!cancelled) setPreview(text);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, meta.id, format, apiBase]);

  // Brief tab always shows natural language (describe) text
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const fromMeta = packMeta?.behaviorBriefMarkdown;
    if (fromMeta) {
      setBriefText(fromMeta);
      setBriefError(null);
      setBriefLoading(false);
      return;
    }
    setBriefLoading(true);
    setBriefError(null);
    fetchPack(apiBase, meta.id, "describe")
      .then((text) => {
        if (!cancelled) setBriefText(text);
      })
      .catch((e: Error) => {
        if (!cancelled) setBriefError(e.message);
      })
      .finally(() => {
        if (!cancelled) setBriefLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, meta.id, apiBase, packMeta?.behaviorBriefMarkdown]);

  const handleCopy = useCallback(async () => {
    if (format === "zip") {
      try {
        const name = await downloadPackZip(apiBase, meta.id);
        pushToast(`Downloaded ${name}`, "ok");
        flashCopied("format");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Download failed";
        setError(msg);
        pushToast(msg, "err");
      }
      return;
    }
    try {
      const text = preview || (await fetchPack(apiBase, meta.id, format));
      await copyText(text);
      flashCopied("format");
      pushToast(`Copied ${format} - ${meta.id}`, "ok");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Copy failed";
      setError(msg);
      pushToast(msg, "err");
    }
  }, [preview, meta.id, format, pushToast, apiBase, flashCopied]);

  const handleCopyNl = useCallback(async () => {
    try {
      const text =
        briefText ||
        packMeta?.behaviorBriefMarkdown ||
        (await fetchPack(apiBase, meta.id, "describe"));
      setFormat("describe");
      setBriefText(text);
      setPreview(text);
      await copyText(text);
      flashCopied("nl");
      pushToast(`Copied natural language brief - ${meta.id}`, "ok");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Copy failed", "err");
    }
  }, [briefText, packMeta, meta.id, pushToast, apiBase, flashCopied]);

  const handleCopyAgent = useCallback(async () => {
    try {
      const text =
        packMeta?.promptMarkdown ||
        (await fetchPack(apiBase, meta.id, "prompt"));
      await copyText(text);
      setFormat("prompt");
      setPanelTab("preview");
      flashCopied("agent");
      pushToast(`Copied agent pack - ${meta.id}`, "ok");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Copy failed";
      pushToast(msg, "err");
    }
  }, [packMeta, meta.id, pushToast, apiBase, flashCopied]);

  const handleCopyFile = useCallback(
    async (path: string, content: string) => {
      if (!content) {
        pushToast(`No source loaded for ${basename(path)}`, "info");
        return;
      }
      try {
        await copyText(content);
        flashCopied(`file:${path}`);
        pushToast(`Copied ${basename(path)}`, "ok");
      } catch {
        pushToast(`Failed to copy ${basename(path)}`, "err");
      }
    },
    [pushToast, flashCopied],
  );

  const handleDownload = useCallback(async () => {
    try {
      if (format === "zip") {
        const name = await downloadPackZip(apiBase, meta.id);
        pushToast(`Downloaded ${name}`, "ok");
        return;
      }
      const text = preview || (await fetchPack(apiBase, meta.id, format));
      const ext =
        format === "css"
          ? "css"
          : format === "json"
            ? "json"
            : format === "prompt" ||
                format === "prompt-short" ||
                format === "describe" ||
                format === "cursor-rule"
              ? "md"
              : "tsx";
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pack-${meta.id}-${format}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      pushToast(`Downloaded pack-${meta.id}-${format}.${ext}`, "ok");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Download failed";
      setError(msg);
      pushToast(msg, "err");
    }
  }, [preview, meta.id, format, pushToast, apiBase]);

  useEffect(() => {
    if (!open) return;
    registerActiveCopy(handleCopy);
    return () => registerActiveCopy(null);
  }, [open, handleCopy, registerActiveCopy]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setOpenSafe(false);
        chipBtnRef.current?.focus();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const list = Array.from(focusables);
      const first = list[0];
      const last = list[list.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (activeEl === first || !panelRef.current.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else if (activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const onPointer = (e: MouseEvent) => {
      if (pinned) return;
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (chipShellRef.current?.contains(t)) return;
      setOpenSafe(false);
    };

    window.addEventListener("keydown", onKey, true);
    const tid = window.setTimeout(() => {
      document.addEventListener("mousedown", onPointer);
    }, 0);

    window.requestAnimationFrame(() => {
      firstFocusRef.current?.focus();
    });

    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onPointer);
      window.clearTimeout(tid);
    };
  }, [open, pinned, setOpenSafe]);

  const onChipKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpenSafe(!open);
    }
  };

  const fileRows = useMemo(() => buildFileRows(packMeta), [packMeta]);
  const mainFiles = useMemo(
    () => fileRows.filter((f) => f.role !== "related"),
    [fileRows],
  );
  const relatedFiles = useMemo(
    () => fileRows.filter((f) => f.role === "related"),
    [fileRows],
  );

  const showChip = active || open || pinned || selected || chipFocused;

  const renderFileRow = (row: FileRow) => {
    const sizeLabel =
      typeof row.bytes === "number"
        ? formatBytes(row.bytes)
        : row.content
          ? `${row.content.length.toLocaleString()} chars`
          : "";
    const canCopy = Boolean(row.content);
    const isCopied = copiedKey === `file:${row.path}`;
    return (
      <div key={row.path} className="spack-panel__file" role="listitem">
        <div className="spack-panel__file-meta">
          <span className="spack-panel__file-name">{basename(row.path)}</span>
          <span className="spack-panel__file-path" title={row.path}>
            {row.path}
          </span>
          {sizeLabel ? (
            <span className="spack-panel__file-size">{sizeLabel}</span>
          ) : null}
        </div>
        <button
          type="button"
          className={cn(
            "spack-panel__file-copy",
            isCopied && "is-copied",
          )}
          disabled={!canCopy}
          title={canCopy ? `Copy ${basename(row.path)}` : "Source not in pack JSON"}
          onClick={() => void handleCopyFile(row.path, row.content)}
        >
          {isCopied ? "Copied!" : "Copy"}
        </button>
      </div>
    );
  };

  return (
    <>
      <div
        className={cn(
          "spack-chip",
          showChip && "is-active",
          open && "is-open",
          pinned && "is-pinned",
          selected && "is-selected",
        )}
      >
        <div className="spack-chip__shell" ref={chipShellRef}>
          {onToggleSelect ? (
            <label
              className="spack-chip__check"
              title={
                selected
                  ? `Deselect ${meta.id} (or Alt+click chip)`
                  : `Select ${meta.id} (or Alt+click chip)`
              }
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <input
                id={checkId}
                type="checkbox"
                className="spack-chip__checkbox"
                checked={selected}
                onChange={() => onToggleSelect()}
                aria-label={
                  selected
                    ? `Deselect section ${meta.label}`
                    : `Select section ${meta.label}`
                }
              />
              <span className="spack-chip__check-box" aria-hidden="true" />
            </label>
          ) : null}
          <button
            ref={chipBtnRef}
            type="button"
            className="spack-chip__btn"
            aria-expanded={open}
            aria-controls={panelId}
            aria-haspopup="dialog"
            aria-pressed={selected || undefined}
            title={`${meta.label} SectionPack - open copy tools (Alt+click to ${selected ? "deselect" : "select"})`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.altKey && onToggleSelect) {
                onToggleSelect();
                return;
              }
              setOpenSafe(!open);
            }}
            onKeyDown={onChipKeyDown}
            onFocus={() => setChipFocused(true)}
            onBlur={() => setChipFocused(false)}
          >
            <span className="spack-chip__glyph" aria-hidden="true">
              ▦
            </span>
            <span className="spack-chip__text">
              <span className="spack-chip__row">
                <span className="spack-chip__id">{meta.id}</span>
                <span className="spack-chip__label">{meta.label}</span>
              </span>
              {tags.length > 0 ? (
                <span className="spack-chip__tags" aria-label="Tags">
                  {tags.map((t) => (
                    <span key={t} className="spack-chip__tag">
                      {t}
                    </span>
                  ))}
                </span>
              ) : packLoading ? (
                <span className="spack-chip__tags spack-chip__tags--muted">
                  loading tags...
                </span>
              ) : null}
            </span>
            <span className="spack-chip__hint">
              {selected ? "sel" : "pack"}
            </span>
          </button>
        </div>
      </div>

      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          className={cn("spack-panel", pinned && "is-pinned")}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          onClick={(e) => e.stopPropagation()}
        >
          <header className="spack-panel__head">
            <div className="spack-panel__head-main">
              <p className="spack-panel__kicker">
                SectionPack
                {hash8 ? (
                  <span
                    className="spack-panel__hash"
                    title={
                      packMeta?.contentHash
                        ? `contentHash ${packMeta.contentHash}`
                        : undefined
                    }
                  >
                    {hash8}
                  </span>
                ) : null}
              </p>
              <h3 className="spack-panel__title" id={titleId}>
                {meta.label}{" "}
                <code className="spack-panel__code">{meta.id}</code>
              </h3>
              <p className="spack-panel__meta" id={descId}>
                {meta.component}
                {packMeta?.description || meta.description
                  ? ` - ${packMeta?.description || meta.description}`
                  : ""}
              </p>
              {tags.length > 0 ? (
                <div className="spack-panel__tags">
                  {tags.map((t) => (
                    <span key={t} className="spack-panel__tag">
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="spack-panel__head-actions">
              <button
                ref={firstFocusRef}
                type="button"
                className={cn("spack-panel__pin", pinned && "is-active")}
                aria-pressed={pinned}
                title={
                  pinned
                    ? "Unpin panel (hover can close)"
                    : "Pin panel open while reading"
                }
                onClick={() => onPinnedChange(!pinned)}
              >
                {pinned ? "Pinned" : "Pin"}
              </button>
              <button
                type="button"
                className="spack-panel__close"
                onClick={() => setOpenSafe(false)}
                aria-label="Close SectionPack panel"
              >
                ×
              </button>
            </div>
          </header>

          <div
            className="spack-panel__formats"
            role="tablist"
            aria-label="Export format"
          >
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={format === f.id}
                id={`${panelId}-fmt-${f.id}`}
                className={cn(
                  "spack-panel__format",
                  format === f.id && "is-active",
                )}
                title={f.hint}
                onClick={() => selectFormat(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div
            className="spack-panel__subtabs"
            role="tablist"
            aria-label="Panel view"
          >
            <button
              type="button"
              role="tab"
              aria-selected={panelTab === "preview"}
              className={cn(
                "spack-panel__subtab",
                panelTab === "preview" && "is-active",
              )}
              onClick={() => setPanelTab("preview")}
            >
              Preview
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={panelTab === "files"}
              className={cn(
                "spack-panel__subtab",
                panelTab === "files" && "is-active",
              )}
              onClick={() => setPanelTab("files")}
            >
              Files{fileRows.length ? ` (${fileRows.length})` : ""}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={panelTab === "brief"}
              className={cn(
                "spack-panel__subtab",
                panelTab === "brief" && "is-active",
              )}
              onClick={() => setPanelTab("brief")}
            >
              Brief
            </button>
          </div>

          <p className="spack-panel__hint">
            {panelTab === "brief"
              ? "Natural language brief: function, motion, behavior, colors, layout, multi-file influences"
              : FORMATS.find((f) => f.id === format)?.hint}
          </p>
          <p className="spack-panel__keys" aria-label="Keyboard shortcuts">
            <span>
              <kbd>Esc</kbd> close
            </span>
            <span>
              <kbd>Ctrl/Cmd</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> copy
            </span>
            <span>
              <kbd>Ctrl/Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> packs toggle
            </span>
          </p>

          {panelTab === "preview" ? (
            <div className="spack-panel__preview-wrap">
              {loading ? (
                <div className="spack-panel__loading">Loading section pack...</div>
              ) : error ? (
                <div className="spack-panel__error" role="alert">
                  {error}
                </div>
              ) : (
                <textarea
                  className="spack-panel__preview"
                  readOnly
                  value={preview}
                  spellCheck={false}
                  aria-label={`${format} preview for ${meta.id}`}
                  onFocus={(e) => e.currentTarget.select()}
                />
              )}
            </div>
          ) : panelTab === "brief" ? (
            <div className="spack-panel__preview-wrap">
              {briefLoading ? (
                <div className="spack-panel__loading">Loading brief...</div>
              ) : briefError ? (
                <div className="spack-panel__error" role="alert">
                  {briefError}
                </div>
              ) : (
                <textarea
                  className="spack-panel__preview"
                  readOnly
                  value={briefText}
                  spellCheck={false}
                  aria-label={`Natural language brief for ${meta.id}`}
                  onFocus={(e) => e.currentTarget.select()}
                />
              )}
            </div>
          ) : (
            <div className="spack-panel__files" role="list">
              {packLoading && !fileRows.length ? (
                <div className="spack-panel__loading">Loading files...</div>
              ) : fileRows.length === 0 ? (
                <div className="spack-panel__empty">No files in pack yet</div>
              ) : (
                <>
                  {mainFiles.map(renderFileRow)}
                  {relatedFiles.length > 0 ? (
                    <div className="spack-panel__related">
                      <button
                        type="button"
                        className={cn(
                          "spack-panel__related-toggle",
                          relatedOpen && "is-open",
                        )}
                        aria-expanded={relatedOpen}
                        onClick={() => setRelatedOpen((v) => !v)}
                      >
                        <span className="spack-panel__related-chevron" aria-hidden="true">
                          {relatedOpen ? "▼" : "▶"}
                        </span>
                        Related files ({relatedFiles.length})
                      </button>
                      {relatedOpen ? (
                        <div className="spack-panel__related-list" role="group">
                          {relatedFiles.map(renderFileRow)}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          )}

          <footer className="spack-panel__actions">
            <div
              className="spack-panel__actions-primary"
              role="group"
              aria-label="Primary copy actions"
            >
              <button
                type="button"
                className={cn(
                  "spack-panel__primary",
                  copiedKey === "nl" && "is-copied",
                )}
                title="Natural language: function, motion, behavior, colors, layout, multi-file influences"
                onClick={() => void handleCopyNl()}
                disabled={loading && !briefText && !packMeta?.behaviorBriefMarkdown}
              >
                {copiedKey === "nl" ? "Copied!" : "Natural language"}
              </button>
              <button
                type="button"
                className={cn(
                  "spack-panel__primary",
                  "spack-panel__primary--alt",
                  copiedKey === "agent" && "is-copied",
                )}
                title="Code as-is: full component + content + CSS + related files"
                onClick={() => void handleCopyAgent()}
                disabled={loading && !packMeta?.promptMarkdown}
              >
                {copiedKey === "agent" ? "Copied!" : "Code as-is"}
              </button>
            </div>
            <button
              type="button"
              className={cn(
                "spack-panel__secondary",
                copiedKey === "format" && "is-copied",
              )}
              onClick={() => void handleCopy()}
              disabled={loading || !!error}
            >
              {copiedKey === "format"
                ? "Copied!"
                : format === "zip"
                  ? "Download zip"
                  : `Copy ${format}`}
            </button>
            <button
              type="button"
              className="spack-panel__secondary"
              onClick={() => void handleDownload()}
              disabled={loading || !!error}
            >
              {format === "zip" ? "Save .zip" : "Download"}
            </button>
            <a
              className="spack-panel__secondary"
              href={
                format === "zip"
                  ? `${apiBase}?id=${encodeURIComponent(meta.id)}&format=zip`
                  : `${apiBase}?id=${encodeURIComponent(meta.id)}&format=${format === "describe" ? "describe" : "prompt"}`
              }
              target="_blank"
              rel="noreferrer"
            >
              {format === "zip" ? "Open zip" : "Open pack"}
            </a>
          </footer>
        </div>
      ) : null}
    </>
  );
}
