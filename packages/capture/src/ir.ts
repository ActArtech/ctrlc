/**
 * Page IR (intermediate representation) for ctrlc capture recon.
 *
 * Deterministic-style browser recon -> React rebuild pipeline.
 * Never an HTML dump product: agents rebuild sections as React components.
 */

export type InteractionModel =
  | "static"
  | "click"
  | "scroll"
  | "hover"
  | "time"
  | "hybrid";

export type PageIRAssetKind = "image" | "video" | "font" | "other";

export interface PageIRBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageIRViewport {
  width: number;
  height: number;
}

export interface PageIRSection {
  id: string;
  label: string;
  interactionModel: InteractionModel;
  selector?: string;
  boundingBox?: PageIRBoundingBox;
  textSample?: string;
  styles?: Record<string, string>;
  childrenHints?: string[];
}

export interface PageIRAsset {
  url: string;
  kind: PageIRAssetKind;
  localPath?: string;
}

export interface PageIRTokens {
  colors: string[];
  fonts: string[];
  cssVariables?: Record<string, string>;
}

/** Page IR schema version currently supported by @ctrlc/capture. */
export const PAGE_IR_SCHEMA_VERSION = 1 as const;

export type PageIRSchemaVersion = typeof PAGE_IR_SCHEMA_VERSION;

/**
 * Normalized capture of one page (scope=page).
 * Written as ir.json under the capture outDir (e.g. runs/<host>/ir.json).
 */
export interface PageIR {
  schemaVersion: PageIRSchemaVersion;
  sourceUrl: string;
  capturedAt: string;
  viewport: PageIRViewport;
  title?: string;
  sections: PageIRSection[];
  tokens: PageIRTokens;
  assets: PageIRAsset[];
  notes?: string[];
}
