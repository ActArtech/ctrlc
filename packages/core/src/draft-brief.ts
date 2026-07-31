/**
 * Auto-draft BehaviorBriefSpec from section sources, merging hand-authored fields
 * (entry.behavior / registry) over heuristic analysis.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, normalize } from "node:path";
import type {
  BehaviorBriefSpec,
  SectionPackConfig,
  SectionPackEntry,
} from "./types";
import { getBehaviorSpec } from "./behavior-briefs";
import {
  analyzeSectionSources,
  type AnalyzeSectionResult,
} from "./analyze-section";

export type DraftBehaviorBriefOptions = {
  /** Project root for reading component/css when sources not passed. */
  cwd?: string;
  /** Optional preloaded component source (skips disk read). */
  componentSource?: string;
  /** Optional preloaded CSS source (skips disk read). */
  cssSource?: string;
  /** Extra registry specs (same as BuildSectionPackOptions.behaviorSpecs). */
  behaviorSpecs?: Record<string, BehaviorBriefSpec>;
};

export type DraftBehaviorBriefResult = {
  brief: BehaviorBriefSpec;
  /** True when any field came from analysis rather than hand-authored sources. */
  usedAnalysis: boolean;
  analysis: AnalyzeSectionResult | null;
  notes: string[];
};

const STRING_FIELDS = ["whatItIs", "function"] as const;
const ARRAY_FIELDS = [
  "behavior",
  "motion",
  "layout",
  "color",
  "type",
  "responsive",
  "a11y",
  "influences",
  "rebuildGuidance",
] as const;

