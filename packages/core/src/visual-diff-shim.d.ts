/**
 * Minimal ambient types for optional peers `pngjs` and `pixelmatch`.
 * Full packages are not required to typecheck or build @ctrlc/core.
 */

declare module "pngjs" {
  export class PNG {
    constructor(options?: { width?: number; height?: number; fill?: boolean });
    width: number;
    height: number;
    data: Buffer;
    pack(): NodeJS.ReadableStream;
    static sync: {
      read(data: Buffer): { width: number; height: number; data: Buffer };
      write(png: {
        width: number;
        height: number;
        data: Buffer;
      }): Buffer;
    };
  }
}

declare module "pixelmatch" {
  function pixelmatch(
    img1: Buffer | Uint8Array | Uint8ClampedArray,
    img2: Buffer | Uint8Array | Uint8ClampedArray,
    output: Buffer | Uint8Array | Uint8ClampedArray | null,
    width: number,
    height: number,
    options?: { threshold?: number; includeAA?: boolean },
  ): number;
  export default pixelmatch;
}
