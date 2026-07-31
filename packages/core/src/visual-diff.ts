/**
 * Optional PNG visual diff for clone QA (F3).
 *
 * Uses optional peers `pngjs` + `pixelmatch` via dynamic import.
 * Core builds and runs without those packages; missing deps yield a
 * structured result with an install hint (never throws for missing peers).
 */

import fs from "node:fs";
import path from "node:path";

/** Default per-pixel color distance threshold for pixelmatch (0-1). */
const DEFAULT_THRESHOLD = 0.1;

/** Default max allowed differing-pixel ratio before ok=false. */
const DEFAULT_MAX_DIFF_RATIO = 0.01;

export const VISUAL_DIFF_INSTALL_HINT =
  "npm i -D pngjs pixelmatch";

export type VisualDiffOptions = {
  /** pixelmatch threshold 0-1 (default 0.1). */
  threshold?: number;
  /** Optional path to write a PNG highlighting differing pixels. */
  outDiffPath?: string;
  /** Fail when diffPixels/totalPixels exceeds this (default 0.01). */
  maxDiffRatio?: number;
};

export type VisualDiffResult = {
  ok: boolean;
  width: number;
  height: number;
  diffPixels: number;
  totalPixels: number;
  diffRatio: number;
  message: string;
  /** Written when outDiffPath was set and compare succeeded. */
  diffPath?: string;
  /** True when pngjs/pixelmatch could not be loaded. */
  missingDeps?: boolean;
};

type PngJsModule = {
  PNG: {
    new (opts?: { width?: number; height?: number; fill?: boolean }): {
      width: number;
      height: number;
      data: Buffer;
      pack(): NodeJS.ReadableStream;
    };
    sync: {
      read(data: Buffer): { width: number; height: number; data: Buffer };
      write(png: {
        width: number;
        height: number;
        data: Buffer;
      }): Buffer;
    };
  };
};

type PixelmatchFn = (
  img1: Buffer | Uint8Array | Uint8ClampedArray,
  img2: Buffer | Uint8Array | Uint8ClampedArray,
  output: Buffer | Uint8Array | Uint8ClampedArray | null,
  width: number,
  height: number,
  options?: { threshold?: number; includeAA?: boolean },
) => number;

export type VisualDiffLibs = {
  PNG: PngJsModule["PNG"];
  pixelmatch: PixelmatchFn;
};

/**
 * Dynamically load optional pngjs + pixelmatch.
 * Does not throw when packages are missing.
 */
export async function tryLoadVisualDiffLibs(): Promise<
  | { ok: true; libs: VisualDiffLibs }
  | { ok: false; message: string }
> {
  try {
    const pngMod = (await import("pngjs")) as PngJsModule & {
      default?: PngJsModule;
    };
    const pmMod = (await import("pixelmatch")) as
      | PixelmatchFn
      | { default: PixelmatchFn };

    const PNG = pngMod.PNG ?? pngMod.default?.PNG;
    const pixelmatch =
      typeof pmMod === "function"
        ? pmMod
        : (pmMod as { default: PixelmatchFn }).default;

    if (!PNG || typeof PNG.sync?.read !== "function") {
      return {
        ok: false,
        message:
          `Visual diff: pngjs loaded but PNG.sync.read is unavailable. ` +
          `Install peers: ${VISUAL_DIFF_INSTALL_HINT}`,
      };
    }
    if (typeof pixelmatch !== "function") {
      return {
        ok: false,
        message:
          `Visual diff: pixelmatch did not export a function. ` +
          `Install peers: ${VISUAL_DIFF_INSTALL_HINT}`,
      };
    }

    return { ok: true, libs: { PNG, pixelmatch } };
  } catch {
    return {
      ok: false,
      message:
        `Visual diff requires optional peers pngjs and pixelmatch. ` +
        `Install: ${VISUAL_DIFF_INSTALL_HINT}`,
    };
  }
}

function missingDepsResult(message: string): VisualDiffResult {
  return {
    ok: false,
    width: 0,
    height: 0,
    diffPixels: 0,
    totalPixels: 0,
    diffRatio: 0,
    message,
    missingDeps: true,
  };
}

function failResult(
  message: string,
  dims?: { width: number; height: number },
): VisualDiffResult {
  const width = dims?.width ?? 0;
  const height = dims?.height ?? 0;
  const totalPixels = width * height;
  return {
    ok: false,
    width,
    height,
    diffPixels: 0,
    totalPixels,
    diffRatio: 0,
    message,
  };
}

/**
 * Compare two PNG files pixel-by-pixel.
 *
 * When optional peers are missing, returns ok=false with missingDeps=true
 * and an install hint (does not throw).
 */
