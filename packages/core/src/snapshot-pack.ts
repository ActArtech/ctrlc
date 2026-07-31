/**
 * Lightweight SectionPack snapshots and source drift checks (CI-friendly).
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type {
  PackByteSizes,
  SectionPack,
  SectionPackEntry,
} from "./types";
import {
  extractContentKeys,
  extractCssBySelectors,
  hashPackSurfaces,
  SHARED_UTIL_SELECTORS,
} from "./build-section-pack";
import {
  listEntrySourcePaths,
  packSourceMtimeKey,
} from "./pack-cache";

/**
 * JSON-serializable pack fingerprint for CI drift detection / catalogs.
 * Omits full source surfaces (component/content/css) to stay small.
 */
export type SectionPackSnapshot = {
  id: string;
  contentHash: string;
  generatedAt: string;
  byteSizes: PackByteSizes;
  tags: string[];
};

/**
 * Capture a lightweight snapshot from an assembled SectionPack.
 */
export function snapshotSectionPack(pack: SectionPack): SectionPackSnapshot {
  return {
    id: pack.id,
    contentHash: pack.contentHash,
    generatedAt: pack.generatedAt,
    byteSizes: {
      component: pack.byteSizes.component,
      content: pack.byteSizes.content,
      css: pack.byteSizes.css,
      related: pack.byteSizes.related,
      prompt: pack.byteSizes.prompt,
      promptShort: pack.byteSizes.promptShort,
      totalFiles: pack.byteSizes.totalFiles,
      files: { ...pack.byteSizes.files },
    },
    tags: [...pack.tags],
  };
}

export type CompareSectionSourcesOptions = {
  /** Project root for filesystem reads (default: process.cwd()) */
  cwd?: string;
  /**
   * Prior contentHash (sha256 of component + content + css surfaces).
   * When set, hashChanged / changed reflect comparison to this value.
   */
  previousHash?: string;
  /**
   * Prior packSourceMtimeKey string. When set, mtimeChanged reflects comparison.
   */
  previousMtimeKey?: string;
  /** Match buildSectionPack shared util CSS inclusion (default SHARED_UTIL_SELECTORS). */
  sharedUtilSelectors?: readonly string[];
};

export type CompareSectionSourcesResult = {
  id: string;
  /** Current surface contentHash (same algorithm as buildSectionPack). */
  contentHash: string;
  previousHash: string | null;
  /** True when previousHash was provided and differs from contentHash. */
  hashChanged: boolean;
  /** Current packSourceMtimeKey. */
  mtimeKey: string;
  previousMtimeKey: string | null;
  /** True when previousMtimeKey was provided and differs from mtimeKey. */
  mtimeChanged: boolean;
  /**
   * True when any provided baseline (hash and/or mtime key) differs.
   * False when no baseline was given (report-only mode).
   */
  changed: boolean;
  /** mtimeMs per source path; null when missing or unreadable. */
  mtimes: Record<string, number | null>;
  missingPaths: string[];
  summary: string;
};

function safeRead(cwd: string, rel: string): string | null {
  const abs = join(cwd, rel);
  if (!existsSync(abs)) return null;
  try {
    return readFileSync(abs, "utf8");
  } catch {
    return null;
  }
}

function safeMtime(cwd: string, rel: string): number | null {
  const abs = join(cwd, rel);
  try {
    if (!existsSync(abs)) return null;
    return statSync(abs).mtimeMs;
  } catch {
    return null;
  }
}

/**
 * Read entry sources and compute current contentHash + mtime key without a full pack build.
 * Useful for CLI / CI: pass previousHash (or previousMtimeKey) to detect drift.
 */
export function compareSectionSources(
  entry: SectionPackEntry,
  options?: CompareSectionSourcesOptions,
): CompareSectionSourcesResult {
  const cwd = options?.cwd ?? process.cwd();
  const sharedUtilSelectors =
    options?.sharedUtilSelectors ?? SHARED_UTIL_SELECTORS;

  const sourcePaths = listEntrySourcePaths(entry);
  const mtimes: Record<string, number | null> = {};
  const missingPaths: string[] = [];
  for (const rel of sourcePaths) {
    const m = safeMtime(cwd, rel);
    mtimes[rel] = m;
    if (m === null) missingPaths.push(rel);
  }

  const component =
    safeRead(cwd, entry.componentPath) ?? `// missing ${entry.componentPath}`;

  let content = "// no content module\n";
  if (entry.contentModulePath) {
    const mod = safeRead(cwd, entry.contentModulePath) ?? "";
    content =
      entry.contentKeys.length > 0
        ? extractContentKeys(mod, entry.contentKeys)
        : mod;
  }

  const cssFull = safeRead(cwd, entry.cssModulePath) ?? "";
  const css = extractCssBySelectors(cssFull, entry.cssSelectors, {
    extraScanText: `${component}\n${content}`,
    sharedUtilSelectors,
  });

  const contentHash = hashPackSurfaces(component, content, css);
  const mtimeKey = packSourceMtimeKey(entry, cwd);

  const previousHash =
    typeof options?.previousHash === "string" ? options.previousHash : null;
  const previousMtimeKey =
    typeof options?.previousMtimeKey === "string"
      ? options.previousMtimeKey
      : null;

  const hashChanged =
    previousHash !== null ? previousHash !== contentHash : false;
  const mtimeChanged =
    previousMtimeKey !== null ? previousMtimeKey !== mtimeKey : false;

  const hasBaseline = previousHash !== null || previousMtimeKey !== null;
  const changed = hasBaseline ? hashChanged || mtimeChanged : false;

  let summary: string;
  if (!hasBaseline) {
    summary = `Section \`${entry.id}\` contentHash=${contentHash.slice(0, 12)}... (no baseline)`;
  } else if (!changed) {
    summary = `Section \`${entry.id}\`: sources unchanged`;
  } else {
    const bits: string[] = [];
    if (hashChanged) bits.push("contentHash");
    if (mtimeChanged) bits.push("mtime");
    summary = `Section \`${entry.id}\` changed: ${bits.join(", ")}`;
  }

  if (missingPaths.length) {
    summary += ` (${missingPaths.length} missing path(s))`;
  }

  return {
    id: entry.id,
    contentHash,
    previousHash,
    hashChanged,
    mtimeKey,
    previousMtimeKey,
    mtimeChanged,
    changed,
    mtimes,
    missingPaths,
    summary,
  };
}
