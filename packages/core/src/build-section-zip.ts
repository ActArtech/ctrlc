/**
 * Assemble single- and multi-section ZIP packs (store-only) for dev downloads.
 */

import { createHash } from "node:crypto";
import type { MultiSectionPack, PackZipResult, SectionPack } from "./types";
import {
  buildStoreZip,
  relatedZipPath,
  sanitizeZipSegment,
  type ZipEntryInput,
} from "./zip-store";

export type { PackZipResult };

function hash8(hex: string): string {
  return hex.slice(0, 8);
}

function multiContentHash(pack: MultiSectionPack): string {
  const h = createHash("sha256");
  for (const p of pack.packs) {
    h.update(p.id, "utf8");
    h.update("\0", "utf8");
    h.update(p.contentHash, "utf8");
    h.update("\0", "utf8");
  }
  return h.digest("hex");
}

function singleMetaJson(pack: SectionPack): string {
  return JSON.stringify(
    {
      id: pack.id,
      label: pack.label,
      description: pack.description,
      tags: pack.tags,
      promptRole: pack.promptRole,
      contentHash: pack.contentHash,
      fileTree: pack.fileTree,
      byteSizes: pack.byteSizes,
      importGraph: pack.importGraph,
      generatedAt: pack.generatedAt,
    },
    null,
    2,
  );
}

function multiMetaJson(pack: MultiSectionPack, combinedHash: string): string {
  return JSON.stringify(
    {
      ids: pack.ids,
      recipeId: pack.recipeId ?? null,
      recipeLabel: pack.recipeLabel ?? null,
      contentHash: combinedHash,
      index: pack.index,
      fileTree: pack.fileTree,
      totalBytes: pack.totalBytes,
      byteSizes: pack.byteSizes,
      generatedAt: pack.generatedAt,
    },
    null,
    2,
  );
}

/** Files under `rootDir/` for one section pack surface. */
export function sectionPackZipEntries(
  pack: SectionPack,
  rootDir: string,
): ZipEntryInput[] {
  const root = rootDir.replace(/\/+$/, "");
  const entries: ZipEntryInput[] = [
    { path: `${root}/README.md`, data: pack.promptMarkdown },
    {
      path: `${root}/NATURAL_LANGUAGE.md`,
      data: pack.behaviorBriefMarkdown,
    },
    { path: `${root}/component.tsx`, data: pack.component },
    { path: `${root}/content.ts`, data: pack.content },
    { path: `${root}/styles.css`, data: pack.css },
    { path: `${root}/meta.json`, data: singleMetaJson(pack) },
    {
      path: `${root}/template.tsx`,
      data: pack.templateSnippet,
    },
    {
      path: `${root}/cursor-rule.md`,
      data: pack.cursorRuleMarkdown,
    },
  ];

  for (const [projectPath, src] of Object.entries(pack.related)) {
    entries.push({
      path: `${root}/${relatedZipPath(projectPath)}`,
      data: src,
    });
  }

  return entries;
}

/**
 * Build ZIP for a single section.
 * Layout:
 *   section-{id}/
 *     README.md, component.tsx, content.ts, styles.css, meta.json, ...
 *     related/...
 */
export function buildSectionZip(pack: SectionPack): PackZipResult {
  const idSeg = sanitizeZipSegment(pack.id);
  const h8 = hash8(pack.contentHash);
  const rootDir = `section-${idSeg}`;
  const entries = sectionPackZipEntries(pack, rootDir);
  const bytes = buildStoreZip(entries);
  return {
    bytes,
    filename: `section-${idSeg}-${h8}.zip`,
    rootDir,
    hash8: h8,
    entryCount: entries.length,
    byteLength: bytes.byteLength,
  };
}

/**
 * Build ZIP for multi-section pack.
 * Layout:
 *   multi-{ids}/
 *     README.md
 *     meta.json
 *     sections/{id}/...
 */
export function buildMultiSectionZip(pack: MultiSectionPack): PackZipResult {
  const idParts = pack.ids.map(sanitizeZipSegment);
  const idsSlug =
    idParts.length <= 4
      ? idParts.join("-")
      : `${idParts.slice(0, 3).join("-")}-plus${idParts.length - 3}`;
  const combinedHash = multiContentHash(pack);
  const h8 = hash8(combinedHash);
  const rootDir = `multi-${idsSlug}`;

  const entries: ZipEntryInput[] = [
    { path: `${rootDir}/README.md`, data: pack.promptMarkdown },
    {
      path: `${rootDir}/NATURAL_LANGUAGE.md`,
      data: pack.behaviorBriefMarkdown,
    },
    { path: `${rootDir}/meta.json`, data: multiMetaJson(pack, combinedHash) },
  ];

  for (const p of pack.packs) {
    const sectionRoot = `${rootDir}/sections/${sanitizeZipSegment(p.id)}`;
    entries.push(...sectionPackZipEntries(p, sectionRoot));
  }

  const bytes = buildStoreZip(entries);
  return {
    bytes,
    filename: `multi-${idsSlug}-${h8}.zip`,
    rootDir,
    hash8: h8,
    entryCount: entries.length,
    byteLength: bytes.byteLength,
  };
}
