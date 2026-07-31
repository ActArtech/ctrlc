/**
 * @ctrlc/core - SectionPack builder public API
 */

// Types
export type {
  BehaviorBriefSpec,
  SectionPackEntry,
  PackRecipe,
  PackVariables,
  SectionPackSchemaVersion,
  SectionPackConfig,
  ImportEdge,
  ImportGraph,
  FileTreeEntry,
  PackByteSizes,
  SectionPack,
  CopyFormat,
  MultiCopyFormat,
  MultiPackIndexEntry,
  MultiPackByteSizes,
  MultiSectionPack,
  PackZipResult,
  BuildSectionPackOptions,
  BuildMultiSectionPackOptions,
  FormatPackOptions,
} from "./types";

// Manifest / demo config
export {
  createDemoSectionPackConfig,
  createDemoConfig,
  DEMO_SECTION_IDS,
  DEMO_DEFAULT_VARIABLES,
  DEMO_SHARED_UTIL_SELECTORS,
  DEFAULT_SHARED_UTIL_SELECTORS,
  getSectionEntry,
  listSectionIds,
  listSectionEntries,
  indexSections,
  resolveDefaultComponentImport,
  summarizeSectionEntry,
} from "./manifest";

// Variables
export {
  DEFAULT_PACK_VAR_KEYS,
  getDefaultPackVariables,
  parseVarQueryParams,
  mergePackVariables,
  applyPackVariables,
  formatBrandContextMarkdown,
  injectBrandContext,
  applyPromptVariablePipeline,
} from "./variables";
export type { DefaultPackVarKey } from "./variables";

// Recipes
export {
  indexRecipes,
  getPackRecipe,
  listPackRecipes,
  listRecipeIds,
  validateRecipe,
  summarizeRecipe,
  sectionIdsInOrder,
} from "./recipes";
export type { RecipeValidation } from "./recipes";

// Behavior briefs
export {
  DEMO_BEHAVIOR_BRIEFS,
  BEHAVIOR_BRIEFS,
  getBehaviorSpec,
  buildBehaviorBriefMarkdown,
  buildMultiBehaviorBriefMarkdown,
} from "./behavior-briefs";
export type { BuildBehaviorBriefMarkdownOptions } from "./behavior-briefs";

// Spec → NL brief (clone skill / register)
export {
  behaviorFromSpec,
  parseSpecMarkdown,
} from "./spec-to-behavior";
export type {
  InteractionModel,
  SpecToBehaviorInput,
} from "./spec-to-behavior";

// Page IR → section.spec.md (capture path / specs-from-ir)
export {
  DEFAULT_SECTION_SPEC_TEMPLATE,
  DEFAULT_BREAKPOINTS,
  defaultResponsiveRows,
  ensureResponsiveMatrix,
  formatResponsiveTableRows,
  formatExtraResponsiveTableRows,
  pascalFromId,
  camelFromId,
  listIrSections,
  behaviorFromIRSection,
  irSectionToSpecInput,
  renderSectionSpecMarkdown,
  writeSectionSpecsFromIR,
  writeTopologyFromIR,
  parsePageIR,
  loadPageIR,
  contentSlotsFromIrText,
  formatStructuredTextBlock,
} from "./ir-to-specs";
export type {
  IrInteractionModel,
  PageIrAsset,
  PageIrStyle,
  PageIrStyles,
  PageIrResponsive,
  PageIrSection,
  PageIR,
  DefaultBreakpoint,
  WriteSectionSpecsFromIROptions,
  WrittenSectionSpec,
  WriteSectionSpecsFromIRResult,
  WriteTopologyFromIROptions,
} from "./ir-to-specs";

// Page IR → React scaffold (components + home content + page.tsx)
export {
  planScaffoldFromIR,
  writeScaffoldFromIR,
  scaffoldFromIrFile,
} from "./scaffold-from-ir";
export type {
  ScaffoldSectionPlan,
  ScaffoldFromIrOptions,
  ScaffoldWrittenFile,
  ScaffoldFromIrResult,
} from "./scaffold-from-ir";

