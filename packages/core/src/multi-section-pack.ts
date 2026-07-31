/**
 * Multi-section pack assembly: combine several sections into one agent pack
 * with deduped shared files, a section index, and combined prompt formats.
 */

import type {
  BuildMultiSectionPackOptions,
  FileTreeEntry,
  MultiCopyFormat,
  MultiPackByteSizes,
  MultiPackIndexEntry,
  MultiSectionPack,
  PackVariables,
  SectionPack,
  SectionPackConfig,
  SectionPackEntry,
} from "./types";
import { getSectionEntry, listSectionIds } from "./manifest";
import { buildSectionPack } from "./build-section-pack";
import {
  applyPromptVariablePipeline,
  mergePackVariables,
} from "./variables";
import { buildMultiBehaviorBriefMarkdown } from "./behavior-briefs";

export type {
  MultiCopyFormat,
  MultiPackByteSizes,
  MultiPackIndexEntry,
  MultiSectionPack,
};

export const MULTI_COPY_FORMATS: MultiCopyFormat[] = [
  "prompt",
  "prompt-short",
  "describe",
  "json",
  "zip",
];

function utf8Bytes(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

/** Trim, drop empties, preserve first occurrence order. */
export function normalizeSectionIds(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const id = item.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Parse `ids` query value: comma and/or space separated.
 * Returns normalized unique ids (may be empty).
 */
export function parseIdsParam(raw: string | null): string[] {
  if (raw == null) return [];
  return normalizeSectionIds(raw.split(/[,\s]+/));
}

export type MultiSectionValidation =
  | { ok: true; ids: string[] }
  | {
      ok: false;
      error: string;
      status: 400;
      known: string[];
      unknown?: string[];
    };

/**
 * Validate multi-section id list against a config.
 * Empty list and unknown ids both return 400 with known list.
 */
export function validateMultiSectionIds(
  config: SectionPackConfig,
  rawIds: string[],
): MultiSectionValidation {
  const ids = normalizeSectionIds(rawIds);
  const known = listSectionIds(config);

  if (!ids.length) {
    return {
      ok: false,
      error: "Empty ids. Use ?ids=hero,features,cta",
      status: 400,
      known,
    };
  }

  const unknown = ids.filter((id) => !getSectionEntry(config, id));
  if (unknown.length) {
    return {
      ok: false,
      error: `Unknown section id(s): ${unknown.join(", ")}`,
      status: 400,
      known,
      unknown,
    };
  }

  return { ok: true, ids };
}

function formatFileTreeMd(tree: FileTreeEntry[]): string {
  if (!tree.length) return "_Empty_";
  return tree
    .map((f) => `- \`${f.path}\` (${f.role}, ${f.bytes} bytes)`)
    .join("\n");
}

function buildMultiPromptMarkdown(
  ids: string[],
  packs: SectionPack[],
  fileTree: FileTreeEntry[],
  totalBytes: number,
  options?: BuildMultiSectionPackOptions,
): string {
  const indexRows = packs
    .map(
      (p, i) =>
        `${i + 1}. **\`${p.id}\`** - ${p.label}  \n   ${p.promptRole}  \n   Tags: ${p.tags.map((t) => `\`${t}\``).join(", ")}  \n   Files: ${p.byteSizes.totalFiles} bytes`,
    )
    .join("\n");

  const sectionBlocks = packs
    .map((p) => {
      return `## Section: ${p.label} (\`${p.id}\`)

### Role
${p.promptRole}

### Description
${p.description}

### Drop-in template

\`\`\`tsx
${p.templateSnippet.trim()}
\`\`\`

### Component (\`${p.importGraph.entry}\`)

\`\`\`tsx
${p.component}
\`\`\`

### Content data

\`\`\`ts
${p.content}
\`\`\`

### Styles (extracted)

\`\`\`css
${p.css}
\`\`\`

### Import graph
${
  p.importGraph.edges.length
    ? p.importGraph.edges
        .map((e) => {
          const typeTag = e.isTypeOnly ? " (type)" : "";
          const res = e.resolved ? ` -> \`${e.resolved}\`` : " (package)";
          return `- \`${e.specifier}\`${typeTag}${res} [${e.kind}]`;
        })
        .join("\n")
    : "_No imports detected_"
}
`;
    })
    .join("\n---\n\n");

  const sharedBlocks: string[] = [];
  const relatedSeen = new Set<string>();
  for (const pack of packs) {
    for (const [path, src] of Object.entries(pack.related)) {
      if (relatedSeen.has(path)) continue;
      relatedSeen.add(path);
      sharedBlocks.push(`### \`${path}\`\n\n\`\`\`tsx\n${src}\n\`\`\``);
    }
  }

  const recipeLine =
    options?.recipeId != null
      ? `**Recipe:** \`${options.recipeId}\`${options.recipeLabel ? ` (${options.recipeLabel})` : ""}\n`
      : "";

  return `# Multi section pack

${recipeLine}**Sections:** ${ids.map((id) => `\`${id}\``).join(", ")}
**Count:** ${packs.length}
**Combined source files:** ${totalBytes} bytes (${fileTree.length} unique paths)