export async function comparePngFiles(
  baselinePath: string,
  candidatePath: string,
  options?: VisualDiffOptions,
): Promise<VisualDiffResult> {
  const threshold = options?.threshold ?? DEFAULT_THRESHOLD;
  const maxDiffRatio = options?.maxDiffRatio ?? DEFAULT_MAX_DIFF_RATIO;
  const outDiffPath = options?.outDiffPath;

  const loaded = await tryLoadVisualDiffLibs();
  if (!loaded.ok) {
    return missingDepsResult(loaded.message);
  }

  const { PNG, pixelmatch } = loaded.libs;
  const baselineAbs = path.resolve(baselinePath);
  const candidateAbs = path.resolve(candidatePath);

  if (!fs.existsSync(baselineAbs)) {
    return failResult(`Baseline PNG not found: ${baselineAbs}`);
  }
  if (!fs.existsSync(candidateAbs)) {
    return failResult(`Candidate PNG not found: ${candidateAbs}`);
  }

  let img1: { width: number; height: number; data: Buffer };
  let img2: { width: number; height: number; data: Buffer };

  try {
    img1 = PNG.sync.read(fs.readFileSync(baselineAbs));
  } catch (e) {
    return failResult(
      `Failed to parse baseline PNG: ${String((e as Error)?.message ?? e)}`,
    );
  }
  try {
    img2 = PNG.sync.read(fs.readFileSync(candidateAbs));
  } catch (e) {
    return failResult(
      `Failed to parse candidate PNG: ${String((e as Error)?.message ?? e)}`,
    );
  }

  if (img1.width !== img2.width || img1.height !== img2.height) {
    return failResult(
      `Image size mismatch: baseline ${img1.width}x${img1.height} vs candidate ${img2.width}x${img2.height}`,
      { width: img1.width, height: img1.height },
    );
  }

  const { width, height } = img1;
  const totalPixels = width * height;
  const diffData = new Uint8Array(width * height * 4);

  let diffPixels: number;
  try {
    diffPixels = pixelmatch(img1.data, img2.data, diffData, width, height, {
      threshold,
      includeAA: true,
    });
  } catch (e) {
    return failResult(
      `pixelmatch failed: ${String((e as Error)?.message ?? e)}`,
      { width, height },
    );
  }

  const diffRatio = totalPixels === 0 ? 0 : diffPixels / totalPixels;
  const ok = diffRatio <= maxDiffRatio;

  let diffPath: string | undefined;
  if (outDiffPath) {
    const absOut = path.resolve(outDiffPath);
    try {
      fs.mkdirSync(path.dirname(absOut), { recursive: true });
      const outPng = new PNG({ width, height });
      // PNG.data is a Buffer; copy diff RGBA into it
      Buffer.from(diffData.buffer, diffData.byteOffset, diffData.byteLength).copy(
        outPng.data,
      );
      const encoded = PNG.sync.write(outPng);
      fs.writeFileSync(absOut, encoded);
      diffPath = absOut;
    } catch (e) {
      return {
        ok: false,
        width,
        height,
        diffPixels,
        totalPixels,
        diffRatio,
        message:
          `Compare finished but failed to write diff PNG: ` +
          `${String((e as Error)?.message ?? e)}`,
      };
    }
  }

  const pct = (diffRatio * 100).toFixed(3);
  const message = ok
    ? `Visual match: ${diffPixels}/${totalPixels} pixels differ (${pct}%, max ${(maxDiffRatio * 100).toFixed(3)}%)`
    : `Visual diff exceeds budget: ${diffPixels}/${totalPixels} pixels differ (${pct}% > ${(maxDiffRatio * 100).toFixed(3)}%)`;

  return {
    ok,
    width,
    height,
    diffPixels,
    totalPixels,
    diffRatio,
    message,
    ...(diffPath ? { diffPath } : {}),
  };
}

/**
 * Compare raw RGBA buffers (length width*height*4) without reading files.
 * Useful for unit tests and in-memory pipelines. Still needs pixelmatch.
 */
export async function compareRgbaBuffers(
  a: Buffer | Uint8Array,
  b: Buffer | Uint8Array,
  width: number,
  height: number,
  options?: Omit<VisualDiffOptions, "outDiffPath">,
): Promise<VisualDiffResult> {
  const threshold = options?.threshold ?? DEFAULT_THRESHOLD;
  const maxDiffRatio = options?.maxDiffRatio ?? DEFAULT_MAX_DIFF_RATIO;
  const totalPixels = width * height;
  const expected = totalPixels * 4;

  if (a.length < expected || b.length < expected) {
    return failResult(
      `RGBA buffer too short: need ${expected} bytes for ${width}x${height}, got a=${a.length} b=${b.length}`,
      { width, height },
    );
  }

  const loaded = await tryLoadVisualDiffLibs();
  if (!loaded.ok) {
    return missingDepsResult(loaded.message);
  }

  const { pixelmatch } = loaded.libs;
  const diffData = new Uint8Array(expected);

  let diffPixels: number;
  try {
    diffPixels = pixelmatch(a, b, diffData, width, height, {
      threshold,
      includeAA: true,
    });
  } catch (e) {
    return failResult(
      `pixelmatch failed: ${String((e as Error)?.message ?? e)}`,
      { width, height },
    );
  }

  const diffRatio = totalPixels === 0 ? 0 : diffPixels / totalPixels;
  const ok = diffRatio <= maxDiffRatio;
  const pct = (diffRatio * 100).toFixed(3);
  const message = ok
    ? `Visual match: ${diffPixels}/${totalPixels} pixels differ (${pct}%, max ${(maxDiffRatio * 100).toFixed(3)}%)`
    : `Visual diff exceeds budget: ${diffPixels}/${totalPixels} pixels differ (${pct}% > ${(maxDiffRatio * 100).toFixed(3)}%)`;

  return {
    ok,
    width,
    height,
    diffPixels,
    totalPixels,
    diffRatio,
    message,
  };
}