// File registry (.ctrlc/registry.json)
export {
  mergeSectionRegistry,
  upsertRegistrySection,
  emptyRegistry,
} from "./registry";
export type { SectionPackRegistryFile } from "./registry";

// B5 / B5b - curated tokens from Page IR (semantic --ts-* roles)
export {
  extractTokensFromIR,
  writeTokensFromIR,
} from "./tokens-from-ir";
export type {
  TokenSemanticRole,
  TokensFromIROptions,
  TokensFromIRResult,
  WriteTokensFromIROptions,
  WriteTokensFromIRResult,
} from "./tokens-from-ir";

// B6 - external capture adapter (file-map / loose IR -> Page IR; no network)
export {
  normalizeSectionId,
  adaptExternalCaptureToPageIR,
  loadExternalCapture,
  writeAdaptedIr,
} from "./external-ir-adapter";
export type {
  ExternalFileMap,
  ExternalCapture,
  AdaptExternalCaptureOptions,
  WriteAdaptedIrResult,
} from "./external-ir-adapter";

// D10 - registry from Page IR
export {
  sectionEntryFromIRSection,
  registryFromIR,
  writeRegistryFromIR,
} from "./ir-to-registry";
export type {
  IrToRegistryOptions,
  WriteRegistryFromIROptions,
  WriteRegistryFromIRResult,
} from "./ir-to-registry";

// D11 - recipe inference from Page IR
export { inferRecipesFromIR } from "./recipe-from-ir";

// Source analysis + auto-draft briefs
export {
  analyzeSectionSources,
} from "./analyze-section";
export type {
  AnalyzeSectionEntry,
  AnalyzeSectionSourcesInput,
  AnalyzeSectionResult,
  SectionAnalysisSignals,
} from "./analyze-section";
export {
  draftBehaviorBrief,
  enrichConfigWithDraftBriefs,
  resolveEntryBehaviorBrief,
  mergeBehaviorBriefLayers,
  isBehaviorBriefIncomplete,
  isBriefFieldEmpty,
  DEFAULT_REDUCED_MOTION_NOTE,
  mentionsReducedMotion,
  ensureReducedMotionNotes,
} from "./draft-brief";
export type {
  DraftBehaviorBriefOptions,
  DraftBehaviorBriefResult,
} from "./draft-brief";

// Single pack builder
export {
  SHARED_UTIL_SELECTORS,
  COPY_FORMATS,
  hashPackSurfaces,
  extractContentKeys,
  parseCssBlocks,
  extractCssBySelectors,
  resolveImportSpecifier,
  buildImportGraph,
  buildSectionPack,
  buildSectionPackById,
  formatPackForCopy,
  parseCopyFormat,
} from "./build-section-pack";

// Multi pack
export {
  MULTI_COPY_FORMATS,
  normalizeSectionIds,
  parseIdsParam,
  validateMultiSectionIds,
  buildSectionPacksParallel,
  buildMultiSectionPack,
  buildMultiSectionPackAsync,
  formatMultiPackForCopy,
  parseMultiFormat,
} from "./multi-section-pack";
export type { MultiSectionValidation } from "./multi-section-pack";

// Section dependency graph
export {
  buildSectionGraph,
  formatSectionGraphMermaid,
  formatSectionGraphMarkdown,
} from "./section-graph";
export type {
  SectionGraph,
  SectionGraphNode,
  SectionGraphEdge,
  SectionGraphEdgeKind,
  BuildSectionGraphOptions,
} from "./section-graph";

// Zip
export {
  sectionPackZipEntries,
  buildSectionZip,
  buildMultiSectionZip,
} from "./build-section-zip";

export {
  buildStoreZip,
  crc32,
  sanitizeZipSegment,
  relatedZipPath,
} from "./zip-store";
export type { ZipEntryInput } from "./zip-store";

// Config validation
export {
  validateSectionPackConfig,
  validateBehaviorBrief,
} from "./validate";
export type {
  ValidateIssue,
  ValidateSectionPackResult,
  ValidateSectionPackOptions,
} from "./validate";

