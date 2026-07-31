/**
 * Heuristic analysis of section component + CSS sources.
 * Produces draft BehaviorBriefSpec fragments and diagnostic notes
 * so hosts do not need hand-written briefs for every field.
 */

import type { BehaviorBriefSpec, SectionPackEntry } from "./types";

export type AnalyzeSectionEntry = Pick<
  SectionPackEntry,
  | "id"
  | "label"
  | "description"
  | "tags"
  | "promptRole"
  | "contentKeys"
  | "cssSelectors"
  | "componentExport"
  | "componentPath"
  | "contentModulePath"
  | "relatedPaths"
>;

export type AnalyzeSectionSourcesInput = {
  componentSource: string;
  cssSource: string;
  entry: AnalyzeSectionEntry;
};

/** Detected signal groups (raw facts before NL phrasing). */
export type SectionAnalysisSignals = {
  motion: string[];
  interaction: string[];
  layout: string[];
  color: string[];
  /** Import specifiers found in the component source */
  imports: string[];
};

/**
 * Partial brief draft + notes. Fields may be omitted when no signal fires.
 * Always includes `id` and identity strings derived from the entry.
 */
export type AnalyzeSectionResult = {
  draft: Partial<BehaviorBriefSpec> & { id: string };
  notes: string[];
  signals: SectionAnalysisSignals;
};

