/**
 * Parallel section build plan from docs/research/components/*.spec.md.
 * Emits ordered sections + agent batches (worktrees optional, not executed).
 */

import fs from "node:fs";
import path from "node:path";
import { pascalFromId } from "./ir-to-specs";

/** Default relative path for filled section specs. */
export const DEFAULT_SPECS_DIR = "docs/research/components";

/** Default section-builder prompt hint (monorepo or host-copied). */
export const DEFAULT_PROMPT_PATH_HINT = "docs/templates/section-builder.prompt.md";

/** Default max concurrent builders per batch. */
export const DEFAULT_MAX_AGENTS = 4;

/** Chrome / shell ids preferred earlier in the plan (independent of body). */
const CHROME_ORDER: string[] = [
  "promo",
  "promo-bar",
  "announcement",
  "banner",
  "nav",
  "navbar",
  "header",
  "site-header",
  "footer",
  "site-footer",
];

export type ParallelPlanSection = {
  id: string;
  /** Relative to cwd when possible, else absolute. */
  specPath: string;
  componentPath: string;
  exportName: string;
  promptPathHint: string;
};

export type ParallelPlan = {
  sections: ParallelPlanSection[];
  /** Section ids per concurrent batch (length <= maxAgents each). */
  batches: string[][];
  specsDir: string;
  maxAgents: number;
};

export type BuildParallelPlanOptions = {
  /** Absolute or cwd-relative directory of *.spec.md files. */
  specsDir: string;
  /** Project root for relative path output (default: process.cwd()). */
  cwd?: string;
  /** Max concurrent builders per batch (default 4). */
  maxAgents?: number;
  /** Component dir under cwd (default src/components/sections). */
  componentDir?: string;
  /** Hint path to section-builder.prompt.md. */
  promptPathHint?: string;
};

/**
 * Resolve section id from filename (preferred) or Meta table / heading.
 */