## How to use this in a prompt
1. Paste this entire multi-section pack into your coding agent.
2. Ask it to adapt these sections as a cohesive page region (copy, brand tokens, routes). Prefer brand tokens from Brand context (\`{{productName}}\`, \`{{tagline}}\`, \`{{demoHref}}\`, \`{{email}}\`, \`{{primaryCta}}\`).
3. Keep interaction models and structure unless you explicitly want changes.
4. Shared utilities and modules appear once under Related / shared files.

## Index
${indexRows}

## Combined file tree
${formatFileTreeMd(fileTree)}

## Related / shared files (deduped)
${sharedBlocks.length ? sharedBlocks.join("\n\n") : "_None_"}

---

${sectionBlocks}

---
_Generated by CtrlC SectionPack_
`;
}

function buildMultiPromptShortMarkdown(
  ids: string[],
  packs: SectionPack[],
  fileTree: FileTreeEntry[],
  totalBytes: number,
  options?: BuildMultiSectionPackOptions,
): string {
  const indexLines = packs
    .map(
      (p) =>
        `- \`${p.id}\` ${p.label} | ${p.promptRole} | ${p.byteSizes.totalFiles}b | tags: ${p.tags.join(", ")}`,
    )
    .join("\n");

  const treeOneLiner = fileTree
    .map((f) => `${f.path}(${f.role},${f.bytes}b)`)
    .join(" | ");

  const sectionBodies = packs
    .map((p) => {
      const deps = p.importGraph.projectDeps.length
        ? p.importGraph.projectDeps.map((d) => `\`${d}\``).join(", ")
        : "_none_";
      return `### \`${p.id}\` - ${p.label}
**Role:** ${p.promptRole}
**@/ deps:** ${deps}

#### Template
\`\`\`tsx
${p.templateSnippet.trim()}
\`\`\`

#### Component
\`\`\`tsx
${p.component.trim()}
\`\`\`

#### Content
\`\`\`ts
${p.content.trim()}
\`\`\`

#### CSS
\`\`\`css
${p.css.trim()}
\`\`\`
`;
    })
    .join("\n");

  const recipeBit = options?.recipeId
    ? ` | **Recipe:** \`${options.recipeId}\``
    : "";

  return `# Multi-section: ${ids.join(", ")}

**Count:** ${packs.length} | **Files:** ${fileTree.length} paths / ${totalBytes} bytes${recipeBit}
**Brand:** {{productName}} | {{tagline}} | CTA: {{primaryCta}} ({{demoHref}}) | {{email}}

## Index
${indexLines}

## Combined files
${treeOneLiner || "(none)"}

${sectionBodies}
`;
}

function resolveEntries(
  config: SectionPackConfig,
  ids: string[],
): { normalized: string[]; entries: SectionPackEntry[] } {
  const normalized = normalizeSectionIds(ids);
  if (!normalized.length) {
    throw new Error("buildMultiSectionPack: empty ids");
  }

  const entries: SectionPackEntry[] = [];
  for (const id of normalized) {
    const entry = getSectionEntry(config, id);
    if (!entry) {
      throw new Error(`buildMultiSectionPack: unknown id: ${id}`);
    }
    entries.push(entry);
  }
  return { normalized, entries };
}

function sectionBuildOptions(
  config: SectionPackConfig,
  options?: BuildMultiSectionPackOptions,
) {
  return {
    cwd: options?.cwd,
    sharedUtilSelectors: options?.sharedUtilSelectors,
    resolveComponentImport: options?.resolveComponentImport,
    behaviorSpecs: options?.behaviorSpecs,
    defaultVariables: options?.defaultVariables,
  };
}

