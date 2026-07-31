/**
 * Section dependency graph for SectionPack configs.
 *
 * Nodes are sections. Edges capture:
 * - import: component A imports a path that maps to section B
 * - shared-content: same contentModulePath
 * - shared-css: same cssModulePath
 * - recipe: consecutive membership in a named recipe (order preserved)
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SectionPackConfig, SectionPackEntry } from "./types";
import { buildImportGraph } from "./build-section-pack";
import { listSectionEntries } from "./manifest";

export type SectionGraphEdgeKind =
  | "import"
  | "shared-content"
  | "shared-css"
  | "recipe";

export type SectionGraphNode = {
  id: string;
  label: string;
  tags: string[];
  /** Project-relative paths that define this section surface */
  paths: string[];
};

export type SectionGraphEdge = {
  from: string;
  to: string;
  kind: SectionGraphEdgeKind;
  /** Optional detail (recipe id, shared path, import specifier) */
  detail?: string;
};

export type SectionGraph = {
  nodes: SectionGraphNode[];
  edges: SectionGraphEdge[];
  /** Mermaid flowchart (LR) */
  mermaid: string;
};

export type BuildSectionGraphOptions = {
  /** Project root for reading component sources (default: process.cwd()) */
  cwd?: string;
};

function normalizePosix(p: string): string {
  return p.replace(/\\/g, "/");
}

/** Strip common source extensions and trailing /index for path keys. */
function pathKey(p: string): string {
  let s = normalizePosix(p).replace(/^\.\//, "");
  s = s.replace(/\.(tsx?|jsx?|mjs|cjs|css|scss|sass|less)$/i, "");
  s = s.replace(/\/index$/i, "");
  return s;
}

function safeRead(cwd: string, rel: string): string | null {
  const abs = join(cwd, rel);
  if (!existsSync(abs)) return null;
  try {
    return readFileSync(abs, "utf8");
  } catch {
    return null;
  }
}

function entryPaths(entry: SectionPackEntry): string[] {
  const out: string[] = [entry.componentPath];
  if (entry.contentModulePath) out.push(entry.contentModulePath);
  if (entry.cssModulePath) out.push(entry.cssModulePath);
  for (const r of entry.relatedPaths ?? []) out.push(r);
  // Stable unique, config order
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const p of out.map(normalizePosix)) {
    if (seen.has(p)) continue;
    seen.add(p);
    unique.push(p);
  }
  return unique;
}

/**
 * Map path keys -> section ids that "own" that path (component primary;
 * related paths also registered so shared Reveal.tsx imports resolve).
 */