export function extractSpecId(filePath: string, markdown?: string): string {
  const base = path.basename(filePath);
  const fromName = base.replace(/\.spec\.md$/i, "").replace(/\.md$/i, "");
  if (fromName && fromName !== base) {
    if (/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(fromName)) {
      return fromName;
    }
  }

  const text = typeof markdown === "string" ? markdown : "";
  const get = (re: RegExp) => {
    const m = text.match(re);
    return m?.[1]?.trim();
  };

  const fromTable =
    get(/\|\s*\*\*id\*\*\s*\|\s*`?([^`|\n]+)`?\s*\|/i) ||
    get(/\|\s*id\s*\|\s*`?([^`|\n]+)`?\s*\|/i);
  if (fromTable) return fromTable.replace(/`/g, "").trim();

  const fromHeading =
    get(/^#\s+Section spec:\s*`?([^`\n]+)`?/m) ||
    get(/^#\s+(.+?)\s+Specification/m);
  if (fromHeading) {
    return fromHeading
      .replace(/`/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
  }

  if (fromName) return fromName;
  throw new Error(`Could not resolve section id from ${filePath}`);
}

/**
 * Sort key: chrome-like ids first (stable among chrome), then body alpha.
 */
function sectionSortKey(id: string): [number, string] {
  const lower = id.toLowerCase();
  const chromeIdx = CHROME_ORDER.indexOf(lower);
  if (chromeIdx >= 0) return [0, String(chromeIdx).padStart(3, "0")];
  // fuzzy: *header*, *footer*, *promo*, *nav*
  if (/(^|-)(promo|header|footer|nav|navbar)(-|$)/i.test(lower)) {
    return [0, `9-${lower}`];
  }
  return [1, lower];
}

/**
 * Chunk ordered ids into batches of at most maxAgents.
 */
export function batchSectionIds(
  ids: string[],
  maxAgents: number,
): string[][] {
  const n = Math.max(1, Math.floor(maxAgents) || DEFAULT_MAX_AGENTS);
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += n) {
    batches.push(ids.slice(i, i + n));
  }
  return batches;
}

function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

/**
 * Relativize abs path to cwd; fall back to posix abs.
 */
function relToCwd(abs: string, cwd: string): string {
  const rel = path.relative(cwd, abs);
  if (!rel || rel.startsWith("..")) {
    return toPosix(abs);
  }
  return toPosix(rel);
}

/**
 * Scan *.spec.md under specsDir and build a parallel dispatch plan.
 */
export function buildParallelPlan(
  options: BuildParallelPlanOptions,
): ParallelPlan {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const specsDirRaw = options.specsDir;
  if (!specsDirRaw || !String(specsDirRaw).trim()) {
    throw new Error("buildParallelPlan: specsDir is required");
  }
  const specsDir = path.isAbsolute(specsDirRaw)
    ? specsDirRaw
    : path.resolve(cwd, specsDirRaw);
  const maxAgents = Math.max(
    1,
    Number(options.maxAgents) > 0
      ? Math.floor(Number(options.maxAgents))
      : DEFAULT_MAX_AGENTS,
  );
  const componentDir = toPosix(
    (options.componentDir || "src/components/sections").replace(/\/$/, ""),
  );
  const promptPathHint = toPosix(
    options.promptPathHint || DEFAULT_PROMPT_PATH_HINT,
  );

  if (!fs.existsSync(specsDir)) {
    throw new Error(`Specs directory not found: ${specsDir}`);
  }
  if (!fs.statSync(specsDir).isDirectory()) {
    throw new Error(`Specs path is not a directory: ${specsDir}`);
  }

  const names = fs
    .readdirSync(specsDir)
    .filter((n) => n.toLowerCase().endsWith(".spec.md"))
    .sort((a, b) => a.localeCompare(b));

  /** @type {ParallelPlanSection[]} */
  const sections: ParallelPlanSection[] = [];

  for (const name of names) {
    const abs = path.join(specsDir, name);
    if (!fs.statSync(abs).isFile()) continue;
    let markdown = "";
    try {
      markdown = fs.readFileSync(abs, "utf8");
    } catch {
      markdown = "";
    }
    const id = extractSpecId(abs, markdown);
    const exportName = pascalFromId(id);
    sections.push({
      id,
      specPath: relToCwd(abs, cwd),
      componentPath: `${componentDir}/${exportName}.tsx`,
      exportName,
      promptPathHint,
    });
  }

  sections.sort((a, b) => {
    const [ta, ka] = sectionSortKey(a.id);
    const [tb, kb] = sectionSortKey(b.id);
    if (ta !== tb) return ta - tb;
    return ka.localeCompare(kb) || a.id.localeCompare(b.id);
  });

  const batches = batchSectionIds(
    sections.map((s) => s.id),
    maxAgents,
  );

  return {
    sections,
    batches,
    specsDir: relToCwd(specsDir, cwd),
    maxAgents,
  };
}

/**
 * Markdown checklist for humans / agents.
 */
export function formatParallelPlanMarkdown(plan: ParallelPlan): string {
  const lines: string[] = [
    `# Parallel section build plan`,
    ``,
    `Sections: **${plan.sections.length}** | maxAgents: **${plan.maxAgents}** | batches: **${plan.batches.length}**`,
    ``,
    `Specs dir: \`${plan.specsDir}\``,
    ``,
    `Use one builder per section after foundation is green. Prompt template:`,
    `\`${plan.sections[0]?.promptPathHint ?? DEFAULT_PROMPT_PATH_HINT}\``,
    ``,
    `Generate this plan:`,
    ``,
    "```bash",
    `ctrlc plan-parallel --cwd . --format md`,
    "```",
    ``,
    `## Sections checklist`,
    ``,
  ];

  if (!plan.sections.length) {
    lines.push(`_No \`*.spec.md\` files found._`);
    lines.push(``);
  } else {
    for (const s of plan.sections) {
      lines.push(
        `- [ ] \`${s.id}\` - \`${s.specPath}\` -> \`${s.componentPath}\` export \`${s.exportName}\``,
      );
      lines.push(`  - Prompt: \`${s.promptPathHint}\``);
    }
    lines.push(``);
  }

  lines.push(`## Batches (run one batch at a time; parallel within batch)`);
  lines.push(``);

  if (!plan.batches.length) {
    lines.push(`_No batches._`);
    lines.push(``);
  } else {
    plan.batches.forEach((batch, i) => {
      lines.push(`### Batch ${i + 1}`);
      lines.push(``);
      for (const id of batch) {
        const sec = plan.sections.find((s) => s.id === id);
        if (sec) {
          lines.push(
            `- \`${id}\` -> \`${sec.componentPath}\` (\`${sec.specPath}\`)`,
          );
        } else {
          lines.push(`- \`${id}\``);
        }
      }
      lines.push(``);
    });
  }

  lines.push(`## After each section`);
  lines.push(``);
  lines.push("```bash");
  lines.push(`ctrlc register <id> --cwd . \\`);
  lines.push(`  --component src/components/sections/<Name>.tsx \\`);
  lines.push(`  --export <Name> \\`);
  lines.push(`  --from-spec docs/research/components/<id>.spec.md`);
  lines.push(`ctrlc pack <id> --format describe --cwd .`);
  lines.push(`ctrlc pack <id> --format prompt-short --cwd .`);
  lines.push("```");
  lines.push(``);
  lines.push(`Optional worktrees: use \`ctrlc plan-parallel --format sh\`.`);
  lines.push(``);

  return lines.join("\n");
}

/**
 * Shell script with optional worktree comments + per-section echoes.
 * Does not execute git worktree.
 */
export function formatParallelPlanShell(plan: ParallelPlan): string {
  const lines: string[] = [
    `#!/usr/bin/env bash`,
    `# Parallel section build plan (generated by ctrlc plan-parallel)`,
    `# Specs: ${plan.specsDir} | sections: ${plan.sections.length} | maxAgents: ${plan.maxAgents}`,
    `#`,
    `# Optional git worktrees (not required - agents can share one tree carefully):`,
  ];

  for (const s of plan.sections) {
    const branch = `build/${s.id}`;
    const wt = `../clone-wt-${s.id}`;
    lines.push(`# git worktree add ${wt} -b ${branch}`);
  }

  lines.push(`#`);
  lines.push(`set -euo pipefail`);
  lines.push(``);

  if (!plan.batches.length) {
    lines.push(`echo "No specs found under ${plan.specsDir}"`);
    lines.push(``);
    return lines.join("\n");
  }

  plan.batches.forEach((batch, i) => {
    lines.push(`# --- Batch ${i + 1} (up to ${plan.maxAgents} parallel agents) ---`);
    for (const id of batch) {
      const sec = plan.sections.find((s) => s.id === id);
      if (!sec) {
        lines.push(`echo "Build section: ${id}"`);
        continue;
      }
      lines.push(
        `echo "Build section: ${sec.id} -> ${sec.componentPath} (spec: ${sec.specPath})"`,
      );
      lines.push(
        `echo "  prompt: ${sec.promptPathHint}  export: ${sec.exportName}"`,
      );
    }
    lines.push(`echo "Batch ${i + 1} done - register + dual-export smoke before next batch"`);
    lines.push(``);
  });

  lines.push(`echo "All batches listed. Merge page.tsx / content / CSS after builders finish."`);
  lines.push(``);
  return lines.join("\n");
}

/**
 * Machine-readable JSON string (pretty).
 */
export function formatParallelPlanJson(plan: ParallelPlan): string {
  return JSON.stringify(
    {
      specsDir: plan.specsDir,
      maxAgents: plan.maxAgents,
      sectionCount: plan.sections.length,
      batchCount: plan.batches.length,
      sections: plan.sections,
      batches: plan.batches,
    },
    null,
    2,
  );
}

/**
 * Format plan for CLI --format json|md|sh.
 */
export function formatParallelPlan(
  plan: ParallelPlan,
  format: "json" | "md" | "sh" = "md",
): string {
  switch (format) {
    case "json":
      return formatParallelPlanJson(plan);
    case "sh":
      return formatParallelPlanShell(plan);
    case "md":
    default:
      return formatParallelPlanMarkdown(plan);
  }
}
