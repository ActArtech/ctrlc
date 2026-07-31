/**
 * CLI-friendly validation for host SectionPackConfig.
 * Checks structure, unique ids, path existence, and behavior brief completeness.
 */

import { existsSync } from "node:fs";
import { join, normalize } from "node:path";
import type {
  BehaviorBriefSpec,
  SectionPackConfig,
  SectionPackEntry,
} from "./types";
import { getBehaviorSpec } from "./behavior-briefs";
import { SUPPORTED_SCHEMA_VERSION } from "./schema";

export type ValidateIssue = {
  level: "error" | "warning";
  code: string;
  message: string;
  sectionId?: string;
  path?: string;
};

export type ValidateSectionPackResult = {
  ok: boolean;
  errors: ValidateIssue[];
  warnings: ValidateIssue[];
};

export type ValidateSectionPackOptions = {
  /** Project root used to resolve component/content/css paths. Defaults to process.cwd(). */
  cwd?: string;
  /**
   * When true (default), missing files on disk are errors.
   * Set false for structure-only checks (no filesystem).
   */
  checkPaths?: boolean;
  /**
   * When true (default), require a non-empty behavior brief (entry.behavior,
   * config.behaviorSpecs, or package registry) for each section.
   */
  requireBehaviorBrief?: boolean;
};

const STRING_BRIEF_FIELDS: Array<keyof BehaviorBriefSpec> = [
  "whatItIs",
  "function",
];

const ARRAY_BRIEF_FIELDS: Array<keyof BehaviorBriefSpec> = [
  "behavior",
  "motion",
  "layout",
  "color",
  "type",
  "responsive",
  "a11y",
  "influences",
  "rebuildGuidance",
];

function issue(
  level: "error" | "warning",
  code: string,
  message: string,
  extra?: { sectionId?: string; path?: string },
): ValidateIssue {
  return {
    level,
    code,
    message,
    ...(extra?.sectionId ? { sectionId: extra.sectionId } : {}),
    ...(extra?.path ? { path: extra.path } : {}),
  };
}