/**
 * Build each section pack (sync map). `buildSectionPack` is synchronous;
 * this helper is the parallel-shaped entry point for callers that want a
 * named batch build without multi-pack assembly (index / zip / prompts).
 *
 * Order matches `ids` after normalize + dedupe.
 */
export function buildSectionPacksParallel(
  config: SectionPackConfig,
  ids: string[],
  options?: BuildMultiSectionPackOptions,
): SectionPack[] {
  const { entries } = resolveEntries(config, ids);
  const opts = sectionBuildOptions(config, options);
  // Sync builder: map is the parallel-shaped batch API (no await needed).
  // Use buildMultiSectionPackAsync when an async boundary is preferred.
  return entries.map((e) => buildSectionPack(e, config, opts));
}

function buildPacksFromEntries(
  config: SectionPackConfig,
  entries: SectionPackEntry[],
  options?: BuildMultiSectionPackOptions,
): SectionPack[] {
  const opts = sectionBuildOptions(config, options);
  return entries.map((e) => buildSectionPack(e, config, opts));
}

function assembleMultiSectionPack(
  normalized: string[],
  entries: SectionPackEntry[],
  packs: SectionPack[],
  options: BuildMultiSectionPackOptions | undefined,
  t0: number,
): MultiSectionPack {
  // Dedupe files: first section wins
  const files: Record<string, string> = {};
  const fileTreeMap = new Map<string, FileTreeEntry>();
  for (const pack of packs) {
    for (const [path, src] of Object.entries(pack.files)) {
      if (!(path in files)) {
        files[path] = src;
      }
    }
    for (const node of pack.fileTree) {
      if (!fileTreeMap.has(node.path)) {
        fileTreeMap.set(node.path, node);
      }
    }
  }

  const fileTree = [...fileTreeMap.values()].sort((a, b) =>
    a.path.localeCompare(b.path),
  );

  const filesBytes: Record<string, number> = {};
  let totalBytes = 0;
  for (const [path, src] of Object.entries(files)) {
    const n = utf8Bytes(src);
    filesBytes[path] = n;
    totalBytes += n;
  }

  const perSection: Record<string, number> = {};
  for (const pack of packs) {
    perSection[pack.id] = pack.byteSizes.totalFiles;
  }

  const index: MultiPackIndexEntry[] = packs.map((p, i) => {
    const entry = entries[i]!;
    return {
      id: p.id,
      label: p.label,
      description: p.description,
      tags: p.tags,
      promptRole: p.promptRole,
      componentPath: entry.componentPath,
      componentExport: entry.componentExport,
      contentKeys: entry.contentKeys,
      cssSelectors: entry.cssSelectors,
      contentHash: p.contentHash,
      fileCount: p.fileTree.length,
      totalFilesBytes: p.byteSizes.totalFiles,
      promptBytes: p.byteSizes.prompt,
      promptShortBytes: p.byteSizes.promptShort,
    };
  });

  const promptMarkdown = buildMultiPromptMarkdown(
    normalized,
    packs,
    fileTree,
    totalBytes,
    options,
  );
  const promptShortMarkdown = buildMultiPromptShortMarkdown(
    normalized,
    packs,
    fileTree,
    totalBytes,
    options,
  );

  const behaviorBriefMarkdown = buildMultiBehaviorBriefMarkdown(
    packs,
    options?.recipeLabel,
  );

  const byteSizes: MultiPackByteSizes = {
    totalFiles: totalBytes,
    prompt: utf8Bytes(promptMarkdown),
    promptShort: utf8Bytes(promptShortMarkdown),
    files: filesBytes,
    perSection,
  };

  const builtAt = new Date().toISOString();
  const buildMs = Math.max(0, Date.now() - t0);

  return {
    ids: normalized,
    recipeId: options?.recipeId,
    recipeLabel: options?.recipeLabel,
    index,
    packs,
    files,
    fileTree,
    totalBytes,
    promptMarkdown,
    promptShortMarkdown,
    behaviorBriefMarkdown,
    generatedAt: builtAt,
    builtAt,
    buildMs,
    byteSizes,
  };
}

