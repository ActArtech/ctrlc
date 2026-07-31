/**
 * capturePage - single-page recon into Page IR + screenshot + README.
 *
 * Scope: page only (one URL -> one IR). React rebuild product, not HTML dump.
 * Playwright is optional; missing install yields a clear install hint.
 *
 * Screenshot layout (F2):
 * - Canonical: `<outDir>/screenshot.png` full-page PNG for baselines / QA
 * - Secondary: `<outDir>/screenshots/full.png` (same image; legacy path)
 * Copy into project baselines via CLI `baseline` module (docs/research/baselines/).
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import {
  PAGE_IR_SCHEMA_VERSION,
  type InteractionModel,
  type PageIR,
  type PageIRAsset,
  type PageIRSection,
} from "./ir";
import { uniqueSectionIds, normalizeSectionId } from "./section-ids";
import { hygienizePageIR } from "./hygienize-sections";
import {
  ensureIrTextFields,
  normalizeSectionText,
  synthesizeTextSample,
  type PageIRSectionText,
} from "./section-text";
import { writeIr } from "./write-ir";
import { materializeAssets } from "./materialize-assets";

const require = createRequire(import.meta.url);

export interface CaptureViewport {
  width: number;
  height: number;
}

export interface CapturePageOptions {
  /** Output directory (e.g. runs/demo or runs/example.com). */
  outDir: string;
  /** Viewport used for capture and IR.viewport. Default 1440x900. */
  viewport?: CaptureViewport;
  /** Navigation timeout ms. Default 45000. */
  timeoutMs?: number;
  /** Wait until load state. Default "networkidle". */
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
  /**
   * After capture, download assets[] into `<outDir>/assets` and set
   * asset.localPath (prefixed `assets/...`). Failures are non-fatal.
   */
  materializeAssets?: boolean;
}

export interface CapturePageResult {
  ir: PageIR;
  irPath: string;
  outDir: string;
  screenshotPath: string | null;
  readmePath: string;
  usedPlaywright: boolean;
  /** Present when materializeAssets option ran. */
  materialize?: {
    outDir: string;
    ok: number;
    failed: number;
  };
}

const DEFAULT_VIEWPORT: CaptureViewport = { width: 1440, height: 900 };

const PLAYWRIGHT_HINT = `Playwright is required for live page capture.

Install in this workspace (or your project):

  npm install -D playwright
  npx playwright install chromium

Then re-run:

  ctrlc capture <url> --out <dir>

@ctrlc/capture works as a pure library without Playwright for IR types,
writeIr, and section id helpers. Browser recon needs the optional peer.`;

/**
 * Dynamically load playwright if installed. Returns null when missing.
 */
export async function tryLoadPlaywright(): Promise<typeof import("playwright") | null> {
  try {
    return await import("playwright");
  } catch {
    // fall through
  }
  try {
    // CJS resolve path for monorepo edge cases
    const resolved = require.resolve("playwright");
    return await import(pathToFileURL(resolved).href);
  } catch {
    return null;
  }
}

/** Raw section candidate from the browser evaluate pass. */
interface RawSectionCandidate {
  label: string;
  selector: string;
  textSample: string;
  /** Structured text (headings, CTAs, lists) when extract succeeds */
  text?: PageIRSectionText;
  tagName: string;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
  styles: Record<string, string>;
  childrenHints: string[];
  interactionModel: InteractionModel;
}

interface BrowserExtract {
  title: string;
  fonts: string[];
  colors: string[];
  cssVariables: Record<string, string>;
  assets: PageIRAsset[];
  sections: RawSectionCandidate[];
  notes: string[];
}

/**
 * Capture one URL into Page IR under outDir.
 * Always writes ir.json + README.md.
 * When Playwright succeeds, writes full-page `screenshot.png` under outDir
 * (and a copy at screenshots/full.png). Use those paths for F2 baselines.
 */
