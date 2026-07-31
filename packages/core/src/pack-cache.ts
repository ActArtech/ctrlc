/**
 * In-memory SectionPack cache for repeated single-section builds.
 *
 * Keys are typically id + source mtimes (cheap, no full rebuild) or
 * id + contentHash after a successful build.
 */

import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { SectionPack, SectionPackEntry } from "./types";

/** Default max entries kept in a PackCache instance. */
export const DEFAULT_PACK_CACHE_MAX = 64;

export type PackCacheOptions = {
  /** Max packs to retain (default 64). Oldest entries are evicted first. */
  maxEntries?: number;
};

/**
 * Simple LRU-style pack cache.
 *
 * - `get` / `set` / `invalidate` API
 * - max entries default 64
 * - `get` refreshes recency so hot ids stay cached
 */
export class PackCache {
  private readonly maxEntries: number;
  private readonly store = new Map<string, SectionPack>();

  constructor(options?: PackCacheOptions) {
    const n = options?.maxEntries ?? DEFAULT_PACK_CACHE_MAX;
    this.maxEntries = Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_PACK_CACHE_MAX;
  }

  get size(): number {
    return this.store.size;
  }

  get max(): number {
    return this.maxEntries;
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  get(key: string): SectionPack | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    // LRU touch: move to end
    this.store.delete(key);
    this.store.set(key, hit);
    return hit;
  }

  set(key: string, pack: SectionPack): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    }
    this.store.set(key, pack);
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  /**
   * Drop one entry, or clear the whole cache when `key` is omitted.
   */
  invalidate(key?: string): void {
    if (key === undefined) {
      this.store.clear();
      return;
    }
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  keys(): string[] {
    return [...this.store.keys()];
  }
}

/** Project-relative source paths that affect a section pack surface. */
export function listEntrySourcePaths(entry: SectionPackEntry): string[] {
  const paths = [
    entry.componentPath,
    entry.contentModulePath,
    entry.cssModulePath,
    ...(entry.relatedPaths ?? []),
  ].filter((p): p is string => Boolean(p));
  return [...new Set(paths)].sort();
}

/**
 * Cache key from section id + mtime of each source file.
 * Missing files contribute `m0` so the key changes when files appear.
 *
 * Prefer this over contentHash for pre-build lookups (no disk full-read needed).
 */
export function packSourceMtimeKey(
  entry: SectionPackEntry,
  cwd: string = process.cwd(),
): string {
  const parts: string[] = [entry.id];
  for (const rel of listEntrySourcePaths(entry)) {
    const abs = join(cwd, rel);
    let m = 0;
    try {
      if (existsSync(abs)) m = statSync(abs).mtimeMs;
    } catch {
      m = 0;
    }
    parts.push(`${rel}@${m}`);
  }
  return parts.join("|");
}

/**
 * Cache key from section id + contentHash (after a pack has been built).
 */
export function packContentHashKey(id: string, contentHash: string): string {
  return `${id}#${contentHash}`;
}

export type GetCachedSectionPackOptions = {
  /** Cache instance. When null/undefined, always runs the builder. */
  cache?: PackCache | null;
  /**
   * Explicit cache key (typically from packSourceMtimeKey).
   * When omitted after a build, stores under id#contentHash (no pre-hit).
   */
  key?: string;
};

/**
 * Return a cached pack for `id`, or run `builder` and store the result.
 *
 * @example
 * ```ts
 * const key = packSourceMtimeKey(entry, cwd);
 * const pack = getCachedSectionPack(entry.id, () => buildSectionPack(entry), {
 *   cache,
 *   key,
 * });
 * ```
 */
export function getCachedSectionPack(
  id: string,
  builder: () => SectionPack,
  options?: GetCachedSectionPackOptions,
): SectionPack {
  const cache = options?.cache ?? null;
  const key = options?.key;

  if (cache && key) {
    const hit = cache.get(key);
    if (hit && hit.id === id) return hit;
  }

  const pack = builder();

  if (cache) {
    const storeKey = key ?? packContentHashKey(pack.id, pack.contentHash);
    cache.set(storeKey, pack);
  }

  return pack;
}