function resolvePath(cwd: string, rel: string): string {
  const cleaned = rel.replace(/\\/g, "/").replace(/^\.?\//, "");
  return normalize(join(cwd, cleaned));
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

/**
 * Validate a BehaviorBriefSpec has required non-empty fields.
 * Returns error issues (caller can re-level if needed).
 */
export function validateBehaviorBrief(
  spec: BehaviorBriefSpec | undefined | null,
  sectionId: string,
): ValidateIssue[] {
  const out: ValidateIssue[] = [];
  if (!spec) {
    out.push(
      issue(
        "error",
        "behavior.missing",
        `Section "${sectionId}" has no behavior brief (entry.behavior, config.behaviorSpecs, or registry).`,
        { sectionId },
      ),
    );
    return out;
  }

  if (!isNonEmptyString(spec.id)) {
    out.push(
      issue("error", "behavior.id", `Behavior brief for "${sectionId}" has empty id.`, {
        sectionId,
      }),
    );
  } else if (spec.id !== sectionId) {
    out.push(
      issue(
        "warning",
        "behavior.id_mismatch",
        `Behavior brief id "${spec.id}" does not match section id "${sectionId}".`,
        { sectionId },
      ),
    );
  }

  for (const key of STRING_BRIEF_FIELDS) {
    if (!isNonEmptyString(spec[key])) {
      out.push(
        issue(
          "error",
          `behavior.${key}`,
          `Behavior brief for "${sectionId}" requires non-empty "${key}".`,
          { sectionId },
        ),
      );
    }
  }

  for (const key of ARRAY_BRIEF_FIELDS) {
    if (!isNonEmptyStringArray(spec[key])) {
      out.push(
        issue(
          "error",
          `behavior.${key}`,
          `Behavior brief for "${sectionId}" requires non-empty "${key}" string array.`,
          { sectionId },
        ),
      );
    }
  }

  return out;
}

function validateSectionShape(
  entry: SectionPackEntry,
  index: number,
): ValidateIssue[] {
  const out: ValidateIssue[] = [];
  const sid = isNonEmptyString(entry?.id) ? entry.id : `#${index}`;

  if (!isNonEmptyString(entry?.id)) {
    out.push(
      issue("error", "section.id", `Section at index ${index} is missing a non-empty id.`),
    );
  }
  if (!isNonEmptyString(entry?.label)) {
    out.push(
      issue("error", "section.label", `Section "${sid}" is missing a non-empty label.`, {
        sectionId: sid,
      }),
    );
  }
  if (!isNonEmptyString(entry?.componentPath)) {
    out.push(
      issue(
        "error",
        "section.componentPath",
        `Section "${sid}" is missing componentPath.`,
        { sectionId: sid },
      ),
    );
  }
  if (!isNonEmptyString(entry?.componentExport)) {
    out.push(
      issue(
        "error",
        "section.componentExport",
        `Section "${sid}" is missing componentExport.`,
        { sectionId: sid },
      ),
    );
  }
  if (!isNonEmptyString(entry?.cssModulePath)) {
    out.push(
      issue(
        "error",
        "section.cssModulePath",
        `Section "${sid}" is missing cssModulePath.`,
        { sectionId: sid },
      ),
    );
  }
  if (!Array.isArray(entry?.contentKeys)) {
    out.push(
      issue(
        "error",
        "section.contentKeys",
        `Section "${sid}" contentKeys must be an array.`,
        { sectionId: sid },
      ),
    );
  }
  if (!Array.isArray(entry?.cssSelectors) || entry.cssSelectors.length === 0) {
    out.push(
      issue(
        "warning",
        "section.cssSelectors",
        `Section "${sid}" has no cssSelectors; CSS extraction may be empty.`,
        { sectionId: sid },
      ),
    );
  }
  if (
    Array.isArray(entry?.contentKeys) &&
    entry.contentKeys.length > 0 &&
    !isNonEmptyString(entry.contentModulePath)
  ) {
    out.push(
      issue(
        "warning",
        "section.contentModulePath",
        `Section "${sid}" lists contentKeys but has no contentModulePath.`,
        { sectionId: sid },
      ),
    );
  }

  return out;
}

/**
 * Validate a host SectionPackConfig for pack building readiness.
 */
export function validateSectionPackConfig(
  config: SectionPackConfig,
  options?: ValidateSectionPackOptions,
): ValidateSectionPackResult {
  const cwd = options?.cwd ?? process.cwd();
  const checkPaths = options?.checkPaths !== false;
  const requireBehaviorBrief = options?.requireBehaviorBrief !== false;

  const errors: ValidateIssue[] = [];
  const warnings: ValidateIssue[] = [];

  const push = (i: ValidateIssue) => {
    if (i.level === "error") errors.push(i);
    else warnings.push(i);
  };

  if (!config || typeof config !== "object") {
    push(issue("error", "config.invalid", "Config must be an object."));
    return { ok: false, errors, warnings };
  }

  // schemaVersion missing => treat as 1. Reject unsupported majors (> 1).
  const rawVersion = (config as SectionPackConfig).schemaVersion;
  if (rawVersion !== undefined && rawVersion !== null) {
    if (typeof rawVersion !== "number" || !Number.isInteger(rawVersion)) {
      push(
        issue(
          "error",
          "config.schemaVersion",
          "schemaVersion must be an integer when present.",
        ),
      );
    } else if (rawVersion > SUPPORTED_SCHEMA_VERSION) {
      push(
        issue(
          "error",
          "config.schemaVersion_unsupported",
          `schemaVersion ${rawVersion} is unsupported (this package supports up to ${SUPPORTED_SCHEMA_VERSION}).`,
        ),
      );
    } else if (rawVersion < 1) {
      push(
        issue(
          "error",
          "config.schemaVersion",
          `schemaVersion ${rawVersion} is invalid (minimum is 1).`,
        ),
      );
    }
  }

  if (!Array.isArray(config.sections)) {
    push(issue("error", "config.sections", "config.sections must be an array."));
    return { ok: false, errors, warnings };
  }

  if (config.sections.length === 0) {
    push(issue("error", "config.sections_empty", "config.sections is empty."));
  }

  const seenIds = new Map<string, number>();

  config.sections.forEach((entry, index) => {
    for (const i of validateSectionShape(entry, index)) push(i);

    const id = entry?.id;
    if (isNonEmptyString(id)) {
      if (seenIds.has(id)) {
        push(
          issue(
            "error",
            "section.duplicate_id",
            `Duplicate section id "${id}" (first at index ${seenIds.get(id)}, also at ${index}).`,
            { sectionId: id },
          ),
        );
      } else {
        seenIds.set(id, index);
      }
    }

    if (checkPaths && isNonEmptyString(entry?.componentPath)) {
      const abs = resolvePath(cwd, entry.componentPath);
      if (!existsSync(abs)) {
        push(
          issue(
            "error",
            "path.component",
            `componentPath not found for "${entry.id}": ${entry.componentPath}`,
            { sectionId: entry.id, path: entry.componentPath },
          ),
        );
      }
    }

    if (checkPaths && isNonEmptyString(entry?.contentModulePath)) {
      const abs = resolvePath(cwd, entry.contentModulePath);
      if (!existsSync(abs)) {
        push(
          issue(
            "error",
            "path.content",
            `contentModulePath not found for "${entry.id}": ${entry.contentModulePath}`,
            { sectionId: entry.id, path: entry.contentModulePath },
          ),
        );
      }
    }

    if (checkPaths && isNonEmptyString(entry?.cssModulePath)) {
      const abs = resolvePath(cwd, entry.cssModulePath);
      if (!existsSync(abs)) {
        push(
          issue(
            "error",
            "path.css",
            `cssModulePath not found for "${entry.id}": ${entry.cssModulePath}`,
            { sectionId: entry.id, path: entry.cssModulePath },
          ),
        );
      }
    }

    if (checkPaths && Array.isArray(entry?.relatedPaths)) {
      for (const rel of entry.relatedPaths) {
        if (!isNonEmptyString(rel)) continue;
        const abs = resolvePath(cwd, rel);
        if (!existsSync(abs)) {
          push(
            issue(
              "warning",
              "path.related",
              `relatedPath not found for "${entry.id}": ${rel}`,
              { sectionId: entry.id, path: rel },
            ),
          );
        }
      }
    }

    if (requireBehaviorBrief && isNonEmptyString(entry?.id)) {
      const spec =
        entry.behavior ??
        getBehaviorSpec(entry.id, config.behaviorSpecs);
      for (const i of validateBehaviorBrief(spec, entry.id)) push(i);
    }
  });

  if (Array.isArray(config.recipes)) {
    const sectionIds = new Set(
      config.sections
        .map((s) => s?.id)
        .filter((id): id is string => isNonEmptyString(id)),
    );
    const seenRecipes = new Map<string, number>();

    config.recipes.forEach((recipe, index) => {
      if (!isNonEmptyString(recipe?.id)) {
        push(
          issue(
            "error",
            "recipe.id",
            `Recipe at index ${index} is missing a non-empty id.`,
          ),
        );
        return;
      }
      if (seenRecipes.has(recipe.id)) {
        push(
          issue(
            "error",
            "recipe.duplicate_id",
            `Duplicate recipe id "${recipe.id}".`,
          ),
        );
      } else {
        seenRecipes.set(recipe.id, index);
      }

      if (!Array.isArray(recipe.sectionIds) || recipe.sectionIds.length === 0) {
        push(
          issue(
            "error",
            "recipe.sectionIds",
            `Recipe "${recipe.id}" has no sectionIds.`,
          ),
        );
        return;
      }

      for (const sid of recipe.sectionIds) {
        if (!sectionIds.has(sid)) {
          push(
            issue(
              "error",
              "recipe.unknown_section",
              `Recipe "${recipe.id}" references unknown section id "${sid}".`,
            ),
          );
        }
      }
    });
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}
