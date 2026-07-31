/**
 * File-backed section registry (.ctrlc/registry.json).
 * Lets `ctrlc register` update packs without rewriting large TS configs.
 */

import type { SectionPackConfig, SectionPackEntry } from "./types";

export type SectionPackRegistryFile = {
  schemaVersion?: number;
  sections: SectionPackEntry[];
  recipes?: SectionPackConfig["recipes"];
  defaultVariables?: SectionPackConfig["defaultVariables"];
  sharedUtilSelectors?: string[];
};

/**
 * Merge a base config with a registry file (registry sections win by id).
 */
export function mergeSectionRegistry(
  base: SectionPackConfig,
  registry: SectionPackRegistryFile | null | undefined,
): SectionPackConfig {
  if (!registry?.sections?.length && !registry?.recipes?.length) {
    return base;
  }

  const byId = new Map<string, SectionPackEntry>();
  for (const s of base.sections ?? []) byId.set(s.id, s);
  for (const s of registry.sections ?? []) byId.set(s.id, s);

  return {
    ...base,
    schemaVersion: registry.schemaVersion ?? base.schemaVersion ?? 1,
    defaultVariables: {
      ...(base.defaultVariables ?? {}),
      ...(registry.defaultVariables ?? {}),
    },
    sharedUtilSelectors: [
      ...new Set([
        ...(base.sharedUtilSelectors ?? []),
        ...(registry.sharedUtilSelectors ?? []),
      ]),
    ],
    recipes:
      registry.recipes && registry.recipes.length > 0
        ? registry.recipes
        : base.recipes,
    sections: [...byId.values()],
  };
}

/**
 * Upsert one section entry into a registry object.
 */
export function upsertRegistrySection(
  registry: SectionPackRegistryFile | null | undefined,
  entry: SectionPackEntry,
): SectionPackRegistryFile {
  const sections = [...(registry?.sections ?? [])];
  const idx = sections.findIndex((s) => s.id === entry.id);
  if (idx >= 0) sections[idx] = { ...sections[idx], ...entry };
  else sections.push(entry);
  return {
    schemaVersion: registry?.schemaVersion ?? 1,
    defaultVariables: registry?.defaultVariables,
    sharedUtilSelectors: registry?.sharedUtilSelectors,
    recipes: registry?.recipes,
    sections,
  };
}

export function emptyRegistry(): SectionPackRegistryFile {
  return { schemaVersion: 1, sections: [] };
}
