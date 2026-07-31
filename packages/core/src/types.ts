/**
 * Public types for @ctrlc/core SectionPack system.
 */

/** Optional hand-authored natural-language behavior for a section. */
export type BehaviorBriefSpec = {
  id: string;
  /** One-line identity */
  whatItIs: string;
  /** Business / UX job */
  function: string;
  /** User-visible behaviors and states */
  behavior: string[];
  /** Motion / animation language */
  motion: string[];
  /** Layout, alignment, spacing language */
  layout: string[];
  /** Color and surface language */
  color: string[];
  /** Typography notes */
  type: string[];
  /** Responsive / breakpoint notes */
  responsive: string[];
  /** Accessibility expectations */
  a11y: string[];
  /** What other systems this depends on or influences */
  influences: string[];
  /** Suggested rebuild constraints for an agent */
  rebuildGuidance: string[];
};

/** One section entry in a host app's pack config. */
export type SectionPackEntry = {
  id: string;
  label: string;
  description: string;
  /** Relative to project root (cwd) */
  componentPath: string;
  componentExport: string;
  /** Content keys exported from the content module (if any) */
  contentKeys: string[];
  contentModulePath?: string;
  /** Class prefixes/selectors used to extract CSS */
  cssSelectors: string[];
  cssModulePath: string;
  /** Optional shared deps to include in full packs */
  relatedPaths?: string[];
  tags: string[];
  /** Suggested prompt use */
  promptRole: string;
  /** Optional embedded behavior brief (overrides registry by id) */
  behavior?: BehaviorBriefSpec;
  /**
   * Optional catalog preview image (public-relative path, site path, or absolute URL).
   * Convention: `ctrlc-previews/<id>.png` under `public/`.
   */
  previewImage?: string;
  /** Alias of previewImage for hosts that prefer "thumbnail" naming. */
  thumbnail?: string;
};

/** Named multi-section recipe. */
export type PackRecipe = {
  id: string;
  label: string;
  description: string;
  /** Ordered section ids */
  sectionIds: string[];
};

/** Flat string map used by `{{key}}` replacement. */
export type PackVariables = Record<string, string>;

/** Supported SectionPackConfig schema major version (missing treated as 1). */
export type SectionPackSchemaVersion = 1;

/** Host-provided configuration for pack assembly. */
export type SectionPackConfig = {
  /**
   * Config format version. Optional; missing is treated as `1`.
   * Versions greater than the package's supported version fail validation.
   */
  schemaVersion?: SectionPackSchemaVersion | number;
  sections: SectionPackEntry[];
  recipes?: PackRecipe[];
  defaultVariables?: PackVariables;
  /** Shared utility class selectors auto-included when referenced */
  sharedUtilSelectors?: readonly string[];
  /**
   * Resolve template import path for a section.
   * Default: `@/` + componentPath without `src/` prefix when under src/.
   */
  resolveComponentImport?: (entry: SectionPackEntry) => string;
  /** Extra behavior specs keyed by section id */
  behaviorSpecs?: Record<string, BehaviorBriefSpec>;
};

export type ImportEdge = {
  /** Raw import specifier as written in source */
  specifier: string;
  /** Project-relative path when resolved from @/ or relative imports; null for packages */
  resolved: string | null;
  kind: "import" | "export-from" | "dynamic";
  isTypeOnly: boolean;
};

export type ImportGraph = {
  entry: string;
  edges: ImportEdge[];
  /** Unique resolved project paths (from @/ and relative) */
  projectDeps: string[];
};

export type FileTreeEntry = {
  path: string;
  role: "component" | "content" | "css" | "related";
  bytes: number;
};

export type PackByteSizes = {
  component: number;
  content: number;
  css: number;
  related: number;
  prompt: number;
  promptShort: number;
  totalFiles: number;
  files: Record<string, number>;
};