export async function capturePage(
  url: string,
  options: CapturePageOptions,
): Promise<CapturePageResult> {
  if (!url || typeof url !== "string") {
    throw new Error("capturePage requires a non-empty url string");
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`URL must be http(s): ${url}`);
  }

  const outDir = path.resolve(options.outDir);
  const viewport = {
    width: options.viewport?.width ?? DEFAULT_VIEWPORT.width,
    height: options.viewport?.height ?? DEFAULT_VIEWPORT.height,
  };
  const timeoutMs = options.timeoutMs ?? 45_000;
  const waitUntil = options.waitUntil ?? "networkidle";

  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.join(outDir, "screenshots"), { recursive: true });

  const pw = await tryLoadPlaywright();
  if (!pw) {
    // Still write a stub IR + README so agents know the layout, then error.
    const stub = buildStubIr(url, viewport, [
      "Playwright not installed; live recon skipped.",
      "Install playwright + chromium, then re-run capture.",
    ]);
    const { irPath } = writeIr(outDir, stub);
    const readmePath = writeCaptureReadme(outDir, {
      sourceUrl: url,
      irPath,
      screenshotPath: null,
      playwrightMissing: true,
    });
    const err = new Error(PLAYWRIGHT_HINT);
    (err as Error & { code?: string }).code = "PLAYWRIGHT_MISSING";
    (err as Error & { irPath?: string }).irPath = irPath;
    (err as Error & { readmePath?: string }).readmePath = readmePath;
    throw err;
  }

  const { chromium } = pw;
  const browser = await chromium.launch({ headless: true });
  let screenshotPath: string | null = null;

  try {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);

    await page.goto(url, { waitUntil, timeout: timeoutMs });

    // Full-page screenshot: canonical screenshot.png under outDir (F2 baselines)
    const shotAbs = path.join(outDir, "screenshot.png");
    await page.screenshot({ path: shotAbs, fullPage: true });
    screenshotPath = shotAbs;
    // Secondary legacy path for tools that expect screenshots/full.png
    const legacyShot = path.join(outDir, "screenshots", "full.png");
    try {
      fs.copyFileSync(shotAbs, legacyShot);
    } catch {
      // non-fatal
    }

    const extracted = await page.evaluate(extractInPage);

    const labels = extracted.sections.map((s) => s.label || s.tagName || "section");
    const ids = uniqueSectionIds(labels);

    const sections: PageIRSection[] = extracted.sections.map((raw, i) => {
      const text = normalizeSectionText(raw.text);
      const textSample =
        (raw.textSample && String(raw.textSample).trim()) ||
        synthesizeTextSample(text, 200) ||
        undefined;
      return {
        id: ids[i] ?? (normalizeSectionId(raw.label) || `section-${i + 1}`),
        label: raw.label || humanizeId(ids[i] ?? `section-${i + 1}`),
        interactionModel: raw.interactionModel ?? "static",
        selector: raw.selector || undefined,
        boundingBox: raw.boundingBox ?? undefined,
        ...(text ? { text } : {}),
        textSample,
        styles: Object.keys(raw.styles || {}).length ? raw.styles : undefined,
        childrenHints:
          raw.childrenHints && raw.childrenHints.length
            ? raw.childrenHints
            : undefined,
      };
    });

    // Hygiene: drop noise, dedupe, stable short ids (hero/pricing/faq) + full labels
    // Then re-normalize structured text fields after object clones.
    let ir: PageIR = ensureIrTextFields(
      hygienizePageIR(
        {
          schemaVersion: PAGE_IR_SCHEMA_VERSION,
          sourceUrl: url,
          capturedAt: new Date().toISOString(),
          viewport,
          title: extracted.title || undefined,
          sections,
          tokens: {
            colors: extracted.colors,
            fonts: extracted.fonts,
            cssVariables:
              Object.keys(extracted.cssVariables || {}).length > 0
                ? extracted.cssVariables
                : undefined,
          },
          assets: extracted.assets,
          notes: [
            "ctrlc capture (scope=page). Recon for React section rebuild - not an HTML dump.",
            "Screenshot: screenshot.png (full page; also screenshots/full.png)",
            "Section text includes structured headings/CTAs/listItems when available (not only textSample).",
            ...extracted.notes,
          ],
        },
        {},
      ),
    );

    let materializeInfo: CapturePageResult["materialize"];

    if (options.materializeAssets && ir.assets.length > 0) {
      const assetsDir = path.join(outDir, "assets");
      try {
        const mat = await materializeAssets(ir, {
          outDir: assetsDir,
          rewriteIr: true,
          timeoutMs,
        });
        // Paths relative to capture outDir for agent rebuild
        for (const a of mat.ir.assets) {
          if (a.localPath && !a.localPath.startsWith("assets/")) {
            a.localPath = `assets/${a.localPath}`.replace(/\\/g, "/");
          }
        }
        ir = mat.ir;
        const ok = mat.written.filter((w) => w.ok).length;
        const failed = mat.written.filter((w) => !w.ok).length;
        materializeInfo = { outDir: assetsDir, ok, failed };
        ir.notes = [
          ...(ir.notes ?? []),
          `Assets materialized under assets/ (${ok} ok, ${failed} failed).`,
        ];
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        ir.notes = [
          ...(ir.notes ?? []),
          `Asset materialization skipped: ${msg}`,
        ];
      }
    }

    const { irPath } = writeIr(outDir, ir);
    const readmePath = writeCaptureReadme(outDir, {
      sourceUrl: url,
      irPath,
      screenshotPath,
      playwrightMissing: false,
    });

    return {
      ir,
      irPath,
      outDir,
      screenshotPath,
      readmePath,
      usedPlaywright: true,
      materialize: materializeInfo,
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

function buildStubIr(
  url: string,
  viewport: CaptureViewport,
  notes: string[],
): PageIR {
  return {
    schemaVersion: PAGE_IR_SCHEMA_VERSION,
    sourceUrl: url,
    capturedAt: new Date().toISOString(),
    viewport,
    sections: [],
    tokens: { colors: [], fonts: [] },
    assets: [],
    notes,
  };
}

function humanizeId(id: string): string {
  return id
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Runs in the browser. Keep self-contained (no outer closures).
 */
function extractInPage(): BrowserExtract {
  const title = document.title || "";

  // Fonts from computed styles on body + headings + a sample of nodes
  const fontSet = new Set<string>();
  const colorSet = new Set<string>();
  const cssVariables: Record<string, string> = {};

  try {
    const rootStyles = getComputedStyle(document.documentElement);
    for (let i = 0; i < rootStyles.length; i++) {
      const prop = rootStyles[i];
      if (prop && prop.startsWith("--")) {
        const val = rootStyles.getPropertyValue(prop).trim();
        if (val) cssVariables[prop] = val;
      }
    }
  } catch {
    // ignore
  }

  const sampleNodes = Array.from(
    document.querySelectorAll(
      "body, h1, h2, h3, p, a, button, section, header, footer, main, nav",
    ),
  ).slice(0, 80);

  for (const el of sampleNodes) {
    try {
      const cs = getComputedStyle(el);
      const ff = cs.fontFamily;
      if (ff) {
        for (const part of ff.split(",")) {
          const name = part.trim().replace(/^["']|["']$/g, "");
          if (name && name.toLowerCase() !== "inherit") fontSet.add(name);
        }
      }
      for (const prop of ["color", "backgroundColor", "borderColor"] as const) {
        const c = cs[prop];
        if (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent") {
          colorSet.add(c);
        }
      }
    } catch {
      // ignore
    }
  }

  // Assets: images, videos, stylesheet/font links
  const assets: PageIRAsset[] = [];
  const seenUrl = new Set<string>();

  function pushAsset(rawUrl: string, kind: PageIRAsset["kind"]) {
    if (!rawUrl || rawUrl.startsWith("data:")) return;
    let abs = rawUrl;
    try {
      abs = new URL(rawUrl, document.baseURI).href;
    } catch {
      return;
    }
    // Prefer unwrapping Next.js image optimizer at capture time when easy
    try {
      const u = new URL(abs);
      if (u.pathname.includes("/_next/image")) {
        const nested = u.searchParams.get("url");
        if (nested) {
          let decoded = nested;
          try {
            decoded = decodeURIComponent(nested);
          } catch {
            /* keep */
          }
          try {
            abs = new URL(decoded, u.origin).href;
          } catch {
            /* keep optimizer url; materialize will retry */
          }
        }
      }
    } catch {
      /* keep abs */
    }
    if (seenUrl.has(abs)) return;
    seenUrl.add(abs);
    assets.push({ url: abs, kind });
  }

  for (const img of Array.from(document.images)) {
    pushAsset(img.currentSrc || img.src, "image");
  }
  for (const v of Array.from(document.querySelectorAll("video"))) {
    const src =
      (v as HTMLVideoElement).currentSrc ||
      (v as HTMLVideoElement).src ||
      v.querySelector("source")?.getAttribute("src") ||
      "";
    pushAsset(src, "video");
  }
  for (const link of Array.from(document.querySelectorAll("link[rel]"))) {
    const rel = (link.getAttribute("rel") || "").toLowerCase();
    const href = link.getAttribute("href") || "";
    if (rel.includes("stylesheet")) pushAsset(href, "other");
    if (rel.includes("preload") && (link.getAttribute("as") || "") === "font") {
      pushAsset(href, "font");
    }
    if (rel.includes("icon")) pushAsset(href, "image");
  }
  for (const s of Array.from(document.querySelectorAll("source[src]"))) {
    const src = s.getAttribute("src") || "";
    const type = (s.getAttribute("type") || "").toLowerCase();
    if (type.startsWith("video/") || /\.(mp4|webm|ogg)(\?|$)/i.test(src)) {
      pushAsset(src, "video");
    } else {
      pushAsset(src, "other");
    }
  }

  // Section candidates: landmarks + headings + main children
  type Cand = {
    el: Element;
    label: string;
    selector: string;
    tagName: string;
  };

  const candidates: Cand[] = [];
  const used = new WeakSet<Element>();

  function cssPath(el: Element): string {
    if (el.id) {
      const safe = CSS.escape ? CSS.escape(el.id) : el.id.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
      return `#${safe}`;
    }
    const tag = el.tagName.toLowerCase();
    const parent = el.parentElement;
    if (!parent) return tag;
    const siblings = Array.from(parent.children).filter(
      (c) => c.tagName === el.tagName,
    );
    if (siblings.length === 1) {
      const parentSel = parent === document.body ? "body" : cssPath(parent);
      return `${parentSel} > ${tag}`;
    }
    const idx = siblings.indexOf(el) + 1;
    const parentSel = parent === document.body ? "body" : cssPath(parent);
    return `${parentSel} > ${tag}:nth-of-type(${idx})`;
  }

  function labelFor(el: Element): string {
    const aria = el.getAttribute("aria-label");
    if (aria && aria.trim()) return aria.trim().slice(0, 80);
    const heading = el.querySelector("h1, h2, h3");
    if (heading && heading.textContent) {
      return heading.textContent.trim().replace(/\s+/g, " ").slice(0, 80);
    }
    if (el.tagName === "H1" || el.tagName === "H2" || el.tagName === "H3") {
      return (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80);
    }
    const id = el.id;
    if (id) return id;
    const role = el.getAttribute("role");
    if (role) return role;
    return el.tagName.toLowerCase();
  }

  function addCand(el: Element | null) {
    if (!el || used.has(el)) return;
    // skip tiny / invisible
    const rect = el.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 24) return;
    used.add(el);
    candidates.push({
      el,
      label: labelFor(el),
      selector: cssPath(el),
      tagName: el.tagName.toLowerCase(),
    });
  }

  // Prefer semantic landmarks
  for (const sel of [
    "header",
    "nav",
    "main",
    "[role='main']",
    "footer",
    "aside",
    "section",
    "article",
  ]) {
    for (const el of Array.from(document.querySelectorAll(sel))) {
      addCand(el);
    }
  }

  // Headings as section anchors when not already covered
  for (const h of Array.from(document.querySelectorAll("h1, h2"))) {
    const section = h.closest("section, article, main, header, footer") || h;
    addCand(section);
  }

  // Direct children of main / [role=main] / body as fallback blocks
  const main =
    document.querySelector("main") ||
    document.querySelector("[role='main']") ||
    document.body;
  if (main) {
    for (const child of Array.from(main.children)) {
      if (
        ["SCRIPT", "STYLE", "LINK", "NOSCRIPT", "TEMPLATE"].includes(
          child.tagName,
        )
      ) {
        continue;
      }
      // Skip empty/tiny generic nodes early (IR hygiene also runs post-extract)
      const tag = child.tagName.toLowerCase();
      const text = (child.textContent || "").trim();
      const rect = child.getBoundingClientRect();
      if (
        (tag === "div" || tag === "span") &&
        text.length < 16 &&
        rect.height < 48
      ) {
        continue;
      }
      addCand(child);
    }
  }

  // Cap section count for IR readability
  const limited = candidates.slice(0, 40);

  // Note: extract runs in the browser via page.evaluate; keep typing loose here.
  const sections = limited.map((c): RawSectionCandidate => {
    const el = c.el;
    const rect = el.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    let styles: Record<string, string> = {};
    try {
      const cs = getComputedStyle(el);
      styles = {
        display: cs.display,
        position: cs.position,
        backgroundColor: cs.backgroundColor,
        color: cs.color,
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        padding: cs.padding,
        margin: cs.margin,
      };
    } catch {
      styles = {};
    }

    const childTags = Array.from(el.children)
      .slice(0, 12)
      .map((ch) => ch.tagName.toLowerCase());

    // Structured text model (headings / CTAs / lists) — not one giant blob only
    function cleanText(raw: string, max = 240) {
      return String(raw || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max);
    }
    function uniqLines(items: string[], maxItems: number) {
      const seen = new Set();
      const out = [];
      for (const it of items) {
        const t = cleanText(it);
        if (!t) continue;
        const k = t.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(t);
        if (out.length >= maxItems) break;
      }
      return out;
    }

    const headings = uniqLines(
      Array.from(el.querySelectorAll("h1,h2,h3,h4,h5,h6")).map(
        (n) => n.textContent || "",
      ),
      12,
    );
    const paragraphs = uniqLines(
      Array.from(el.querySelectorAll("p")).map((n) => n.textContent || ""),
      16,
    );
    const listItems = uniqLines(
      Array.from(el.querySelectorAll("li")).map((n) => n.textContent || ""),
      40,
    );

    const ctas: Array<{ label: string; href?: string; role?: string }> = [];
    const ctaSeen = new Set<string>();
    const ctaNodes = Array.from(
      el.querySelectorAll(
        "a[href], button, [role='button'], input[type='submit'], input[type='button']",
      ),
    ).slice(0, 24);
    for (let ci = 0; ci < ctaNodes.length; ci++) {
      const node = ctaNodes[ci] as Element;
      let label = cleanText(
        node.getAttribute("aria-label") ||
          node.getAttribute("value") ||
          node.textContent ||
          "",
        120,
      );
      if (!label || label.length < 1) continue;
      const href =
        node.tagName === "A"
          ? cleanText(node.getAttribute("href") || "", 500)
          : "";
      const key = label.toLowerCase() + "|" + href;
      if (ctaSeen.has(key)) continue;
      ctaSeen.add(key);
      let role = "link";
      if (node.tagName === "BUTTON" || node.getAttribute("role") === "button") {
        role = "button";
      }
      const cls = typeof (node as HTMLElement).className === "string"
        ? (node as HTMLElement).className
        : "";
      if (/primary|btn-primary|cta-primary/i.test(cls)) role = "primary";
      else if (/secondary|btn-secondary|ghost|outline/i.test(cls)) {
        role = "secondary";
      } else if (ci === 0 && role === "button") role = "primary";
      else if (ci === 1 && (role === "button" || role === "link")) {
        role = "secondary";
      }
      const cta: { label: string; href?: string; role?: string } = {
        label,
        role,
      };
      if (href) cta.href = href;
      ctas.push(cta);
      if (ctas.length >= 16) break;
    }

    const labels = uniqLines(
      [
        ...Array.from(el.querySelectorAll("figcaption, dt, legend")).map(
          (n) => n.textContent || "",
        ),
        ...Array.from(el.querySelectorAll("[data-label], .eyebrow, .kicker, .badge"))
          .slice(0, 8)
          .map((n) => n.textContent || ""),
      ],
      20,
    );

    // Eyebrow: small text before first heading
    let eyebrow = "";
    if (headings.length) {
      const h = el.querySelector("h1,h2,h3");
      if (h) {
        let prev = h.previousElementSibling;
        let hops = 0;
        while (prev && hops < 3) {
          const t = cleanText(prev.textContent || "", 120);
          if (t && t.length < 80 && t !== headings[0]) {
            eyebrow = t;
            break;
          }
          prev = prev.previousElementSibling;
          hops++;
        }
      }
    }

    const textModel: PageIRSectionText = {
      headings,
      paragraphs,
      listItems,
      ctas,
      ...(eyebrow ? { eyebrow } : {}),
      ...(labels.length ? { labels } : {}),
    };

    const sampleParts: string[] = [];
    if (eyebrow) sampleParts.push(eyebrow);
    for (const h of headings.slice(0, 2)) sampleParts.push(h);
    for (const p of paragraphs.slice(0, 2)) sampleParts.push(p);
    for (const li of listItems.slice(0, 3)) sampleParts.push(li);
    for (const cta of ctas.slice(0, 3)) sampleParts.push(cta.label);
    const text = cleanText(sampleParts.join(" "), 200);

    // Heuristic interaction model
    let interactionModel: InteractionModel = "static";
    const hasButton = !!el.querySelector(
      "button, a[href], [role='button'], input, select",
    );
    const hasHoverHint =
      el.matches(":hover") ||
      !!el.querySelector("[class*='hover'], [data-hover]");
    const className = typeof el.className === "string" ? el.className : "";
    if (
      /carousel|slider|tabs|accordion|modal|dialog/i.test(className) ||
      el.querySelector("[aria-haspopup], [data-state]")
    ) {
      interactionModel = "hybrid";
    } else if (hasButton && hasHoverHint) {
      interactionModel = "hybrid";
    } else if (hasButton) {
      interactionModel = "click";
    } else if (
      /parallax|scroll|sticky/i.test(className) ||
      getComputedStyle(el).position === "sticky"
    ) {
      interactionModel = "scroll";
    }

    return {
      label: c.label,
      selector: c.selector,
      textSample: text,
      text: textModel,
      tagName: c.tagName,
      boundingBox: {
        x: Math.round(rect.x + scrollX),
        y: Math.round(rect.y + scrollY),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      styles,
      childrenHints: childTags,
      interactionModel,
    };
  });

  const notes: string[] = [];
  if (sections.length === 0) {
    notes.push("No section candidates found; page may be canvas/empty/shadow-only.");
  }

  return {
    title,
    fonts: Array.from(fontSet).slice(0, 40),
    colors: Array.from(colorSet).slice(0, 60),
    cssVariables,
    assets: assets.slice(0, 200),
    sections,
    notes,
  };
}

export interface WriteCaptureReadmeOptions {
  sourceUrl: string;
  irPath: string;
  screenshotPath: string | null;
  playwrightMissing: boolean;
}

/**
 * README explaining capture output: recon for React rebuild, not HTML dump.
 */
export function writeCaptureReadme(
  outDir: string,
  opts: WriteCaptureReadmeOptions,
): string {
  const abs = path.resolve(outDir);
  const readmePath = path.join(abs, "README.md");
  const shotRel = opts.screenshotPath
    ? path.relative(abs, opts.screenshotPath).replace(/\\/g, "/")
    : null;

  const lines = [
    `# ctrlc capture`,
    ``,
    `Deterministic-style **recon** for rebuilding a page as **React sections**`,
    `(SectionPack). This is **not** an HTML dump or static mirror product.`,
    ``,
    `## Source`,
    ``,
    `- URL: ${opts.sourceUrl}`,
    `- IR: \`${path.basename(opts.irPath)}\``,
    shotRel ? `- Screenshot: \`${shotRel}\`` : `- Screenshot: _(not written)_`,
    ``,
    `## Layout`,
    ``,
    `- \`ir.json\` - Page IR`,
    `- \`screenshot.png\` - full-page PNG (F2 baseline source; written when Playwright runs)`,
    `- \`screenshots/full.png\` - secondary copy of the same image`,
    `- \`README.md\` - this file`,
    ``,
    `Promote a baseline into a host app with \`ctrlc baseline --ir <ir.json>\``,
    `(default: \`docs/research/baselines/<host>-page.png\`).`,
    ``,
    `## What this is for`,
    ``,
    `1. Read \`ir.json\` (Page IR) for section candidates, tokens, and assets.`,
    `2. Write component specs under \`docs/research/components/<id>.spec.md\`.`,
    `3. Rebuild each section as React + content + CSS.`,
    `4. Register with SectionPack (\`ctrlc register\` / config) for NL + code export.`,
    ``,
    `## Scope`,
    ``,
    `Sprint 2 foundation: **page only** (one URL -> one IR). Site crawl comes later.`,
    ``,
    opts.playwrightMissing
      ? [
          `## Playwright missing`,
          ``,
          `Live browser capture did not run. Install the optional peer:`,
          ``,
          `\`\`\`bash`,
          `npm install -D playwright`,
          `npx playwright install chromium`,
          `ctrlc capture <url> --out ${path.basename(abs) === "runs" ? abs : path.relative(process.cwd(), abs) || abs}`,
          `\`\`\``,
          ``,
        ].join("\n")
      : "",
    `## Product philosophy`,
    ``,
    `- React components, not pasted markup.`,
    `- SectionPack dual export (natural language + multi-file code) per section.`,
    `- Capture IR is recon input for agents and tools - not the deliverable site.`,
    ``,
  ].filter((block) => block !== "");

  fs.writeFileSync(readmePath, lines.join("\n") + "\n", "utf8");
  return readmePath;
}
