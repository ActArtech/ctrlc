import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import type {
  BuildSectionPackOptions,
  CopyFormat,
  FileTreeEntry,
  ImportEdge,
  ImportGraph,
  PackByteSizes,
  PackVariables,
  SectionPack,
  SectionPackConfig,
  SectionPackEntry,
} from "./types";
import {
  applyPromptVariablePipeline,
  mergePackVariables,
} from "./variables";
import { buildBehaviorBriefMarkdown } from "./behavior-briefs";
import { draftBehaviorBrief } from "./draft-brief";
import {
  DEFAULT_SHARED_UTIL_SELECTORS,
  resolveDefaultComponentImport,
} from "./manifest";

export type {
  CopyFormat,
  FileTreeEntry,
  ImportEdge,
  ImportGraph,
  PackByteSizes,
  SectionPack,
};

/** Shared utility selectors pulled in when referenced by section CSS or component source. */
export const SHARED_UTIL_SELECTORS = DEFAULT_SHARED_UTIL_SELECTORS;

export const COPY_FORMATS: CopyFormat[] = [
  "component",
  "content",
  "css",
  "template",
  "prompt",
  "prompt-short",
  "describe",
  "cursor-rule",
  "json",
  "zip",
];

/** sha256 hex of the three primary surfaces (component + content + css). */
export function hashPackSurfaces(
  component: string,
  content: string,
  css: string,
): string {
  return createHash("sha256")
    .update(component, "utf8")
    .update("\0", "utf8")
    .update(content, "utf8")
    .update("\0", "utf8")
    .update(css, "utf8")
    .digest("hex");
}

function rootPath(cwd: string, ...parts: string[]) {
  return join(cwd, ...parts);
}

function safeRead(cwd: string, rel: string): string | null {
  const abs = rootPath(cwd, rel);
  if (!existsSync(abs)) return null;
  try {
    return readFileSync(abs, "utf8");
  } catch {
    return null;
  }
}

