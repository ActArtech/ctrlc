/**
 * Named multi-section recipes - presets of section ids for common page compositions.
 */

import type { PackRecipe, SectionPackConfig, SectionPackEntry } from "./types";

export type { PackRecipe };

export type RecipeValidation =
  | { ok: true; recipe: PackRecipe; ids: string[] }
  | {
      ok: false;
      error: string;
      status: 400 | 404;
      knownRecipes: string[];
      unknownSections?: string[];
    };

/** Index recipes by id from a config (or empty). */
export function indexRecipes(
  recipes: PackRecipe[] | undefined,
): Map<string, PackRecipe> {
  return new Map((recipes ?? []).map((r) => [r.id, r]));
}

export function getPackRecipe(
  config: SectionPackConfig,
  id: string,
): PackRecipe | undefined {
  return (config.recipes ?? []).find((r) => r.id === id);
}

export function listPackRecipes(config: SectionPackConfig): PackRecipe[] {
  return [...(config.recipes ?? [])];
}

export function listRecipeIds(config: SectionPackConfig): string[] {
  return (config.recipes ?? []).map((r) => r.id);
}

/**
 * Resolve a recipe id to ordered unique section ids.
 * Unknown recipe -> 404; recipe with missing section ids -> 400.
 */
export function validateRecipe(
  config: SectionPackConfig,
  recipeId: string,
): RecipeValidation {
  const knownRecipes = listRecipeIds(config);
  const recipe = getPackRecipe(config, recipeId);
  if (!recipe) {
    return {
      ok: false,
      error: `Unknown recipe: ${recipeId}`,
      status: 404,
      knownRecipes,
    };
  }

  const knownSections = new Set(config.sections.map((s) => s.id));
  const unknownSections = recipe.sectionIds.filter((id) => !knownSections.has(id));
  if (unknownSections.length) {
    return {
      ok: false,
      error: `Recipe "${recipeId}" references unknown section id(s): ${unknownSections.join(", ")}`,
      status: 400,
      knownRecipes,
      unknownSections,
    };
  }

  const seen = new Set<string>();
  const ids: string[] = [];
  for (const id of recipe.sectionIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  return { ok: true, recipe, ids };
}

/** Lightweight summary for list endpoints. */
export function summarizeRecipe(recipe: PackRecipe) {
  return {
    id: recipe.id,
    label: recipe.label,
    description: recipe.description,
    sectionIds: recipe.sectionIds,
    count: recipe.sectionIds.length,
  };
}

/** Default homepage order helper for a config's section list. */
export function sectionIdsInOrder(sections: SectionPackEntry[]): string[] {
  return sections.map((s) => s.id);
}
