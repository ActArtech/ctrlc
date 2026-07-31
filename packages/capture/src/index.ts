/**
 * @ctrlc/capture - page recon to Page IR for React rebuild.
 *
 * Optional peer: playwright (live browser capture).
 * Always available: Page IR types, writeIr, section id helpers.
 */

export type {
  InteractionModel,
  PageIRAssetKind,
  PageIRBoundingBox,
  PageIRViewport,
  PageIRSection,
  PageIRAsset,
  PageIRTokens,
  PageIRSchemaVersion,
  PageIR,
} from "./ir";

export { PAGE_IR_SCHEMA_VERSION } from "./ir";

export {
  normalizeSectionId,
  uniqueSectionIds,
} from "./section-ids";

export {
  writeIr,
  hostFromUrl,
  defaultRunOutDir,
  IR_FILENAME,
  SCREENSHOT_FILENAME,
  type WriteIrResult,
} from "./write-ir";

export {
  capturePage,
  tryLoadPlaywright,
  writeCaptureReadme,
  type CaptureViewport,
  type CapturePageOptions,
  type CapturePageResult,
  type WriteCaptureReadmeOptions,
} from "./capture-page";

export {
  stableAssetFilename,
  materializeAssets,
  materializeAssetsFromFile,
  type MaterializeAssetsOptions,
  type MaterializeAssetsResult,
  type MaterializeWritten,
} from "./materialize-assets";