// Config schema (JSON Schema + lightweight shape assert)
export {
  SUPPORTED_SCHEMA_VERSION,
  assertConfigShape,
  getConfigSchema,
  resolveConfigSchemaPath,
  resolveSchemaVersion,
} from "./schema";
export type { AssertConfigShapeResult } from "./schema";

// Spec complexity budget (soft warnings for long section.spec.md)
export { checkSpecBudget } from "./spec-budget";
export type {
  SpecBudgetOptions,
  SpecBudgetWarning,
  SpecBudgetResult,
} from "./spec-budget";

// F3 - optional PNG visual diff (peers: pngjs + pixelmatch)
export {
  VISUAL_DIFF_INSTALL_HINT,
  tryLoadVisualDiffLibs,
  comparePngFiles,
  compareRgbaBuffers,
} from "./visual-diff";
export type {
  VisualDiffOptions,
  VisualDiffResult,
  VisualDiffLibs,
} from "./visual-diff";

// C5 - parallel section build plan from *.spec.md
export {
  DEFAULT_SPECS_DIR,
  DEFAULT_PROMPT_PATH_HINT,
  DEFAULT_MAX_AGENTS,
  extractSpecId,
  batchSectionIds,
  buildParallelPlan,
  formatParallelPlan,
  formatParallelPlanMarkdown,
  formatParallelPlanShell,
  formatParallelPlanJson,
} from "./parallel-plan";
export type {
  ParallelPlanSection,
  ParallelPlan,
  BuildParallelPlanOptions,
} from "./parallel-plan";

// In-memory pack cache
export {
  DEFAULT_PACK_CACHE_MAX,
  PackCache,
  listEntrySourcePaths,
  packSourceMtimeKey,
  packContentHashKey,
  getCachedSectionPack,
} from "./pack-cache";
export type {
  PackCacheOptions,
  GetCachedSectionPackOptions,
} from "./pack-cache";

// Pack diff + snapshot (CI / agent intelligence)
export {
  diffSectionPacks,
  formatPackDiffMarkdown,
} from "./diff-pack";
export type { SectionPackDiff } from "./diff-pack";

export {
  snapshotSectionPack,
  compareSectionSources,
} from "./snapshot-pack";
export type {
  SectionPackSnapshot,
  CompareSectionSourcesOptions,
  CompareSectionSourcesResult,
} from "./snapshot-pack";

// --- Host helpers ---

import type { SectionPackConfig } from "./types";
import { buildMultiSectionPack } from "./multi-section-pack";
import { getPackRecipe, validateRecipe } from "./recipes";
import { mergePackVariables } from "./variables";

/** Identity helper for typed host configs. */
export function defineSectionPackConfig(
  config: SectionPackConfig,
): SectionPackConfig {
  return config;
}

/** Alias of buildSectionPackById. */
export { buildSectionPackById as buildSectionPackFromConfig } from "./build-section-pack";

/** Alias of getSectionEntry. */
export { getSectionEntry as getEntryFromConfig } from "./manifest";

/** Merge config.defaultVariables with query/override vars. */
export function mergeVariables(
  config: SectionPackConfig,
  overrides?: Partial<import("./types").PackVariables> | Record<string, string> | null,
) {
  const cleaned: Record<string, string> | null = overrides
    ? Object.fromEntries(
        Object.entries(overrides).filter(
          (e): e is [string, string] => typeof e[1] === "string",
        ),
      )
    : null;
  return mergePackVariables(cleaned, config.defaultVariables ?? null);
}

/**
 * Expand a named recipe into a multi-section pack, or return an error payload.
 */
export function buildRecipePack(
  config: SectionPackConfig,
  recipeId: string,
  options?: { cwd?: string },
) {
  const check = validateRecipe(config, recipeId);
  if (!check.ok) {
    return {
      error: check.error,
      status: check.status,
      knownRecipes: check.knownRecipes,
      unknownSections: check.unknownSections,
    };
  }
  const recipe = getPackRecipe(config, recipeId)!;
  // Signature: buildMultiSectionPack(config, ids, options?)
  return buildMultiSectionPack(config, check.ids, {
    cwd: options?.cwd,
    recipeId: recipe.id,
    recipeLabel: recipe.label,
  });
}