function uniq(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const t = item.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function has(re: RegExp, text: string): boolean {
  re.lastIndex = 0;
  return re.test(text);
}

function collectMatches(re: RegExp, text: string, max = 24): string[] {
  const out: string[] = [];
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  const g = new RegExp(re.source, flags);
  let m: RegExpExecArray | null;
  while ((m = g.exec(text)) !== null) {
    const v = (m[1] ?? m[0]).trim();
    if (v) out.push(v);
    if (out.length >= max) break;
  }
  return uniq(out);
}

/** Strip // and /* comments so string matches stay in code. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function extractImports(componentSource: string): string[] {
  const src = stripComments(componentSource);
  const specs: string[] = [];

  // import ... from "x" | import "x"
  const fromRe =
    /\bimport\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = fromRe.exec(src)) !== null) {
    specs.push(m[1]);
  }

  // export ... from "x"
  const reExport = /\bexport\s+[\s\S]*?\sfrom\s+["']([^"']+)["']/g;
  while ((m = reExport.exec(src)) !== null) {
    specs.push(m[1]);
  }

  // dynamic import("x")
  const dyn = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
  while ((m = dyn.exec(src)) !== null) {
    specs.push(m[1]);
  }

  return uniq(specs);
}

function detectMotion(
  component: string,
  css: string,
  notes: string[],
): { signals: string[]; lines: string[] } {
  const signals: string[] = [];
  const lines: string[] = [];
  const c = stripComments(component);
  const combined = `${c}\n${css}`;

  if (has(/@keyframes\b/i, css)) {
    const names = collectMatches(/@keyframes\s+([A-Za-z0-9_-]+)/gi, css);
    signals.push("keyframes");
    lines.push(
      names.length
        ? `CSS @keyframes present (${names.join(", ")}).`
        : "CSS @keyframes present.",
    );
  }

  if (has(/\banimation(?:-name)?\s*:/i, css) || has(/\banimation\s*:/i, css)) {
    signals.push("css-animation");
    lines.push("CSS animation properties applied to section styles.");
  }

  if (has(/\btransition(?:-[a-z]+)?\s*:/i, css)) {
    signals.push("css-transition");
    lines.push("CSS transitions for state/hover changes.");
  }

  if (has(/\btransform\s*:/i, css) || has(/\btransform\s*:/i, c)) {
    signals.push("transform");
    lines.push("Transform-based motion (scale, translate, or rotate).");
  }

  if (
    has(/\bframer-motion\b/i, combined) ||
    has(/\bfrom\s+["']framer-motion["']/i, c) ||
    has(/\bmotion\./, c) ||
    has(/\bAnimatePresence\b/, c)
  ) {
    signals.push("framer-motion");
    lines.push("Framer Motion (or motion.*) used for animated UI.");
  }

  if (has(/\brequestAnimationFrame\b/, c)) {
    signals.push("raf");
    lines.push("requestAnimationFrame-driven animation loop.");
  }

  if (
    has(/\buseSpring\b|\buseAnimation\b|\buseMotionValue\b|\banimate\s*\(/, c)
  ) {
    signals.push("js-animation-api");
    lines.push("JS animation helpers (spring/animate APIs) detected.");
  }

  if (has(/\bwill-change\s*:/i, css)) {
    signals.push("will-change");
    notes.push("will-change hints compositor-optimized motion.");
  }

  if (lines.length === 0) {
    lines.push("No strong motion signals; treat as mostly static chrome.");
    notes.push("motion: no animation/transition/keyframes/framer signals");
  } else if (!lines.some((l) => /reduced[- ]?motion|prefers-reduced-motion/i.test(l))) {
    // F5: motion-bearing sections always document reduced-motion fallback
    lines.push(
      "Honor prefers-reduced-motion: disable or simplify non-essential animation; provide static fallbacks.",
    );
  }

  return { signals: uniq(signals), lines: uniq(lines) };
}

function detectInteraction(
  component: string,
  notes: string[],
): { signals: string[]; lines: string[] } {
  const signals: string[] = [];
  const lines: string[] = [];
  const c = stripComments(component);

  if (has(/\bonClick\b/, c)) {
    signals.push("onClick");
    lines.push("Click handlers (onClick) drive primary interactions.");
  }
  if (has(/\bonPointer(Down|Up|Move|Enter|Leave)?\b/, c)) {
    signals.push("onPointer");
    lines.push("Pointer events for press/hover-style interaction.");
  }
  if (has(/\bonMouse(Enter|Leave|Down|Up|Move)\b/, c)) {
    signals.push("onMouse");
    lines.push("Mouse enter/leave or move handlers present.");
  }
  if (has(/\bonKey(Down|Up|Press)\b/, c)) {
    signals.push("keyboard");
    lines.push("Keyboard handlers for operable controls.");
  }
  if (
    has(/\bdrag(?:Start|End|Over|Leave)?\b/i, c) ||
    has(/\bonDrag\b/, c) ||
    has(/\bdraggable\b/, c)
  ) {
    signals.push("drag");
    lines.push("Drag interaction patterns present.");
  }
  if (has(/\buseState\b/, c) || has(/\buseReducer\b/, c)) {
    signals.push("local-state");
    lines.push("Local React state (useState/useReducer) for UI modes.");
  }
  if (
    has(/\brole\s*=\s*["']tab["']/i, c) ||
    has(/\baria-selected\b/i, c) ||
    (has(/\btabs?\b/i, c) &&
      has(/\bsetActive\b|\bactiveTab\b|\bselectedIndex\b/, c))
  ) {
    signals.push("tabs");
    lines.push("Tab-like selection UI (tabs / aria-selected).");
  }
  if (
    has(/\baccordion\b/i, c) ||
    has(/\b<details\b/i, c) ||
    has(/\b<summary\b/i, c) ||
    has(/\bsetOpen\b|\bsetIsOpen\b|\bisOpen\b/, c)
  ) {
    signals.push("accordion-or-disclosure");
    lines.push("Disclosure/accordion open-close pattern.");
  }
  if (has(/\baria-expanded\b/i, c)) {
    signals.push("aria-expanded");
    lines.push("Expandable control with aria-expanded.");
  }
  if (has(/\bhref\s*=/, c) || has(/<a\b/i, c) || has(/\bLink\b/, c)) {
    signals.push("links");
    lines.push("In-section links or routed Link components.");
  }
  if (has(/<button\b/i, c) || has(/\btype\s*=\s*["']button["']/, c)) {
    signals.push("buttons");
    lines.push("Button controls for actions.");
  }

  if (lines.length === 0) {
    lines.push("Mostly presentational; little interactive state detected.");
    notes.push("interaction: no click/pointer/state/tab patterns");
  }

  return { signals: uniq(signals), lines: uniq(lines) };
}

function detectLayout(
  component: string,
  css: string,
  notes: string[],
): { signals: string[]; lines: string[] } {
  const signals: string[] = [];
  const lines: string[] = [];
  const c = stripComments(component);
  const combined = `${css}\n${c}`;

  if (has(/display\s*:\s*flex\b/i, css) || has(/display\s*:\s*flex\b/i, combined)) {
    signals.push("flex");
    lines.push("Flexbox layout (display: flex).");
  }

  if (has(/display\s*:\s*grid\b/i, css) || has(/display\s*:\s*grid\b/i, combined)) {
    signals.push("grid");
    lines.push("CSS Grid layout (display: grid).");
  }

  if (has(/flex-direction\s*:/i, css)) {
    signals.push("flex-direction");
    const dir = collectMatches(/flex-direction\s*:\s*([a-z-]+)/gi, css)[0];
    lines.push(
      dir
        ? `Flex direction: ${dir}.`
        : "Explicit flex-direction controls stacking axis.",
    );
  }

  if (has(/grid-template(?:-columns|-rows)?\s*:/i, css)) {
    signals.push("grid-template");
    lines.push("Grid template defines track structure.");
  }

  if (has(/position\s*:\s*sticky\b/i, css)) {
    signals.push("sticky");
    lines.push("Sticky positioning (stays in view while scrolling).");
  }

  if (has(/position\s*:\s*fixed\b/i, css)) {
    signals.push("fixed");
    lines.push("Fixed positioning relative to the viewport.");
  }

  if (has(/max-width\s*:/i, css)) {
    signals.push("max-width");
    const vals = collectMatches(/max-width\s*:\s*([^;!}]+)/gi, css, 4);
    lines.push(
      vals.length
        ? `Max-width constraints (${vals.join(", ").trim()}).`
        : "Max-width constraints limit content measure.",
    );
  }

  if (has(/text-align\s*:/i, css)) {
    signals.push("text-align");
    const aligns = collectMatches(/text-align\s*:\s*([a-z]+)/gi, css, 4);
    lines.push(
      aligns.length
        ? `Text alignment: ${uniq(aligns).join(", ")}.`
        : "Explicit text-align for content alignment.",
    );
  }

  if (has(/align-items\s*:/i, css) || has(/justify-content\s*:/i, css)) {
    signals.push("axis-alignment");
    lines.push("Cross/main-axis alignment via align-items / justify-content.");
  }

  if (has(/\bgap\s*:/i, css)) {
    signals.push("gap");
    lines.push("Gap-based spacing between flex/grid children.");
  }

  // Tailwind-ish class hints in JSX
  if (has(/\bclass(?:Name)?\s*=\s*["'][^"']*\bflex\b/, c)) {
    if (!signals.includes("flex")) {
      signals.push("flex");
      lines.push("Flex utility classes on the component.");
    }
  }
  if (has(/\bclass(?:Name)?\s*=\s*["'][^"']*\bgrid\b/, c)) {
    if (!signals.includes("grid")) {
      signals.push("grid");
      lines.push("Grid utility classes on the component.");
    }
  }

  if (lines.length === 0) {
    lines.push("Standard block flow; no flex/grid/sticky signals found.");
    notes.push("layout: no flex/grid/sticky/max-width signals");
  }

  return { signals: uniq(signals), lines: uniq(lines) };
}

function detectColor(
  css: string,
  notes: string[],
): { signals: string[]; lines: string[] } {
  const signals: string[] = [];
  const lines: string[] = [];

  const hex = collectMatches(
    /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g,
    css,
    12,
  );
  if (hex.length) {
    signals.push("hex");
    lines.push(`Hex colors in styles: ${hex.slice(0, 8).join(", ")}.`);
  }

  const rgb = collectMatches(
    /rgba?\(\s*[^)]+\)/gi,
    css,
    8,
  );
  if (rgb.length) {
    signals.push("rgb");
    lines.push(`rgb/rgba colors present (${rgb.length} occurrence(s)).`);
  }

  const hsl = collectMatches(/hsla?\(\s*[^)]+\)/gi, css, 6);
  if (hsl.length) {
    signals.push("hsl");
    lines.push(`hsl/hsla colors present (${hsl.length} occurrence(s)).`);
  }

  const varsUsed = collectMatches(/var\(\s*(--[A-Za-z0-9-_]+)/g, css, 16);
  if (varsUsed.length) {
    signals.push("css-vars-use");
    lines.push(
      `CSS custom properties via var(): ${varsUsed.slice(0, 10).join(", ")}.`,
    );
  }

  const varsDefined = collectMatches(/(--[A-Za-z0-9-_]+)\s*:/g, css, 16);
  if (varsDefined.length) {
    signals.push("css-vars-define");
    lines.push(
      `Defines CSS variables: ${varsDefined.slice(0, 10).join(", ")}.`,
    );
  }

  if (has(/background(?:-color)?\s*:/i, css)) {
    signals.push("background");
    if (!lines.some((l) => /background|Hex|rgb|var\(/i.test(l))) {
      lines.push("Background color/surface declarations present.");
    }
  }

  if (has(/gradient\(/i, css)) {
    signals.push("gradient");
    lines.push("Gradient fills for surfaces or text.");
  }

  if (lines.length === 0) {
    lines.push("No explicit hex/rgb/css-var color tokens found in scoped CSS.");
    notes.push("color: no hex/rgb/var tokens in cssSource");
  }

  return { signals: uniq(signals), lines: uniq(lines) };
}

function detectType(css: string, component: string): string[] {
  const lines: string[] = [];
  if (has(/font-size\s*:/i, css)) {
    const sizes = collectMatches(/font-size\s*:\s*([^;!}]+)/gi, css, 4);
    lines.push(
      sizes.length
        ? `Font sizes: ${uniq(sizes.map((s) => s.trim())).join(", ")}.`
        : "Explicit font-size rules.",
    );
  }
  if (has(/font-weight\s*:/i, css)) {
    lines.push("Explicit font-weight rules.");
  }
  if (has(/letter-spacing\s*:/i, css) || has(/line-height\s*:/i, css)) {
    lines.push("Letter-spacing and/or line-height tuned for hierarchy.");
  }
  if (has(/font-family\s*:/i, css)) {
    lines.push("Custom font-family on section styles.");
  }
  if (has(/text-transform\s*:\s*uppercase/i, css)) {
    lines.push("Uppercase text transform for micro-labels.");
  }
  if (has(/<h[1-6]\b/i, component)) {
    lines.push("Semantic heading element(s) for title hierarchy.");
  }
  if (lines.length === 0) {
    lines.push("Typography mostly inherits from shared design tokens.");
  }
  return uniq(lines);
}

function detectResponsive(css: string): string[] {
  const lines: string[] = [];
  if (has(/@media\b/i, css)) {
    const queries = collectMatches(/@media\s*([^{]+)/gi, css, 6);
    lines.push(
      queries.length
        ? `Media queries: ${queries.map((q) => q.trim()).join("; ")}.`
        : "Responsive @media rules present.",
    );
  }
  if (has(/\bclamp\s*\(/i, css)) {
    lines.push("clamp() used for fluid sizing.");
  }
  if (has(/\bmin-width\s*:/i, css) || has(/\bmax-width\s*:/i, css)) {
    if (!lines.some((l) => /Media queries|clamp/i.test(l))) {
      lines.push("Width constraints that may affect small screens.");
    }
  }
  if (lines.length === 0) {
    lines.push("No section-local media queries; rely on shared breakpoints.");
  }
  return uniq(lines);
}

function detectA11y(component: string): string[] {
  const c = stripComments(component);
  const lines: string[] = [];
  if (has(/\baria-[a-z]+\b/i, c)) {
    const attrs = collectMatches(/\b(aria-[a-z]+)\b/gi, c, 12);
    lines.push(
      attrs.length
        ? `ARIA attributes: ${attrs.join(", ")}.`
        : "ARIA attributes present.",
    );
  }
  if (has(/\brole\s*=/i, c)) {
    const roles = collectMatches(/\brole\s*=\s*["']([^"']+)["']/gi, c, 8);
    lines.push(
      roles.length
        ? `Explicit roles: ${roles.join(", ")}.`
        : "Explicit role attributes.",
    );
  }
  if (has(/\balt\s*=/i, c)) {
    lines.push("img alt text attributes present.");
  }
  if (has(/<button\b/i, c) || has(/<a\b/i, c)) {
    lines.push("Native interactive elements (button/anchor) preferred when present.");
  }
  if (has(/tabIndex|tabindex/i, c)) {
    lines.push("tabIndex used; verify keyboard order.");
  }
  if (lines.length === 0) {
    lines.push("Ensure keyboard operability and accessible names for controls.");
  }
  // F5: a11y drafts always mention reduced-motion unless motion field will cover it
  // (analyze attaches the full note on motion when motion signals fire; here we
  // add a short a11y baseline when none is present so static sections still note it.)
  if (!lines.some((l) => /reduced[- ]?motion|prefers-reduced-motion/i.test(l))) {
    lines.push(
      "Respect prefers-reduced-motion when any animation or autoplay is introduced.",
    );
  }
  return uniq(lines);
}

function buildInfluences(
  entry: AnalyzeSectionEntry,
  imports: string[],
): string[] {
  const lines: string[] = [];
  lines.push(`Component: \`${entry.componentPath}\` export \`${entry.componentExport}\`.`);
  if (entry.contentModulePath) {
    lines.push(
      `Content module: \`${entry.contentModulePath}\`${
        entry.contentKeys.length
          ? ` keys ${entry.contentKeys.map((k) => `\`${k}\``).join(", ")}`
          : ""
      }.`,
    );
  }
  if (entry.cssSelectors?.length) {
    lines.push(
      `Primary CSS selectors: ${entry.cssSelectors.map((s) => `\`${s}\``).join(", ")}.`,
    );
  }
  if (entry.relatedPaths?.length) {
    lines.push(
      `Related paths: ${entry.relatedPaths.map((p) => `\`${p}\``).join(", ")}.`,
    );
  }
  if (imports.length) {
    lines.push(
      `Import influence candidates: ${imports
        .slice(0, 16)
        .map((s) => `\`${s}\``)
        .join(", ")}.`,
    );
  }
  return lines;
}

function buildRebuildGuidance(
  entry: AnalyzeSectionEntry,
  signals: SectionAnalysisSignals,
): string[] {
  const lines: string[] = [
    "Prefer multi-file structure: component + content module + scoped CSS.",
    "Match interaction quality and visual hierarchy from the source pack.",
  ];
  if (signals.motion.length && !signals.motion.includes("none")) {
    lines.push("Preserve motion character (timing and trigger) described above.");
  }
  if (signals.interaction.includes("local-state")) {
    lines.push("Keep local UI state explicit; avoid baking open/closed into CSS only.");
  }
  if (entry.contentKeys.length) {
    lines.push(
      `Wire real content fields (${entry.contentKeys.join(", ")}) rather than lorem.`,
    );
  }
  if (signals.layout.includes("sticky") || signals.layout.includes("fixed")) {
    lines.push("Preserve sticky/fixed chrome behavior across breakpoints.");
  }
  return uniq(lines);
}

/**
 * Analyze component + CSS sources and return a structured draft brief fragment.
 * Heuristics only; hosts should treat output as a starting point.
 */
export function analyzeSectionSources(
  input: AnalyzeSectionSourcesInput,
): AnalyzeSectionResult {
  const { componentSource = "", cssSource = "", entry } = input;
  const notes: string[] = [];

  if (!componentSource.trim()) {
    notes.push("componentSource empty; interaction/import signals limited");
  }
  if (!cssSource.trim()) {
    notes.push("cssSource empty; layout/color/motion CSS signals limited");
  }

  const imports = extractImports(componentSource);
  const motion = detectMotion(componentSource, cssSource, notes);
  const interaction = detectInteraction(componentSource, notes);
  const layout = detectLayout(componentSource, cssSource, notes);
  const color = detectColor(cssSource, notes);
  const type = detectType(cssSource, componentSource);
  const responsive = detectResponsive(cssSource);
  const a11y = detectA11y(componentSource);

  const signals: SectionAnalysisSignals = {
    motion: motion.signals,
    interaction: interaction.signals,
    layout: layout.signals,
    color: color.signals,
    imports,
  };

  const whatItIs =
    entry.description?.trim() ||
    `${entry.label} section (${entry.id}).`;

  const fn =
    entry.promptRole?.trim() ||
    `Deliver the ${entry.label} experience for this page section.`;

  const influences = buildInfluences(entry, imports);
  const rebuildGuidance = buildRebuildGuidance(entry, signals);

  const draft: Partial<BehaviorBriefSpec> & { id: string } = {
    id: entry.id,
    whatItIs,
    function: fn,
    behavior: interaction.lines,
    motion: motion.lines,
    layout: layout.lines,
    color: color.lines,
    type,
    responsive,
    a11y,
    influences,
    rebuildGuidance,
  };

  if (signals.layout.includes("flex")) {
    notes.push("layout:flex detected");
  }
  if (signals.layout.includes("grid")) {
    notes.push("layout:grid detected");
  }
  if (imports.length) {
    notes.push(`imports:${imports.length}`);
  }

  return { draft, notes, signals };
}