function utf8Bytes(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Content extraction (brace / bracket / paren balanced)
// ---------------------------------------------------------------------------

function skipStringLiteral(source: string, i: number): number {
  const quote = source[i];
  if (quote !== '"' && quote !== "'" && quote !== "`") return i + 1;
  let j = i + 1;
  while (j < source.length) {
    const c = source[j];
    if (c === "\\") {
      j += 2;
      continue;
    }
    if (quote === "`" && c === "$" && source[j + 1] === "{") {
      j += 2;
      j = skipBalanced(source, j - 1, "{", "}");
      continue;
    }
    if (c === quote) return j + 1;
    j++;
  }
  return source.length;
}

function skipLineComment(source: string, i: number): number {
  let j = i + 2;
  while (j < source.length && source[j] !== "\n") j++;
  return j;
}

function skipBlockComment(source: string, i: number): number {
  let j = i + 2;
  while (j < source.length - 1) {
    if (source[j] === "*" && source[j + 1] === "/") return j + 2;
    j++;
  }
  return source.length;
}

/** Walk from an opening brace/bracket/paren index; return index after matching close. */
function skipBalanced(
  source: string,
  openIdx: number,
  openCh: string,
  closeCh: string,
): number {
  let depth = 0;
  let i = openIdx;
  while (i < source.length) {
    const c = source[i];
    if (c === '"' || c === "'" || c === "`") {
      i = skipStringLiteral(source, i);
      continue;
    }
    if (c === "/" && source[i + 1] === "/") {
      i = skipLineComment(source, i);
      continue;
    }
    if (c === "/" && source[i + 1] === "*") {
      i = skipBlockComment(source, i);
      continue;
    }
    if (c === openCh) depth++;
    else if (c === closeCh) {
      depth--;
      if (depth === 0) return i + 1;
    }
    i++;
  }
  return source.length;
}

/** End index (exclusive) of a TS value starting at `i` (object, array, call, literal). */
function scanTsValueEnd(source: string, i: number): number {
  while (i < source.length && /\s/.test(source[i]!)) i++;
  if (i >= source.length) return i;

  const c = source[i]!;
  if (c === "{" || c === "[" || c === "(") {
    const close = c === "{" ? "}" : c === "[" ? "]" : ")";
    let end = skipBalanced(source, i, c, close);
    while (end < source.length) {
      const rest = source.slice(end);
      const asMatch = rest.match(/^\s+as\s+[A-Za-z0-9_$.|<>,\s[\]{}]+/);
      if (asMatch) {
        end += asMatch[0].length;
        continue;
      }
      if (/^\s*satisfies\b/.test(rest)) {
        const m = rest.match(/^\s*satisfies\s+[A-Za-z0-9_$.|<>,\s[\]{}]+/);
        if (m) {
          end += m[0].length;
          continue;
        }
      }
      break;
    }
    if (source[end] === ";") end++;
    return end;
  }

  if (c === '"' || c === "'" || c === "`") {
    let end = skipStringLiteral(source, i);
    if (source[end] === ";") end++;
    return end;
  }

  let end = i;
  while (end < source.length) {
    const ch = source[end]!;
    if (ch === '"' || ch === "'" || ch === "`") {
      end = skipStringLiteral(source, end);
      continue;
    }
    if (ch === "/" && source[end + 1] === "/") {
      end = skipLineComment(source, end);
      continue;
    }
    if (ch === "/" && source[end + 1] === "*") {
      end = skipBlockComment(source, end);
      continue;
    }
    if (ch === "{" || ch === "[" || ch === "(") {
      const close = ch === "{" ? "}" : ch === "[" ? "]" : ")";
      end = skipBalanced(source, end, ch, close);
      continue;
    }
    if (ch === ";") return end + 1;
    if (ch === "\n") {
      const ahead = source.slice(end + 1);
      if (/^\s*(export\s+|const\s+|type\s+|function\s+|\/\/)/.test(ahead)) {
        return end + 1;
      }
    }
    end++;
  }
  return end;
}

/**
 * Extract `export const Key = ...` blocks from a TS module using brace-balanced
 * scanning (not fragile end-of-export regex).
 */
export function extractContentKeys(source: string, keys: string[]): string {
  if (!keys.length) return "// no content keys for this section\n";
  const chunks: string[] = [];

  for (const key of keys) {
    const re = new RegExp(`export\\s+const\\s+${escapeRegex(key)}\\b`);
    const m = re.exec(source);
    if (!m) {
      chunks.push(`// missing export: ${key}`);
      continue;
    }

    const start = m.index;
    let i = m.index + m[0].length;

    let depthAngle = 0;
    let depthParen = 0;
    let depthBrace = 0;
    let depthBracket = 0;
    while (i < source.length) {
      const ch = source[i]!;
      if (ch === '"' || ch === "'" || ch === "`") {
        i = skipStringLiteral(source, i);
        continue;
      }
      if (ch === "/" && source[i + 1] === "/") {
        i = skipLineComment(source, i);
        continue;
      }
      if (ch === "/" && source[i + 1] === "*") {
        i = skipBlockComment(source, i);
        continue;
      }
      if (ch === "<") depthAngle++;
      else if (ch === ">" && depthAngle > 0) depthAngle--;
      else if (ch === "(") depthParen++;
      else if (ch === ")" && depthParen > 0) depthParen--;
      else if (ch === "{") depthBrace++;
      else if (ch === "}" && depthBrace > 0) depthBrace--;
      else if (ch === "[") depthBracket++;
      else if (ch === "]" && depthBracket > 0) depthBracket--;
      else if (
        ch === "=" &&
        source[i + 1] !== ">" &&
        depthAngle === 0 &&
        depthParen === 0 &&
        depthBrace === 0 &&
        depthBracket === 0
      ) {
        i++;
        break;
      }
      i++;
    }

    const end = scanTsValueEnd(source, i);
    chunks.push(source.slice(start, end).trim());
  }

  return chunks.join("\n\n") + "\n";
}

// ---------------------------------------------------------------------------
// CSS extraction (nested rules, @media, keyframes, shared utils)
// ---------------------------------------------------------------------------

type CssBlock = {
  prelude: string;
  body: string;
  full: string;
};

function stripCssComments(css: string): string {
  let out = "";
  let i = 0;
  while (i < css.length) {
    if (css[i] === "/" && css[i + 1] === "*") {
      i += 2;
      while (i < css.length - 1 && !(css[i] === "*" && css[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (css[i] === '"' || css[i] === "'") {
      const start = i;
      i = skipStringLiteral(css, i);
      out += css.slice(start, i);
      continue;
    }
    out += css[i];
    i++;
  }
  return out;
}

function findMatchingBraceCss(s: string, openIdx: number): number {
  let depth = 0;
  let i = openIdx;
  while (i < s.length) {
    const c = s[i]!;
    if (c === '"' || c === "'") {
      i = skipStringLiteral(s, i);
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

/** Parse top-level CSS rule / at-rule blocks with brace balancing. */
export function parseCssBlocks(cssSource: string): CssBlock[] {
  const css = stripCssComments(cssSource);
  const blocks: CssBlock[] = [];
  let i = 0;
  const n = css.length;

  while (i < n) {
    while (i < n && /\s/.test(css[i]!)) i++;
    if (i >= n) break;

    const start = i;
    let preludeEnd = -1;

    while (i < n) {
      const c = css[i]!;
      if (c === '"' || c === "'") {
        i = skipStringLiteral(css, i);
        continue;
      }
      if (c === "{") {
        preludeEnd = i;
        break;
      }
      if (c === ";") {
        i++;
        preludeEnd = -2;
        break;
      }
      i++;
    }

    if (preludeEnd === -2) continue;
    if (preludeEnd < 0) break;

    const prelude = css.slice(start, preludeEnd).trim();
    const bodyEnd = findMatchingBraceCss(css, preludeEnd);
    if (bodyEnd < 0) break;
    const body = css.slice(preludeEnd + 1, bodyEnd);
    const full = css.slice(start, bodyEnd + 1).trim();
    blocks.push({ prelude, body, full });
    i = bodyEnd + 1;
  }

  return blocks;
}

function selectorListMatches(prelude: string, selectors: string[]): boolean {
  if (!selectors.length) return false;
  const hay = prelude.replace(/\s+/g, " ").trim();
  return selectors.some((sel) => {
    const bare = sel.replace(/^\./, "");
    if (!bare) return false;
    if (hay.includes(sel)) return true;
    const re = new RegExp(
      `(^|[\\s,>+~()])\\.${escapeRegex(bare)}(?![a-zA-Z0-9_-])`,
    );
    if (re.test(hay)) return true;
    return hay.split(/[\s,>+~]/).some((t) => {
      const clean = t.replace(/::?[a-zA-Z-]+(\([^)]*\))?/g, "").replace(/^\./, "");
      return (
        clean === bare ||
        clean.startsWith(bare + "__") ||
        clean.startsWith(bare + "--")
      );
    });
  });
}

function listKeyframeNames(blocks: CssBlock[]): Set<string> {
  const names = new Set<string>();
  for (const b of blocks) {
    const m = b.prelude.match(/^@(-webkit-)?keyframes\s+([^\s{]+)/i);
    if (m) names.add(m[2]!);
  }
  return names;
}

function findReferencedKeyframes(
  cssFragment: string,
  known: Set<string>,
): Set<string> {
  const refs = new Set<string>();
  for (const name of known) {
    const re = new RegExp(
      `(?:^|[\\s:,(])${escapeRegex(name)}(?=$|[\\s;,)])`,
    );
    if (re.test(cssFragment)) refs.add(name);
  }
  return refs;
}

function detectSharedUtilHits(
  text: string,
  utils: readonly string[] = SHARED_UTIL_SELECTORS,
): string[] {
  const hits: string[] = [];
  for (const sel of utils) {
    const bare = sel.replace(/^\./, "");
    const re = new RegExp(
      `(?:^|[^a-zA-Z0-9_-])${escapeRegex(bare)}(?=$|[^a-zA-Z0-9]|--|__|:)`,
    );
    if (re.test(text)) hits.push(sel);
  }
  return hits;
}

function extractMatchingFromBlocks(
  blocks: CssBlock[],
  selectors: string[],
  knownKeyframes: Set<string>,
  utilCatalog: readonly string[] = SHARED_UTIL_SELECTORS,
): { rules: string[]; keyframes: Set<string>; utils: string[] } {
  const rules: string[] = [];
  const keyframes = new Set<string>();
  const utilTextParts: string[] = [];

  for (const block of blocks) {
    const p = block.prelude.trim();
    if (p.startsWith("@")) {
      const at = p.match(/^@([a-zA-Z-]+)/i)?.[1]?.toLowerCase();
      if (at === "media" || at === "supports" || at === "container") {
        const nested = parseCssBlocks(block.body);
        const inner = extractMatchingFromBlocks(
          nested,
          selectors,
          knownKeyframes,
          utilCatalog,
        );
        if (inner.rules.length) {
          rules.push(
            `${p} {\n${inner.rules.map((r) => indentBlock(r, 2)).join("\n\n")}\n}`,
          );
          for (const k of inner.keyframes) keyframes.add(k);
          utilTextParts.push(...inner.rules);
        }
      }
      continue;
    }

    if (selectorListMatches(p, selectors)) {
      rules.push(block.full);
      utilTextParts.push(block.full);
      for (const k of findReferencedKeyframes(block.full, knownKeyframes)) {
        keyframes.add(k);
      }
    }
  }

  const utils = detectSharedUtilHits(utilTextParts.join("\n"), utilCatalog);
  return { rules, keyframes, utils };
}

function indentBlock(text: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => (line.trim() ? pad + line : line))
    .join("\n");
}

function extractRootBlock(blocks: CssBlock[]): string | null {
  for (const b of blocks) {
    if (b.prelude.trim() === ":root") return b.full;
  }
  return null;
}

/**
 * Pull CSS rules whose selectors match any of the given prefixes/classes.
 * Handles nested rules inside @media/@supports, related @keyframes, and
 * shared utilities when referenced.
 */
export function extractCssBySelectors(
  cssSource: string,
  selectors: string[],
  options?: {
    extraScanText?: string;
    sharedUtilSelectors?: readonly string[];
  },
): string {
  if (!selectors.length) return "/* no css selectors mapped */\n";

  const utilCatalog = options?.sharedUtilSelectors ?? SHARED_UTIL_SELECTORS;
  const blocks = parseCssBlocks(cssSource);
  const knownKeyframes = listKeyframeNames(blocks);

  const primary = extractMatchingFromBlocks(
    blocks,
    selectors,
    knownKeyframes,
    utilCatalog,
  );

  const utilSelectors = new Set<string>(primary.utils);
  if (options?.extraScanText) {
    for (const u of detectSharedUtilHits(options.extraScanText, utilCatalog)) {
      utilSelectors.add(u);
    }
  }

  const utilList = [...utilSelectors].filter(
    (u) => !selectors.some((s) => s === u || u.startsWith(s)),
  );

  let utilRules: string[] = [];
  const moreKeyframes = new Set<string>(primary.keyframes);

  if (utilList.length) {
    const secondary = extractMatchingFromBlocks(
      blocks,
      utilList,
      knownKeyframes,
    );
    const primarySet = new Set(primary.rules);
    utilRules = secondary.rules.filter((r) => !primarySet.has(r));
    for (const k of secondary.keyframes) moreKeyframes.add(k);
  }

  const keyframeRules: string[] = [];
  for (const block of blocks) {
    const m = block.prelude.match(/^@(-webkit-)?keyframes\s+([^\s{]+)/i);
    if (m && moreKeyframes.has(m[2]!)) {
      keyframeRules.push(block.full);
    }
  }

  const sectionRules = primary.rules;
  if (!sectionRules.length && !utilRules.length) {
    return `/* No matching rules for: ${selectors.join(", ")} */\n`;
  }

  const parts: string[] = [];
  const root = extractRootBlock(blocks);
  if (root) {
    parts.push("/* Design tokens */", root, "");
  }
  if (utilRules.length) {
    parts.push("/* Shared utilities referenced by this section */");
    parts.push(utilRules.join("\n\n"), "");
  }
  parts.push("/* Section rules */");
  parts.push(sectionRules.join("\n\n"));
  if (keyframeRules.length) {
    parts.push("", "/* Related keyframes */", keyframeRules.join("\n\n"));
  }

  return parts.join("\n").trim() + "\n";
}

// ---------------------------------------------------------------------------
// Import graph
// ---------------------------------------------------------------------------

/**
 * Resolve an import specifier to a project-relative path when possible.
 * `@/` maps to `src/`. Relative imports resolve against `fromFile`.
 */
export function resolveImportSpecifier(
  specifier: string,
  fromFile: string,
): string | null {
  if (specifier.startsWith("@/")) {
    return normalizePosix(`src/${specifier.slice(2)}`);
  }
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const baseDir = dirname(fromFile);
    const joined = normalize(join(baseDir, specifier));
    return normalizePosix(joined);
  }
  return null;
}

function normalizePosix(p: string): string {
  return p.replace(/\\/g, "/");
}

/**
 * Parse static / export-from / dynamic imports from TS/TSX source.
 * Resolves `@/` and relative paths to project-relative paths.
 */
export function buildImportGraph(
  componentSource: string,
  componentPath: string,
): ImportGraph {
  const edges: ImportEdge[] = [];
  const seen = new Set<string>();

  const push = (edge: ImportEdge) => {
    const key = `${edge.kind}|${edge.specifier}|${edge.isTypeOnly}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push(edge);
  };

  const importRe =
    /(?:^|\n)\s*import\s+(type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]\s*;?/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(componentSource))) {
    const isTypeOnly = Boolean(m[1]);
    const specifier = m[2]!;
    push({
      specifier,
      resolved: resolveImportSpecifier(specifier, componentPath),
      kind: "import",
      isTypeOnly,
    });
  }

  const exportFromRe =
    /(?:^|\n)\s*export\s+(type\s+)?(?:\*|\{[\s\S]*?\})\s+from\s+['"]([^'"]+)['"]\s*;?/g;
  while ((m = exportFromRe.exec(componentSource))) {
    const isTypeOnly = Boolean(m[1]);
    const specifier = m[2]!;
    push({
      specifier,
      resolved: resolveImportSpecifier(specifier, componentPath),
      kind: "export-from",
      isTypeOnly,
    });
  }

  const dynamicRe = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = dynamicRe.exec(componentSource))) {
    const specifier = m[1]!;
    push({
      specifier,
      resolved: resolveImportSpecifier(specifier, componentPath),
      kind: "dynamic",
      isTypeOnly: false,
    });
  }

  const projectDeps = [
    ...new Set(
      edges
        .map((e) => e.resolved)
        .filter((r): r is string => Boolean(r)),
    ),
  ].sort();

  return { entry: componentPath, edges, projectDeps };
}

// ---------------------------------------------------------------------------
// Pack assembly
// ---------------------------------------------------------------------------

function mergeBuildOptions(
  config?: SectionPackConfig,
  options?: BuildSectionPackOptions,
): Required<
  Pick<BuildSectionPackOptions, "cwd">
> &
  BuildSectionPackOptions {
  return {
    cwd: options?.cwd ?? process.cwd(),
    sharedUtilSelectors:
      options?.sharedUtilSelectors ??
      config?.sharedUtilSelectors ??
      SHARED_UTIL_SELECTORS,
    resolveComponentImport:
      options?.resolveComponentImport ??
      config?.resolveComponentImport ??
      resolveDefaultComponentImport,
    behaviorSpecs: {
      ...(config?.behaviorSpecs ?? {}),
      ...(options?.behaviorSpecs ?? {}),
    },
    defaultVariables: {
      ...(config?.defaultVariables ?? {}),
      ...(options?.defaultVariables ?? {}),
    },
  };
}

/** Build a section pack from an entry (+ optional host config). */
export function buildSectionPack(
  entry: SectionPackEntry,
  configOrOptions?: SectionPackConfig | BuildSectionPackOptions,
  maybeOptions?: BuildSectionPackOptions,
): SectionPack {
  // Support buildSectionPack(entry, options) and buildSectionPack(entry, config, options)
  let config: SectionPackConfig | undefined;
  let options: BuildSectionPackOptions | undefined;
  if (
    configOrOptions &&
    "sections" in configOrOptions &&
    Array.isArray(configOrOptions.sections)
  ) {
    config = configOrOptions;
    options = maybeOptions;
  } else {
    options = configOrOptions as BuildSectionPackOptions | undefined;
  }

  const opts = mergeBuildOptions(config, options);
  const cwd = opts.cwd!;
  const sharedUtilSelectors = opts.sharedUtilSelectors!;
  const resolveComponentImport = opts.resolveComponentImport!;

  const files: Record<string, string> = {};
  const related: Record<string, string> = {};
  const fileTree: FileTreeEntry[] = [];

  const component =
    safeRead(cwd, entry.componentPath) ?? `// missing ${entry.componentPath}`;
  files[entry.componentPath] = component;
  fileTree.push({
    path: entry.componentPath,
    role: "component",
    bytes: utf8Bytes(component),
  });

  let content = "// no content module\n";
  if (entry.contentModulePath) {
    const mod = safeRead(cwd, entry.contentModulePath) ?? "";
    files[entry.contentModulePath] = mod;
    content =
      entry.contentKeys.length > 0
        ? extractContentKeys(mod, entry.contentKeys)
        : mod;
    fileTree.push({
      path: entry.contentModulePath,
      role: "content",
      bytes: utf8Bytes(mod),
    });
  }

  const cssFull = safeRead(cwd, entry.cssModulePath) ?? "";
  files[entry.cssModulePath] = cssFull;
  fileTree.push({
    path: entry.cssModulePath,
    role: "css",
    bytes: utf8Bytes(cssFull),
  });

  const css = extractCssBySelectors(cssFull, entry.cssSelectors, {
    extraScanText: `${component}\n${content}`,
    sharedUtilSelectors,
  });

  for (const rel of entry.relatedPaths ?? []) {
    const src = safeRead(cwd, rel);
    if (src != null) {
      related[rel] = src;
      files[rel] = src;
      fileTree.push({ path: rel, role: "related", bytes: utf8Bytes(src) });
    }
  }

  fileTree.sort((a, b) => a.path.localeCompare(b.path));

  const importGraph = buildImportGraph(component, entry.componentPath);
  const componentImportPath = resolveComponentImport(entry);

  const templateSnippet = [
    `// Section pack: ${entry.id} (${entry.label})`,
    `// Role: ${entry.promptRole}`,
    `import { ${entry.componentExport} } from "${componentImportPath}";`,
    "",
    `export function Example() {`,
    `  return <${entry.componentExport} />;`,
    `}`,
    "",
  ].join("\n");

  const promptMarkdown = buildPromptMarkdown(entry, {
    component,
    content,
    css,
    related,
    templateSnippet,
    importGraph,
    fileTree,
  });

  const promptShortMarkdown = buildPromptShortMarkdown(entry, {
    component,
    content,
    css,
    related,
    templateSnippet,
    importGraph,
    fileTree,
  });

  const contentHash = hashPackSurfaces(component, content, css);

  const cursorRuleMarkdown = buildCursorRuleMarkdown(entry, {
    component,
    content,
    css,
    templateSnippet,
    importGraph,
    fileTree,
    contentHash,
    sharedUtilSelectors,
  });

  // Auto-draft fills incomplete behavior fields from component + CSS analysis.
  // Hand-authored entry.behavior and DEMO/registry specs win per non-empty field.
  const drafted = draftBehaviorBrief(entry, {
    cwd,
    componentSource: component,
    cssSource: css || cssFull,
    behaviorSpecs: opts.behaviorSpecs,
  });
  const behaviorBriefMarkdown = buildBehaviorBriefMarkdown(
    entry,
    {
      id: entry.id,
      label: entry.label,
      tags: entry.tags,
      contentHash,
      fileTree,
      importGraph,
    },
    {
      behaviorSpecs: opts.behaviorSpecs,
      resolvedBehavior: drafted.brief,
    },
  );

  const filesBytes: Record<string, number> = {};
  let totalFiles = 0;
  for (const [path, src] of Object.entries(files)) {
    const n = utf8Bytes(src);
    filesBytes[path] = n;
    totalFiles += n;
  }

  let relatedBytes = 0;
  for (const src of Object.values(related)) relatedBytes += utf8Bytes(src);

  const byteSizes: PackByteSizes = {
    component: utf8Bytes(component),
    content: utf8Bytes(content),
    css: utf8Bytes(css),
    related: relatedBytes,
    prompt: utf8Bytes(promptMarkdown),
    promptShort: utf8Bytes(promptShortMarkdown),
    totalFiles,
    files: filesBytes,
  };

  return {
    id: entry.id,
    label: entry.label,
    description: entry.description,
    tags: entry.tags,
    promptRole: entry.promptRole,
    files,
    component,
    content,
    css,
    related,
    promptMarkdown,
    promptShortMarkdown,
    behaviorBriefMarkdown,
    cursorRuleMarkdown,
    templateSnippet,
    generatedAt: new Date().toISOString(),
    contentHash,
    fileTree,
    byteSizes,
    importGraph,
  };
}

/** Build pack by id from a host config. */
export function buildSectionPackById(
  config: SectionPackConfig,
  id: string,
  options?: BuildSectionPackOptions,
): SectionPack {
  const entry = config.sections.find((s) => s.id === id);
  if (!entry) {
    throw new Error(`buildSectionPackById: unknown id: ${id}`);
  }
  return buildSectionPack(entry, config, options);
}

function formatImportGraphMd(graph: ImportGraph): string {
  if (!graph.edges.length) return "_No imports detected_";
  const lines = graph.edges.map((e) => {
    const typeTag = e.isTypeOnly ? " (type)" : "";
    const res = e.resolved ? ` -> \`${e.resolved}\`` : " (package)";
    return `- \`${e.specifier}\`${typeTag}${res} [${e.kind}]`;
  });
  return lines.join("\n");
}

function formatFileTreeMd(tree: FileTreeEntry[]): string {
  if (!tree.length) return "_Empty_";
  return tree
    .map((f) => `- \`${f.path}\` (${f.role}, ${f.bytes} bytes)`)
    .join("\n");
}

function buildPromptMarkdown(
  entry: SectionPackEntry,
  parts: {
    component: string;
    content: string;
    css: string;
    related: Record<string, string>;
    templateSnippet: string;
    importGraph: ImportGraph;
    fileTree: FileTreeEntry[];
  },
): string {
  const relatedBlocks = Object.entries(parts.related)
    .map(
      ([path, src]) =>
        `### \`${path}\`\n\n\`\`\`tsx\n${src}\n\`\`\``,
    )
    .join("\n\n");

  return `# Section pack: ${entry.label} (\`${entry.id}\`)

## Role
${entry.promptRole}

## Description
${entry.description}

## Tags
${entry.tags.map((t) => `\`${t}\``).join(", ")}

## File tree
${formatFileTreeMd(parts.fileTree)}

## Import graph (\`${parts.importGraph.entry}\`)
${formatImportGraphMd(parts.importGraph)}

## How to use this in a prompt
1. Paste this entire pack into your coding agent.
2. Ask it to adapt the section to your product (copy, brand tokens, routes).
3. Keep the interaction model and structure unless you explicitly want changes.

## Drop-in template

\`\`\`tsx
${parts.templateSnippet}
\`\`\`

## Component (\`${entry.componentPath}\`)

\`\`\`tsx
${parts.component}
\`\`\`

## Content data

\`\`\`ts
${parts.content}
\`\`\`

## Styles (extracted)

\`\`\`css
${parts.css}
\`\`\`

## Related files
${relatedBlocks || "_None_"}

---
_Generated by CtrlC SectionPack_
`;
}

function buildPromptShortMarkdown(
  entry: SectionPackEntry,
  parts: {
    component: string;
    content: string;
    css: string;
    related: Record<string, string>;
    templateSnippet: string;
    importGraph: ImportGraph;
    fileTree: FileTreeEntry[];
  },
): string {
  const depList = parts.importGraph.projectDeps.length
    ? parts.importGraph.projectDeps.map((p) => `\`${p}\``).join(", ")
    : "_none_";
  const relatedPaths = Object.keys(parts.related);
  const treeOneLiner = parts.fileTree
    .map((f) => `${f.path}(${f.bytes}b)`)
    .join(" | ");

  return `# Section \`${entry.id}\` - ${entry.label}

**Role:** ${entry.promptRole}
**Tags:** ${entry.tags.join(", ")}
**Desc:** ${entry.description}

**Files:** ${treeOneLiner || "(none)"}
**@/ deps:** ${depList}
**Related:** ${relatedPaths.length ? relatedPaths.map((p) => `\`${p}\``).join(", ") : "_none_"}

### Template
\`\`\`tsx
${parts.templateSnippet.trim()}
\`\`\`

### Component
\`\`\`tsx
${parts.component.trim()}
\`\`\`

### Content
\`\`\`ts
${parts.content.trim()}
\`\`\`

### CSS
\`\`\`css
${parts.css.trim()}
\`\`\`
`;
}

/**
 * Cursor-style project rule fragment (.mdc / AGENTS.md) for reusing this section
 * as a coding standard. Frontmatter mirrors common Cursor rule conventions.
 */
function buildCursorRuleMarkdown(
  entry: SectionPackEntry,
  parts: {
    component: string;
    content: string;
    css: string;
    templateSnippet: string;
    importGraph: ImportGraph;
    fileTree: FileTreeEntry[];
    contentHash: string;
    sharedUtilSelectors: readonly string[];
  },
): string {
  const depList = parts.importGraph.projectDeps.length
    ? parts.importGraph.projectDeps.map((p) => `- \`${p}\``).join("\n")
    : "- _none_";
  const tree = formatFileTreeMd(parts.fileTree);
  const globs = [
    entry.componentPath,
    entry.contentModulePath,
    entry.cssModulePath,
    ...(entry.relatedPaths ?? []),
  ]
    .filter(Boolean)
    .map((p) => `"${p}"`)
    .join(", ");

  const utilHint = parts.sharedUtilSelectors.slice(0, 6).map((s) => `\`${s}\``).join(", ");

  const maxEmbed = 12_000;
  const trimEmbed = (label: string, src: string, lang: string) => {
    if (src.length <= maxEmbed) {
      return `### ${label}\n\n\`\`\`${lang}\n${src.trim()}\n\`\`\``;
    }
    return `### ${label}\n\n\`\`\`${lang}\n${src.slice(0, maxEmbed).trim()}\n/* ... truncated; open full section pack for complete source ... */\n\`\`\``;
  };

  return `---
description: Section pack coding standard - ${entry.label} (${entry.id})
globs: [${globs}]
alwaysApply: false
sectionId: ${entry.id}
contentHash: ${parts.contentHash}
tags: [${entry.tags.map((t) => `"${t}"`).join(", ")}]
---

# Section rule: ${entry.label} (\`${entry.id}\`)

Use this rule when implementing or adapting the **${entry.label}** section.

## Role

${entry.promptRole}

## Intent

${entry.description}

## Source map

${tree}

## Project deps (\`@/\`)

${depList}

## Conventions

1. Prefer the component export \`${entry.componentExport}\` from \`${entry.componentPath}\`.
2. Keep content data in typed exports (${entry.contentKeys.length ? entry.contentKeys.map((k) => `\`${k}\``).join(", ") : "_inline / none_"}); do not hardcode long copy in JSX when a content key exists.
3. Scope new styles under the section selectors: ${entry.cssSelectors.map((s) => `\`${s}\``).join(", ")}. Reuse shared utilities (${utilHint || "project tokens"}) instead of inventing parallel primitives.
4. Preserve interaction model, structure, and accessibility patterns unless the task explicitly changes them.
5. When asking an agent to restyle or port this section, attach the full prompt pack (\`format=prompt\`) or this rule plus the template below.

## Drop-in template

\`\`\`tsx
${parts.templateSnippet.trim()}
\`\`\`

## Reference sources

${trimEmbed("Component", parts.component, "tsx")}

${trimEmbed("Content", parts.content, "ts")}

${trimEmbed("CSS extract", parts.css, "css")}

---
_contentHash \`${parts.contentHash}\` - CtrlC SectionPack rule_
`;
}

/** Formats that receive brand / section `{{var}}` substitution. */
const VARIABLE_FORMATS = new Set<CopyFormat>([
  "prompt",
  "prompt-short",
  "describe",
  "cursor-rule",
]);

/**
 * Format a pack for copy/download.
 * When `vars` is provided (or defaults are used via `applyVars`), prompt-like
 * formats substitute `{{productName}}`, `{{sectionId}}`, `{{sectionLabel}}`, etc.
 */
export function formatPackForCopy(
  pack: SectionPack,
  format: CopyFormat,
  vars?: PackVariables | null,
  options?: {
    applyVars?: boolean;
    defaultVariables?: PackVariables;
    injectBrand?: boolean;
  },
): string {
  const applyVars =
    options?.applyVars !== false &&
    (VARIABLE_FORMATS.has(format) || format === "json");
  const resolved = applyVars
    ? mergePackVariables(
        {
          ...(vars ?? {}),
          sectionId: pack.id,
          sectionLabel: pack.label,
        },
        options?.defaultVariables,
      )
    : null;

  const withVars = (text: string) =>
    resolved
      ? applyPromptVariablePipeline(text, resolved, {
          injectBrand: options?.injectBrand,
        })
      : text;

  switch (format) {
    case "component":
      return pack.component;
    case "content":
      return pack.content;
    case "css":
      return pack.css;
    case "template":
      return pack.templateSnippet;
    case "prompt":
      return withVars(pack.promptMarkdown);
    case "prompt-short":
      return withVars(pack.promptShortMarkdown);
    case "describe":
      return withVars(pack.behaviorBriefMarkdown);
    case "cursor-rule":
      return withVars(pack.cursorRuleMarkdown);
    case "zip":
      // Binary format handled by buildSectionZip at the API layer
      return pack.promptMarkdown;
    case "json": {
      const promptMarkdown = withVars(pack.promptMarkdown);
      const promptShortMarkdown = withVars(pack.promptShortMarkdown);
      const behaviorBriefMarkdown = withVars(pack.behaviorBriefMarkdown);
      const cursorRuleMarkdown = withVars(pack.cursorRuleMarkdown);
      return JSON.stringify(
        {
          id: pack.id,
          label: pack.label,
          description: pack.description,
          tags: pack.tags,
          promptRole: pack.promptRole,
          contentHash: pack.contentHash,
          files: Object.keys(pack.files),
          fileTree: pack.fileTree,
          byteSizes: pack.byteSizes,
          importGraph: pack.importGraph,
          generatedAt: pack.generatedAt,
          variables: resolved,
          component: pack.component,
          content: pack.content,
          css: pack.css,
          templateSnippet: pack.templateSnippet,
          promptMarkdown,
          promptShortMarkdown,
          behaviorBriefMarkdown,
          cursorRuleMarkdown,
        },
        null,
        2,
      );
    }
    default:
      return withVars(pack.promptMarkdown);
  }
}

export function parseCopyFormat(raw: string | null): CopyFormat | null {
  const format = (raw || "json") as CopyFormat;
  if (!COPY_FORMATS.includes(format)) return null;
  return format;
}
