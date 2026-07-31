/**
 * Diff two SectionPack instances for change detection and agent-facing reports.
 */

import type { FileTreeEntry, SectionPack } from "./types";

/** Result of comparing two assembled SectionPacks (a = baseline, b = current). */
export type SectionPackDiff = {
  /** Section ids (a preferred when they differ). */
  idA: string;
  idB: string;
  contentHashChanged: boolean;
  componentChanged: boolean;
  contentChanged: boolean;
  cssChanged: boolean;
  /** Paths present in b.fileTree but not a.fileTree */
  fileTreeAdded: string[];
  /** Paths present in a.fileTree but not b.fileTree */
  fileTreeRemoved: string[];
  /** One-line human summary suitable for logs / CI */
  summary: string;
};

function fileTreePaths(tree: FileTreeEntry[]): Set<string> {
  return new Set(tree.map((e) => e.path));
}

function sortedDiff(from: Set<string>, to: Set<string>): string[] {
  const out: string[] = [];
  for (const p of to) {
    if (!from.has(p)) out.push(p);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function buildSummary(diff: Omit<SectionPackDiff, "summary">): string {
  if (
    !diff.contentHashChanged &&
    !diff.componentChanged &&
    !diff.contentChanged &&
    !diff.cssChanged &&
    diff.fileTreeAdded.length === 0 &&
    diff.fileTreeRemoved.length === 0
  ) {
    const id = diff.idA === diff.idB ? diff.idA : `${diff.idA}/${diff.idB}`;
    return `SectionPack \`${id}\`: no changes`;
  }

  const parts: string[] = [];
  if (diff.contentHashChanged) parts.push("contentHash");
  if (diff.componentChanged) parts.push("component");
  if (diff.contentChanged) parts.push("content");
  if (diff.cssChanged) parts.push("css");
  if (diff.fileTreeAdded.length) {
    parts.push(`+${diff.fileTreeAdded.length} file(s)`);
  }
  if (diff.fileTreeRemoved.length) {
    parts.push(`-${diff.fileTreeRemoved.length} file(s)`);
  }

  const id = diff.idA === diff.idB ? diff.idA : `${diff.idA} -> ${diff.idB}`;
  return `SectionPack \`${id}\` changed: ${parts.join(", ")}`;
}

/**
 * Compare two SectionPacks surface-by-surface.
 *
 * `a` is the baseline (previous); `b` is the candidate (current).
 * File-tree adds/removes are path-only (role/bytes ignored).
 */
export function diffSectionPacks(
  a: SectionPack,
  b: SectionPack,
): SectionPackDiff {
  const pathsA = fileTreePaths(a.fileTree);
  const pathsB = fileTreePaths(b.fileTree);

  const base: Omit<SectionPackDiff, "summary"> = {
    idA: a.id,
    idB: b.id,
    contentHashChanged: a.contentHash !== b.contentHash,
    componentChanged: a.component !== b.component,
    contentChanged: a.content !== b.content,
    cssChanged: a.css !== b.css,
    fileTreeAdded: sortedDiff(pathsA, pathsB),
    fileTreeRemoved: sortedDiff(pathsB, pathsA),
  };

  return {
    ...base,
    summary: buildSummary(base),
  };
}

/**
 * Agent-friendly markdown report for a pack diff.
 */
export function formatPackDiffMarkdown(diff: SectionPackDiff): string {
  const sameId = diff.idA === diff.idB;
  const title = sameId
    ? `## SectionPack diff: \`${diff.idA}\``
    : `## SectionPack diff: \`${diff.idA}\` -> \`${diff.idB}\``;

  const flag = (v: boolean) => (v ? "yes" : "no");

  const lines: string[] = [
    title,
    "",
    `**Summary:** ${diff.summary}`,
    "",
    "| Surface | Changed |",
    "| --- | --- |",
    `| contentHash | ${flag(diff.contentHashChanged)} |`,
    `| component | ${flag(diff.componentChanged)} |`,
    `| content | ${flag(diff.contentChanged)} |`,
    `| css | ${flag(diff.cssChanged)} |`,
    "",
  ];

  if (diff.fileTreeAdded.length === 0 && diff.fileTreeRemoved.length === 0) {
    lines.push("**File tree:** no path adds/removes");
  } else {
    lines.push("**File tree**");
    if (diff.fileTreeAdded.length) {
      lines.push("");
      lines.push("Added:");
      for (const p of diff.fileTreeAdded) lines.push(`- \`${p}\``);
    }
    if (diff.fileTreeRemoved.length) {
      lines.push("");
      lines.push("Removed:");
      for (const p of diff.fileTreeRemoved) lines.push(`- \`${p}\``);
    }
  }

  lines.push("");
  return lines.join("\n");
}