function resolvePath(cwd: string, rel: string): string {
  const cleaned = rel.replace(/\\/g, "/").replace(/^\.?\//, "");
  return normalize(join(cwd, cleaned));
}

function safeRead(cwd: string, rel: string): string | null {
  try {
    const abs = resolvePath(cwd, rel);
    if (!existsSync(abs)) return null;
    return readFileSync(abs, "utf8");
  } catch {
    return null;
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isNonEmptyStringArray(v: unknown): v is string[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every((item) => typeof item === "string" && item.trim().length > 0)
  );
}

/** True when a brief field is missing or empty. */
export function isBriefFieldEmpty(
  spec: Partial<BehaviorBriefSpec> | undefined | null,
  field: keyof BehaviorBriefSpec,
): boolean {
  if (!spec) return true;
  const v = spec[field];
  if (field === "id" || field === "whatItIs" || field === "function") {
    return !isNonEmptyString(v);
  }
  return !isNonEmptyStringArray(v);
}

/** True when the brief is missing or any required field is empty. */
export function isBehaviorBriefIncomplete(
  spec: Partial<BehaviorBriefSpec> | undefined | null,
): boolean {
  if (!spec) return true;
  if (!isNonEmptyString(spec.id)) return true;
  for (const f of STRING_FIELDS) {
    if (!isNonEmptyString(spec[f])) return true;
  }
  for (const f of ARRAY_FIELDS) {
    if (!isNonEmptyStringArray(spec[f])) return true;
  }
  return false;
}

/**
 * Merge brief layers. Later layers win for non-empty fields.
 * Empty strings / empty arrays in a higher layer do not erase a lower value.
 */
export function mergeBehaviorBriefLayers(
  ...layers: Array<Partial<BehaviorBriefSpec> | undefined | null>
): Partial<BehaviorBriefSpec> {
  const out: Partial<BehaviorBriefSpec> = {};
  for (const layer of layers) {
    if (!layer) continue;
    if (isNonEmptyString(layer.id)) out.id = layer.id;

    for (const f of STRING_FIELDS) {
      if (isNonEmptyString(layer[f])) out[f] = layer[f]!.trim();
    }
    for (const f of ARRAY_FIELDS) {
      if (isNonEmptyStringArray(layer[f])) {
        out[f] = layer[f]!.map((s) => s.trim()).filter(Boolean);
      }
    }
  }
  return out;
}

function emptyBrief(id: string): BehaviorBriefSpec {
  return {
    id,
    whatItIs: "",
    function: "",
    behavior: [],
    motion: [],
    layout: [],
    color: [],
    type: [],
    responsive: [],
    a11y: [],
    influences: [],
    rebuildGuidance: [],
  };
}

/** Default reduced-motion guidance injected into drafted briefs (F5). */
export const DEFAULT_REDUCED_MOTION_NOTE =
  "Honor prefers-reduced-motion: disable or simplify non-essential animation; provide static fallbacks.";

const REDUCED_MOTION_RE = /reduced[- ]?motion|prefers-reduced-motion/i;

/** True when any line already mentions reduced motion. */
export function mentionsReducedMotion(
  lines: string[] | undefined | null,
): boolean {
  return (lines ?? []).some((l) => REDUCED_MOTION_RE.test(l));
}

/**
 * Ensure motion or a11y includes at least one reduced-motion note.
 * Prefers appending to `motion` when that field looks non-static; else `a11y`.
 */
export function ensureReducedMotionNotes(
  motion: string[],
  a11y: string[],
): { motion: string[]; a11y: string[] } {
  if (mentionsReducedMotion(motion) || mentionsReducedMotion(a11y)) {
    return { motion, a11y };
  }
  const motionLooksActive = motion.some(
    (m) =>
      !/no (strong )?motion|static chrome|no motion specified|minimal motion|mostly static/i.test(
        m,
      ),
  );
  if (motionLooksActive) {
    return { motion: [...motion, DEFAULT_REDUCED_MOTION_NOTE], a11y };
  }
  return { motion, a11y: [...a11y, DEFAULT_REDUCED_MOTION_NOTE] };
}

function finalizeBrief(
  id: string,
  partial: Partial<BehaviorBriefSpec>,
  entry: SectionPackEntry,
): BehaviorBriefSpec {
  const base = emptyBrief(id);
  const merged = mergeBehaviorBriefLayers(base, partial, {
    id,
    // Last-resort identity if still empty
    whatItIs: isNonEmptyString(partial.whatItIs)
      ? partial.whatItIs
      : entry.description?.trim() || `${entry.label} section.`,
    function: isNonEmptyString(partial.function)
      ? partial.function
      : entry.promptRole?.trim() ||
        `Deliver the ${entry.label} page section experience.`,
  });

  const motion = merged.motion ?? ["No motion specified."];
  const a11y = merged.a11y ?? ["Meet baseline keyboard and name requirements."];
  const withRm = ensureReducedMotionNotes(motion, a11y);

  return {
    id,
    whatItIs: merged.whatItIs ?? `${entry.label} section.`,
    function:
      merged.function ??
      `Deliver the ${entry.label} page section experience.`,
    behavior: merged.behavior ?? ["Presentational section content."],
    motion: withRm.motion,
    layout: merged.layout ?? ["Standard document flow."],
    color: merged.color ?? ["Inherit project color tokens."],
    type: merged.type ?? ["Inherit project type scale."],
    responsive: merged.responsive ?? ["Follow project breakpoints."],
    a11y: withRm.a11y,
    influences: merged.influences ?? [
      `Component \`${entry.componentPath}\`.`,
    ],
    rebuildGuidance: merged.rebuildGuidance ?? [
      "Recreate as component + content + scoped styles.",
    ],
  };
}

/**
 * Draft a full BehaviorBriefSpec for an entry.
 * Priority (highest wins per non-empty field):
 *   1. entry.behavior (hand-authored on the entry)
 *   2. behaviorSpecs / DEMO registry via getBehaviorSpec
 *   3. heuristic analysis of component + CSS sources
 *   4. entry label/description/promptRole fallbacks
 */
export function draftBehaviorBrief(
  entry: SectionPackEntry,
  options?: DraftBehaviorBriefOptions,
): DraftBehaviorBriefResult {
  const cwd = options?.cwd ?? process.cwd();
  const notes: string[] = [];

  let componentSource = options?.componentSource;
  let cssSource = options?.cssSource;

  if (componentSource == null) {
    componentSource = safeRead(cwd, entry.componentPath) ?? "";
    if (!componentSource) {
      notes.push(`could not read componentPath: ${entry.componentPath}`);
    }
  }
  if (cssSource == null) {
    cssSource = safeRead(cwd, entry.cssModulePath) ?? "";
    if (!cssSource) {
      notes.push(`could not read cssModulePath: ${entry.cssModulePath}`);
    }
  }

  const analysis = analyzeSectionSources({
    componentSource,
    cssSource,
    entry,
  });
  notes.push(...analysis.notes);

  const registry = getBehaviorSpec(entry.id, options?.behaviorSpecs);
  if (registry) {
    notes.push("registry behavior spec applied (non-empty fields win over draft)");
  }
  if (entry.behavior) {
    notes.push("entry.behavior applied (highest priority non-empty fields)");
  }

  // Low -> high priority: analysis draft, registry, entry.behavior
  const merged = mergeBehaviorBriefLayers(
    analysis.draft,
    registry,
    entry.behavior,
  );

  const brief = finalizeBrief(entry.id, merged, entry);

  const usedAnalysis =
    !registry && !entry.behavior
      ? true
      : STRING_FIELDS.some(
          (f) =>
            isBriefFieldEmpty(entry.behavior, f) &&
            isBriefFieldEmpty(registry, f) &&
            !isBriefFieldEmpty(analysis.draft, f),
        ) ||
        ARRAY_FIELDS.some(
          (f) =>
            isBriefFieldEmpty(entry.behavior, f) &&
            isBriefFieldEmpty(registry, f) &&
            !isBriefFieldEmpty(analysis.draft, f),
        );

  return {
    brief,
    usedAnalysis,
    analysis,
    notes,
  };
}

/**
 * Return a new config where sections missing a complete `behavior` get an
 * auto-drafted brief. Existing complete entry.behavior is left as-is;
 * partial entry.behavior is filled field-by-field (hand fields win).
 */
export function enrichConfigWithDraftBriefs(
  config: SectionPackConfig,
  options?: { cwd?: string },
): SectionPackConfig {
  const cwd = options?.cwd ?? process.cwd();
  const behaviorSpecs = config.behaviorSpecs;

  const sections = config.sections.map((entry) => {
    // Resolve effective hand layer (entry + registry) without analysis first
    const hand = mergeBehaviorBriefLayers(
      getBehaviorSpec(entry.id, behaviorSpecs),
      entry.behavior,
    );
    if (!isBehaviorBriefIncomplete(hand)) {
      // Ensure entry.behavior is set so pack builders see a complete brief
      if (entry.behavior && !isBehaviorBriefIncomplete(entry.behavior)) {
        return entry;
      }
      return {
        ...entry,
        behavior: finalizeBrief(entry.id, hand, entry),
      };
    }

    const { brief } = draftBehaviorBrief(entry, {
      cwd,
      behaviorSpecs,
    });
    return { ...entry, behavior: brief };
  });

  return {
    ...config,
    sections,
  };
}

/**
 * Fill gaps on an entry's effective behavior using analysis of sources.
 * Hand-authored / registry non-empty fields always win.
 */
export function resolveEntryBehaviorBrief(
  entry: SectionPackEntry,
  options?: DraftBehaviorBriefOptions & {
    componentSource?: string;
    cssSource?: string;
  },
): BehaviorBriefSpec {
  return draftBehaviorBrief(entry, options).brief;
}
