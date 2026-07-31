/**
 * Persist Page IR JSON under a capture run directory.
 *
 * Typical capture outDir layout:
 * - ir.json              Page IR (this module)
 * - screenshot.png       Full-page PNG when Playwright capture succeeds (F2)
 * - screenshots/full.png Secondary copy of the same screenshot
 * - README.md            How to use IR for React rebuild
 */

import fs from "node:fs";
import path from "node:path";
import type { PageIR } from "./ir";

export const IR_FILENAME = "ir.json";

/** Canonical full-page screenshot filename under capture outDir (F2). */
export const SCREENSHOT_FILENAME = "screenshot.png";

export interface WriteIrResult {
  /** Absolute path to ir.json */
  irPath: string;
  /** Directory that contains ir.json (outDir) */
  outDir: string;
}

/**
 * Write Page IR as pretty JSON to `<outDir>/ir.json`.
 * Creates outDir when missing.
 *
 * Typical layout: `runs/<host>/ir.json` when outDir is `runs/<host>`.
 */
export function writeIr(outDir: string, ir: PageIR): WriteIrResult {
  const absDir = path.resolve(outDir);
  fs.mkdirSync(absDir, { recursive: true });
  const irPath = path.join(absDir, IR_FILENAME);
  fs.writeFileSync(irPath, JSON.stringify(ir, null, 2) + "\n", "utf8");
  return { irPath, outDir: absDir };
}

/**
 * Derive a filesystem-safe host segment from a URL for `runs/<host>/`.
 */
export function hostFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "") || "page";
    return host
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "page";
  } catch {
    return "page";
  }
}

/**
 * Default outDir: `runs/<host>` relative to cwd (or under baseDir).
 */
export function defaultRunOutDir(url: string, baseDir: string = process.cwd()): string {
  return path.join(path.resolve(baseDir), "runs", hostFromUrl(url));
}