/** Assembled single-section pack (code surfaces + prompt formats). */
export type SectionPack = {
  id: string;
  label: string;
  description: string;
  tags: string[];
  promptRole: string;
  files: Record<string, string>;
  component: string;
  content: string;
  css: string;
  related: Record<string, string>;
  promptMarkdown: string;
  /** Compact pack for agent context windows */
  promptShortMarkdown: string;
  /**
   * Natural-language brief: function, motion, behavior, color, layout,
   * alignment, multi-file influences - for agents without raw code dump.
   */
  behaviorBriefMarkdown: string;
  /** Cursor .mdc / AGENTS.md coding-standard fragment for this section */
  cursorRuleMarkdown: string;
  templateSnippet: string;
  generatedAt: string;
  /**
   * Stable sha256 of component + content + css (hex).
   * Use for cache keys / change detection; ignores related files and timestamps.
   */
  contentHash: string;
  /** Sorted path list + roles for the pack surface */
  fileTree: FileTreeEntry[];
  byteSizes: PackByteSizes;
  /** Imports from the component TSX, @/ resolved to project-relative paths */
  importGraph: ImportGraph;
};

export type CopyFormat =
  | "component"
  | "content"
  | "css"
  | "template"
  | "prompt"
  | "prompt-short"
  | "describe"
  | "cursor-rule"
  | "json"
  | "zip";

export type MultiCopyFormat =
  | "prompt"
  | "prompt-short"
  | "describe"
  | "json"
  | "zip";

export type MultiPackIndexEntry = {
  id: string;
  label: string;
  description: string;
  tags: string[];
  promptRole: string;
  componentPath: string;
  componentExport: string;
  contentKeys: string[];
  cssSelectors: string[];
  contentHash: string;
  fileCount: number;
  totalFilesBytes: number;
  promptBytes: number;
  promptShortBytes: number;
};

export type MultiPackByteSizes = {
  totalFiles: number;
  prompt: number;
  promptShort: number;
  files: Record<string, number>;
  /** Per-section totalFiles from each pack */
  perSection: Record<string, number>;
};

export type MultiSectionPack = {
  /** Request order, duplicates removed */
  ids: string[];
  /** When built from a named recipe */
  recipeId?: string;
  recipeLabel?: string;
  index: MultiPackIndexEntry[];
  /** Full single packs in request order */
  packs: SectionPack[];
  /** Union of all source files; first section wins on path collision */
  files: Record<string, string>;
  /** Combined sorted file tree (deduped paths) */
  fileTree: FileTreeEntry[];
  totalBytes: number;
  promptMarkdown: string;
  promptShortMarkdown: string;
  /** Combined natural-language briefs for all selected sections */
  behaviorBriefMarkdown: string;
  generatedAt: string;
  /**
   * ISO timestamp when multi-pack assembly finished (same clock as generatedAt).
   * Prefer this field for timing metadata in agents / CI.
   */
  builtAt?: string;
  /** Wall-clock ms spent building all section packs + combining them */
  buildMs?: number;
  byteSizes: MultiPackByteSizes;
};

export type PackZipResult = {
  bytes: Uint8Array;
  filename: string;
  rootDir: string;
  hash8: string;
  entryCount: number;
  byteLength: number;
};

export type BuildSectionPackOptions = {
  /** Project root for filesystem reads (default: process.cwd()) */
  cwd?: string;
  sharedUtilSelectors?: readonly string[];
  resolveComponentImport?: (entry: SectionPackEntry) => string;
  behaviorSpecs?: Record<string, BehaviorBriefSpec>;
  defaultVariables?: PackVariables;
};

export type BuildMultiSectionPackOptions = {
  cwd?: string;
  recipeId?: string;
  recipeLabel?: string;
  sharedUtilSelectors?: readonly string[];
  resolveComponentImport?: (entry: SectionPackEntry) => string;
  behaviorSpecs?: Record<string, BehaviorBriefSpec>;
  defaultVariables?: PackVariables;
};

export type FormatPackOptions = {
  applyVars?: boolean;
  defaultVariables?: PackVariables;
  injectBrand?: boolean;
};
