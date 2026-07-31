/**
 * Minimal ambient types for optional peer `playwright`.
 * Full package is not required to typecheck or build @ctrlc/capture.
 */

declare module "playwright" {
  export interface Browser {
    newContext(options?: {
      viewport?: { width: number; height: number };
      deviceScaleFactor?: number;
    }): Promise<BrowserContext>;
    close(): Promise<void>;
  }

  export interface BrowserContext {
    newPage(): Promise<Page>;
  }

  export interface Page {
    setDefaultTimeout(timeout: number): void;
    goto(
      url: string,
      options?: {
        waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
        timeout?: number;
      },
    ): Promise<unknown>;
    screenshot(options?: {
      path?: string;
      fullPage?: boolean;
    }): Promise<Buffer>;
    evaluate<R>(pageFunction: () => R | Promise<R>): Promise<R>;
  }

  export const chromium: {
    launch(options?: { headless?: boolean }): Promise<Browser>;
  };
}