/**
 * Build a multi-section pack from known section ids (request order, unique).
 * Callers should validate ids first via `validateMultiSectionIds` or a recipe.
 * Signature: buildMultiSectionPack(config, ids, options?)
 *
 * Section packs are built via `buildSectionPacksParallel` (sync map today).
 * Timing metadata: `builtAt`, `buildMs`.
 */
export function buildMultiSectionPack(
  config: SectionPackConfig,
  ids: string[],
  options?: BuildMultiSectionPackOptions,
): MultiSectionPack {
  const t0 = Date.now();
  const { normalized, entries } = resolveEntries(config, ids);
  const packs = buildPacksFromEntries(config, entries, options);
  return assembleMultiSectionPack(normalized, entries, packs, options, t0);
}

/**
 * Async multi-section pack builder. Wraps each sync `buildSectionPack` in a
 * microtask so callers can `await Promise.all`-style concurrency boundaries
 * (and so future async file IO can drop in without changing the public API).
 */
export async function buildMultiSectionPackAsync(
  config: SectionPackConfig,
  ids: string[],
  options?: BuildMultiSectionPackOptions,
): Promise<MultiSectionPack> {
  const t0 = Date.now();
  const { normalized, entries } = resolveEntries(config, ids);
  const opts = sectionBuildOptions(config, options);
  const packs = await Promise.all(
    entries.map((e) =>
      Promise.resolve().then(() => buildSectionPack(e, config, opts)),
    ),
  );
  return assembleMultiSectionPack(normalized, entries, packs, options, t0);
}

/**
 * Format multi pack for copy/download.
 * Prompt formats inject Brand context + apply `{{var}}` substitution.
 */
export function formatMultiPackForCopy(
  pack: MultiSectionPack,
  format: MultiCopyFormat,
  vars?: PackVariables | null,
  options?: {
    applyVars?: boolean;
    defaultVariables?: PackVariables;
  },
): string {
  const applyVars = options?.applyVars !== false && format !== "zip";
  const resolved = applyVars
    ? mergePackVariables(vars, options?.defaultVariables)
    : null;

  const withVars = (text: string) =>
    resolved
      ? applyPromptVariablePipeline(text, resolved, { injectBrand: true })
      : text;

  switch (format) {
    case "prompt":
      return withVars(pack.promptMarkdown);
    case "prompt-short":
      return withVars(pack.promptShortMarkdown);
    case "describe":
      return withVars(pack.behaviorBriefMarkdown);
    case "zip":
      // Binary format handled by buildMultiSectionZip at the API layer
      return pack.promptMarkdown;
    case "json": {
      const promptMarkdown = withVars(pack.promptMarkdown);
      const promptShortMarkdown = withVars(pack.promptShortMarkdown);
      const behaviorBriefMarkdown = withVars(pack.behaviorBriefMarkdown);
      return JSON.stringify(
        {
          ids: pack.ids,
          recipeId: pack.recipeId ?? null,
          recipeLabel: pack.recipeLabel ?? null,
          index: pack.index,
          fileTree: pack.fileTree,
          totalBytes: pack.totalBytes,
          byteSizes: pack.byteSizes,
          generatedAt: pack.generatedAt,
          builtAt: pack.builtAt ?? pack.generatedAt,
          buildMs: pack.buildMs ?? null,
          variables: resolved,
          files: Object.keys(pack.files),
          packs: pack.packs.map((p) => ({
            id: p.id,
            label: p.label,
            description: p.description,
            tags: p.tags,
            promptRole: p.promptRole,
            contentHash: p.contentHash,
            component: p.component,
            content: p.content,
            css: p.css,
            templateSnippet: p.templateSnippet,
            behaviorBriefMarkdown: p.behaviorBriefMarkdown,
            cursorRuleMarkdown: p.cursorRuleMarkdown,
            fileTree: p.fileTree,
            byteSizes: p.byteSizes,
            importGraph: p.importGraph,
          })),
          promptMarkdown,
          promptShortMarkdown,
          behaviorBriefMarkdown,
        },
        null,
        2,
      );
    }
    default:
      return withVars(pack.promptMarkdown);
  }
}

export function parseMultiFormat(raw: string | null): MultiCopyFormat | null {
  const format = (raw || "json") as MultiCopyFormat;
  if (!MULTI_COPY_FORMATS.includes(format)) return null;
  return format;
}
