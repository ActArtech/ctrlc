/** Supported SectionPack export formats (mirrors API `format=` query). */
export type CopyFormat =
  | "describe"
  | "prompt"
  | "prompt-short"
  | "cursor-rule"
  | "component"
  | "content"
  | "css"
  | "template"
  | "json"
  | "zip";

export type MultiCopyFormat = "prompt" | "prompt-short" | "describe";

export type PackListItem = {
  id: string;
  label: string;
  description: string;
  tags: string[];
  componentPath: string;
};

/** Alias used by some hosts / list payloads */
export type SectionListItem = PackListItem;

/** Recipe preset from `?list=1` (optional; skip UI if absent). */
export type PackRecipe = {
  id: string;
  label: string;
  description?: string;
  sectionIds: string[];
  count?: number;
};

export type PackToast = {
  id: number;
  message: string;
  tone: "ok" | "err" | "info";
};

export type PackOverlayMeta = {
  id: string;
  label: string;
  component: string;
  tags?: string[];
  description?: string;
};

/** fileTree entry from SectionPack JSON (role + optional byte size). */
export type PackFileTreeEntry = {
  path: string;
  role: "component" | "content" | "css" | "related" | string;
  bytes?: number;
};

export type PackMeta = {
  tags: string[];
  description: string;
  /** path -> source when available (component / content / css surfaces) */
  files: Record<string, string>;
  promptMarkdown: string;
  contentHash?: string;
  fileTree?: PackFileTreeEntry[];
  /** Natural language brief (format=describe surface from JSON when present) */
  behaviorBriefMarkdown?: string;
};

/** Default API route used by the inspector UI. */
export const DEFAULT_SECTION_PACK_API = "/api/dev/section-pack";

/** Default catalog page path. */
export const DEFAULT_PACK_CATALOG_PATH = "/dev/packs";
