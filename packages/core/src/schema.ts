/**
 * SectionPackConfig JSON Schema + lightweight structural checks.
 * No ajv dependency: shape assert is manual and aligned with the schema file.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Highest schemaVersion this package understands. Missing config field treats as 1. */
export const SUPPORTED_SCHEMA_VERSION = 1 as const;

export type AssertConfigShapeResult = {
  ok: boolean;
  errors: string[];
};

const SCHEMA_FILE = "section-pack-config.schema.json";

let cachedSchema: Record<string, unknown> | null = null;

/**
 * Resolve path to schemas/section-pack-config.schema.json relative to this module
 * (dist/ or src/) and common package layouts.
 */
export function resolveConfigSchemaPath(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // packages/core/dist -> packages/core/schemas
    join(here, "..", "schemas", SCHEMA_FILE),
    // packages/core/src -> packages/core/schemas
    join(here, "..", "..", "schemas", SCHEMA_FILE),
    // cwd when running from package root
    join(process.cwd(), "schemas", SCHEMA_FILE),
    join(process.cwd(), "packages", "core", "schemas", SCHEMA_FILE),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * Embedded fallback when the schema file is not on disk (e.g. partial publish).
 * Kept in sync with schemas/section-pack-config.schema.json.
 */
function inlineConfigSchema(): Record<string, unknown> {
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "https://ctrlc.dev/schemas/section-pack-config.schema.json",
    title: "SectionPackConfig",
    description:
      "Host configuration for SectionPack assembly: sections, recipes, default variables, and shared CSS util selectors.",
    type: "object",
    required: ["sections"],
    additionalProperties: true,
    properties: {
      schemaVersion: {
        type: "integer",
        const: 1,
        description:
          "Config format version. Missing is treated as 1. Only 1 is currently supported.",
      },
      sections: {
        type: "array",
        minItems: 1,
        description: "Ordered list of section pack entries.",
        items: { $ref: "#/definitions/SectionPackEntry" },
      },
      recipes: {
        type: "array",
        description: "Named multi-section recipes (ordered section id lists).",
        items: { $ref: "#/definitions/PackRecipe" },
      },
      defaultVariables: {
        type: "object",
        description: "Default {{key}} replacement values for pack prompts.",
        additionalProperties: { type: "string" },
      },
      sharedUtilSelectors: {
        type: "array",
        description:
          "Shared utility CSS class selectors auto-included when referenced.",
        items: { type: "string", minLength: 1 },
      },
      behaviorSpecs: {
        type: "object",
        description:
          "Extra behavior briefs keyed by section id (functions omitted from JSON configs).",
        additionalProperties: {
          $ref: "#/definitions/BehaviorBriefSpec",
        },
      },
    },
    definitions: {
      BehaviorBriefSpec: {
        type: "object",
        required: [
          "id",
          "whatItIs",
          "function",
          "behavior",
          "motion",
          "layout",
          "color",
          "type",
          "responsive",
          "a11y",
          "influences",
          "rebuildGuidance",
        ],
        additionalProperties: false,
        properties: {
          id: { type: "string", minLength: 1 },
          whatItIs: { type: "string" },
          function: { type: "string" },
          behavior: { type: "array", items: { type: "string" } },
          motion: { type: "array", items: { type: "string" } },
          layout: { type: "array", items: { type: "string" } },
          color: { type: "array", items: { type: "string" } },
          type: { type: "array", items: { type: "string" } },
          responsive: { type: "array", items: { type: "string" } },
          a11y: { type: "array", items: { type: "string" } },
          influences: { type: "array", items: { type: "string" } },
          rebuildGuidance: { type: "array", items: { type: "string" } },
        },
      },
      SectionPackEntry: {
        type: "object",
        required: [
          "id",
          "label",
          "description",
          "componentPath",
          "componentExport",
          "contentKeys",
          "cssSelectors",
          "cssModulePath",
          "tags",
          "promptRole",
        ],
        additionalProperties: true,
        properties: {
          id: { type: "string", minLength: 1 },
          label: { type: "string", minLength: 1 },
          description: { type: "string" },
          componentPath: { type: "string", minLength: 1 },
          componentExport: { type: "string", minLength: 1 },
          contentKeys: { type: "array", items: { type: "string" } },
          contentModulePath: { type: "string" },
          cssSelectors: { type: "array", items: { type: "string" } },
          cssModulePath: { type: "string", minLength: 1 },
          relatedPaths: { type: "array", items: { type: "string" } },
          tags: { type: "array", items: { type: "string" } },
          promptRole: { type: "string" },
          behavior: { $ref: "#/definitions/BehaviorBriefSpec" },
          previewImage: { type: "string" },
          thumbnail: { type: "string" },
        },
      },
      PackRecipe: {
        type: "object",
        required: ["id", "label", "description", "sectionIds"],
        additionalProperties: true,
        properties: {
          id: { type: "string", minLength: 1 },
          label: { type: "string", minLength: 1 },
          description: { type: "string" },
          sectionIds: {
            type: "array",
            minItems: 1,
            items: { type: "string", minLength: 1 },
          },
        },
      },
    },
  };
}

