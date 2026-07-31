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

/** Clickable label within a section (link or button). */
export interface PageIRCta {
  label: string;
  href?: string;
  /** Heuristic: primary | secondary | button | link */
  role?: string;
}

/**
 * Structured copy for one section (preferred over a single textSample blob).
 * Capture fills this; textSample remains a short join for legacy tools.
 */
export interface PageIRSectionText {
  eyebrow?: string;
  headings: string[];
  paragraphs: string[];
  listItems: string[];
  ctas: PageIRCta[];
  labels?: string[];
}

export interface PageIRSection {
  id: string;
  label: string;
  interactionModel: InteractionModel;
  selector?: string;
  boundingBox?: PageIRBoundingBox;
  /**
   * Structured headings / paragraphs / lists / CTAs.
   * Prefer this for rebuilds; keep textSample as a short summary.
   */
  text?: PageIRSectionText;
  /** Compact free-text summary (derived from `text` when structured). */
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