function buildPathOwnerIndex(
  entries: SectionPackEntry[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const add = (path: string, sectionId: string) => {
    const key = pathKey(path);
    if (!key) return;
    const list = map.get(key) ?? [];
    if (!list.includes(sectionId)) list.push(sectionId);
    map.set(key, list);
  };

  for (const entry of entries) {
    add(entry.componentPath, entry.id);
    for (const rel of entry.relatedPaths ?? []) {
      add(rel, entry.id);
    }
    // Content / css ownership used only for shared-* edges, not import targets
  }
  return map;
}

function edgeKey(from: string, to: string, kind: SectionGraphEdgeKind, detail?: string): string {
  return `${kind}|${from}|${to}|${detail ?? ""}`;
}

/**
 * Build a section dependency graph from a host SectionPackConfig.
 */
export function buildSectionGraph(
  config: SectionPackConfig,
  options?: BuildSectionGraphOptions,
): SectionGraph {
  const cwd = options?.cwd ?? process.cwd();
  const entries = listSectionEntries(config);
  const idOrder = new Map(entries.map((e, i) => [e.id, i]));

  const nodes: SectionGraphNode[] = entries.map((e) => ({
    id: e.id,
    label: e.label,
    tags: [...e.tags],
    paths: entryPaths(e),
  }));

  const edges: SectionGraphEdge[] = [];
  const seen = new Set<string>();

  const pushEdge = (
    from: string,
    to: string,
    kind: SectionGraphEdgeKind,
    detail?: string,
  ) => {
    if (from === to) return;
    if (!idOrder.has(from) || !idOrder.has(to)) return;
    const key = edgeKey(from, to, kind, detail);
    if (seen.has(key)) return;
    seen.add(key);
    edges.push(detail ? { from, to, kind, detail } : { from, to, kind });
  };

  // --- shared-content / shared-css (ordered by config index) ---
  const byContent = new Map<string, string[]>();
  const byCss = new Map<string, string[]>();
  for (const e of entries) {
    if (e.contentModulePath) {
      const k = normalizePosix(e.contentModulePath);
      const list = byContent.get(k) ?? [];
      list.push(e.id);
      byContent.set(k, list);
    }
    if (e.cssModulePath) {
      const k = normalizePosix(e.cssModulePath);
      const list = byCss.get(k) ?? [];
      list.push(e.id);
      byCss.set(k, list);
    }
  }

  for (const [path, ids] of byContent) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        pushEdge(ids[i]!, ids[j]!, "shared-content", path);
      }
    }
  }
  for (const [path, ids] of byCss) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        pushEdge(ids[i]!, ids[j]!, "shared-css", path);
      }
    }
  }

  // --- recipe membership (consecutive section ids in recipe order) ---
  for (const recipe of config.recipes ?? []) {
    const ids = recipe.sectionIds.filter((id) => idOrder.has(id));
    for (let i = 0; i < ids.length - 1; i++) {
      pushEdge(ids[i]!, ids[i + 1]!, "recipe", recipe.id);
    }
  }

  // --- import edges from component sources ---
  const owners = buildPathOwnerIndex(entries);
  for (const entry of entries) {
    const source =
      safeRead(cwd, entry.componentPath) ??
      // Still parse empty graph when missing; no import edges
      "";
    if (!source) continue;

    const graph = buildImportGraph(source, entry.componentPath);
    for (const edge of graph.edges) {
      if (!edge.resolved) continue;
      const key = pathKey(edge.resolved);
      const targets = owners.get(key);
      if (!targets?.length) {
        // Try resolveImportSpecifier again with extension variants via owner keys
        // already covered by pathKey strip of .tsx
        continue;
      }
      for (const to of targets) {
        if (to === entry.id) continue;
        pushEdge(entry.id, to, "import", edge.specifier);
      }
    }
  }

  // Stable edge order: kind, from config order, to config order
  const kindOrder: Record<SectionGraphEdgeKind, number> = {
    import: 0,
    "shared-content": 1,
    "shared-css": 2,
    recipe: 3,
  };
  edges.sort((a, b) => {
    const k = kindOrder[a.kind] - kindOrder[b.kind];
    if (k !== 0) return k;
    const fo = (idOrder.get(a.from) ?? 0) - (idOrder.get(b.from) ?? 0);
    if (fo !== 0) return fo;
    return (idOrder.get(a.to) ?? 0) - (idOrder.get(b.to) ?? 0);
  });

  const mermaid = formatSectionGraphMermaid({ nodes, edges });

  return { nodes, edges, mermaid };
}

/** Escape / sanitize id for Mermaid node ids. */
function mermaidId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, "_");
}

/**
 * Render a Mermaid `graph LR` flowchart from nodes + edges.
 */
export function formatSectionGraphMermaid(
  graph: Pick<SectionGraph, "nodes" | "edges">,
): string {
  const lines: string[] = ["graph LR"];
  for (const n of graph.nodes) {
    const mid = mermaidId(n.id);
    const label = n.label.replace(/"/g, "'");
    lines.push(`  ${mid}["${label} (${n.id})"]`);
  }
  for (const e of graph.edges) {
    const from = mermaidId(e.from);
    const to = mermaidId(e.to);
    const tag = e.kind;
    lines.push(`  ${from} -->|${tag}| ${to}`);
  }
  return lines.join("\n") + "\n";
}

/**
 * Agent-friendly markdown summary of a section graph (nodes, edges, mermaid).
 */
export function formatSectionGraphMarkdown(graph: SectionGraph): string {
  const nodeLines = graph.nodes
    .map((n) => {
      const tags = n.tags.length ? n.tags.map((t) => `\`${t}\``).join(", ") : "_none_";
      const paths = n.paths.map((p) => `\`${p}\``).join(", ");
      return `- **\`${n.id}\`** ${n.label}  \n  Tags: ${tags}  \n  Paths: ${paths}`;
    })
    .join("\n");

  const edgeLines = graph.edges.length
    ? graph.edges
        .map((e) => {
          const detail = e.detail ? ` (\`${e.detail}\`)` : "";
          return `- \`${e.from}\` -> \`${e.to}\` [${e.kind}]${detail}`;
        })
        .join("\n")
    : "_No edges_";

  const byKind: Record<SectionGraphEdgeKind, number> = {
    import: 0,
    "shared-content": 0,
    "shared-css": 0,
    recipe: 0,
  };
  for (const e of graph.edges) byKind[e.kind]++;

  return `# Section dependency graph

**Nodes:** ${graph.nodes.length}
**Edges:** ${graph.edges.length} (import=${byKind.import}, shared-content=${byKind["shared-content"]}, shared-css=${byKind["shared-css"]}, recipe=${byKind.recipe})

## Nodes
${nodeLines}

## Edges
${edgeLines}

## Mermaid

\`\`\`mermaid
${graph.mermaid.trimEnd()}
\`\`\`

---
_Generated by CtrlC SectionPack_
`;
}