/**
 * Return the SectionPackConfig JSON Schema object (draft-07).
 * Prefers the shipped schemas/*.json file; falls back to an inline copy.
 */
export function getConfigSchema(): Record<string, unknown> {
  if (cachedSchema) return cachedSchema;

  const path = resolveConfigSchemaPath();
  if (path) {
    try {
      const raw = readFileSync(path, "utf8");
      cachedSchema = JSON.parse(raw) as Record<string, unknown>;
      return cachedSchema;
    } catch {
      // fall through to inline
    }
  }

  cachedSchema = inlineConfigSchema();
  return cachedSchema;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((item) => typeof item === "string");
}

function checkBehaviorShape(
  behavior: unknown,
  path: string,
  errors: string[],
): void {
  if (!isPlainObject(behavior)) {
    errors.push(`${path} must be an object`);
    return;
  }
  const stringFields = ["id", "whatItIs", "function"] as const;
  for (const key of stringFields) {
    if (typeof behavior[key] !== "string") {
      errors.push(`${path}.${key} must be a string`);
    }
  }
  const arrayFields = [
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
  for (const key of arrayFields) {
    if (behavior[key] !== undefined && !isStringArray(behavior[key])) {
      errors.push(`${path}.${key} must be an array of strings`);
    }
  }
}

function checkSectionShape(
  entry: unknown,
  index: number,
  errors: string[],
): void {
  const path = `sections[${index}]`;
  if (!isPlainObject(entry)) {
    errors.push(`${path} must be an object`);
    return;
  }

  const requiredStrings = [
    "id",
    "label",
    "description",
    "componentPath",
    "componentExport",
    "cssModulePath",
    "promptRole",
  ] as const;
  for (const key of requiredStrings) {
    if (typeof entry[key] !== "string") {
      errors.push(`${path}.${key} must be a string`);
    }
  }

  if (!Array.isArray(entry.contentKeys)) {
    errors.push(`${path}.contentKeys must be an array`);
  } else if (!entry.contentKeys.every((k) => typeof k === "string")) {
    errors.push(`${path}.contentKeys must be an array of strings`);
  }

  if (!Array.isArray(entry.cssSelectors)) {
    errors.push(`${path}.cssSelectors must be an array`);
  } else if (!entry.cssSelectors.every((k) => typeof k === "string")) {
    errors.push(`${path}.cssSelectors must be an array of strings`);
  }

  if (!Array.isArray(entry.tags)) {
    errors.push(`${path}.tags must be an array`);
  } else if (!entry.tags.every((k) => typeof k === "string")) {
    errors.push(`${path}.tags must be an array of strings`);
  }

  if (
    entry.contentModulePath !== undefined &&
    typeof entry.contentModulePath !== "string"
  ) {
    errors.push(`${path}.contentModulePath must be a string when present`);
  }

  if (entry.relatedPaths !== undefined) {
    if (!isStringArray(entry.relatedPaths)) {
      errors.push(`${path}.relatedPaths must be an array of strings when present`);
    }
  }

  if (entry.behavior !== undefined) {
    checkBehaviorShape(entry.behavior, `${path}.behavior`, errors);
  }
}

/**
 * Lightweight structural check aligned with SectionPackConfig schema.
 * Does not touch the filesystem or require ajv.
 */
export function assertConfigShape(config: unknown): AssertConfigShapeResult {
  const errors: string[] = [];

  if (!isPlainObject(config)) {
    return { ok: false, errors: ["config must be a plain object"] };
  }

  if (config.schemaVersion !== undefined) {
    if (
      typeof config.schemaVersion !== "number" ||
      !Number.isInteger(config.schemaVersion)
    ) {
      errors.push("schemaVersion must be an integer when present");
    } else if (config.schemaVersion > SUPPORTED_SCHEMA_VERSION) {
      errors.push(
        `schemaVersion ${config.schemaVersion} is unsupported (max supported: ${SUPPORTED_SCHEMA_VERSION})`,
      );
    } else if (config.schemaVersion < 1) {
      errors.push("schemaVersion must be >= 1");
    }
  }

  if (!Array.isArray(config.sections)) {
    errors.push("sections must be an array");
  } else {
    config.sections.forEach((entry, index) => {
      checkSectionShape(entry, index, errors);
    });
  }

  if (config.recipes !== undefined) {
    if (!Array.isArray(config.recipes)) {
      errors.push("recipes must be an array when present");
    } else {
      config.recipes.forEach((recipe, index) => {
        const path = `recipes[${index}]`;
        if (!isPlainObject(recipe)) {
          errors.push(`${path} must be an object`);
          return;
        }
        for (const key of ["id", "label", "description"] as const) {
          if (typeof recipe[key] !== "string") {
            errors.push(`${path}.${key} must be a string`);
          }
        }
        if (!Array.isArray(recipe.sectionIds)) {
          errors.push(`${path}.sectionIds must be an array`);
        } else if (!recipe.sectionIds.every((id) => typeof id === "string")) {
          errors.push(`${path}.sectionIds must be an array of strings`);
        }
      });
    }
  }

  if (config.defaultVariables !== undefined) {
    if (!isPlainObject(config.defaultVariables)) {
      errors.push("defaultVariables must be an object when present");
    } else {
      for (const [k, v] of Object.entries(config.defaultVariables)) {
        if (typeof v !== "string") {
          errors.push(`defaultVariables.${k} must be a string`);
        }
      }
    }
  }

  if (config.sharedUtilSelectors !== undefined) {
    if (!isStringArray(config.sharedUtilSelectors)) {
      errors.push("sharedUtilSelectors must be an array of strings when present");
    }
  }

  if (config.behaviorSpecs !== undefined) {
    if (!isPlainObject(config.behaviorSpecs)) {
      errors.push("behaviorSpecs must be an object when present");
    } else {
      for (const [id, spec] of Object.entries(config.behaviorSpecs)) {
        checkBehaviorShape(spec, `behaviorSpecs.${id}`, errors);
      }
    }
  }

  // resolveComponentImport is a runtime function; not part of JSON schema.
  if (
    config.resolveComponentImport !== undefined &&
    typeof config.resolveComponentImport !== "function"
  ) {
    errors.push("resolveComponentImport must be a function when present");
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Effective schema version for a config (missing => 1).
 */
export function resolveSchemaVersion(config: {
  schemaVersion?: number | null;
}): number {
  const v = config.schemaVersion;
  if (v === undefined || v === null || Number.isNaN(v)) {
    return SUPPORTED_SCHEMA_VERSION;
  }
  return v;
}
