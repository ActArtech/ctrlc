/**
 * Map section specs / recon notes into BehaviorBriefSpec fields
 * for SectionPack natural-language export.
 */

import type { BehaviorBriefSpec } from "./types";

export type InteractionModel =
  | "static"
  | "click"
  | "scroll"
  | "hover"
  | "time"
  | "hybrid";

export type SpecToBehaviorInput = {
  id: string;
  label?: string;
  description?: string;
  /** INTERACTION MODEL from component spec */
  interactionModel?: InteractionModel | string;
  /** Free-text bullets from recon */
  behaviorNotes?: string[];
  motionNotes?: string[];
  layoutNotes?: string[];
  colorNotes?: string[];
  typeNotes?: string[];
  responsiveNotes?: string[];
  a11yNotes?: string[];
  influenceNotes?: string[];
  rebuildNotes?: string[];
  /** Optional what/function overrides */
  whatItIs?: string;
  function?: string;
};

function modelToBehaviorLines(model: string | undefined): string[] {
  const m = (model || "static").toLowerCase();
  switch (m) {
    case "scroll":
      return [
        "Primary interaction is scroll-driven (IntersectionObserver, sticky, or scroll listeners).",
        "Do not implement as click-only tabs unless the source is click-driven.",
      ];
    case "click":
      return [
        "Primary interaction is click/tap to switch state (tabs, accordion, toggles).",
        "Each interactive control should have a clear selected/active visual state.",
      ];
    case "hover":
      return [
        "Primary affordance is hover/focus motion on desktop; provide keyboard-focus equivalents.",
      ];
    case "time":
      return [
        "Content or motion advances on a timer (carousel, cycle); pause on reduced-motion when possible.",
      ];
    case "hybrid":
      return [
        "Combines multiple drivers (e.g. scroll + click). Document which control wins at each breakpoint.",
      ];
    default:
      return ["Mostly presentational; limited interactive state."];
  }
}

const REDUCED_MOTION_RE = /reduced[- ]?motion|prefers-reduced-motion/i;

const DEFAULT_REDUCED_MOTION_NOTE =
  "Honor prefers-reduced-motion: disable or simplify non-essential animation; provide static fallbacks.";

/** Interaction models that typically involve motion (F5). */
const MOTION_INTERACTION_MODELS = new Set([
  "scroll",
  "time",
  "hover",
  "hybrid",
]);

function mentionsReducedMotion(lines: string[] | undefined): boolean {
  return (lines ?? []).some((l) => REDUCED_MOTION_RE.test(l));
}

function modelToMotionLines(model: string | undefined): string[] {
  const m = (model || "static").toLowerCase();
  switch (m) {
    case "scroll":
      return [
        "Motion tied to scroll progress or enter-viewport reveals.",
        "Prefer CSS transitions/IntersectionObserver over click-only fades.",
        "Under prefers-reduced-motion, show final state without scroll-linked animation.",
      ];
    case "click":
      return [
        "State transitions on click (opacity/slide) with short ease (~0.2-0.4s).",
        "Respect prefers-reduced-motion with instant or minimal state changes.",
      ];
    case "hover":
      return [
        "Hover transitions on color, transform, or shadow.",
        "Under prefers-reduced-motion, skip transform/parallax; keep color/focus feedback.",
      ];
    case "time":
      return [
        "Timed autoplay or cycle; respect prefers-reduced-motion.",
        "Pause or disable autoplay when prefers-reduced-motion is set.",
      ];
    case "hybrid":
      return [
        "Layer scroll and pointer motion carefully; avoid fighting scroll on touch.",
        "Under prefers-reduced-motion, prefer static layout and non-animated state switches.",
      ];
    default:
      return [
        "Minimal motion; optional fade-in on enter.",
        "Honor prefers-reduced-motion with static presentation when any motion is added.",
      ];
  }
}

/**
 * Ensure motion/a11y carry a reduced-motion note.
 * For scroll/time/hover/hybrid, prefer the motion array.
 */
function withReducedMotionGuidance(
  model: string,
  motion: string[],
  a11y: string[],
): { motion: string[]; a11y: string[] } {
  if (mentionsReducedMotion(motion) || mentionsReducedMotion(a11y)) {
    return { motion, a11y };
  }
  const m = (model || "static").toLowerCase();
  if (MOTION_INTERACTION_MODELS.has(m)) {
    return { motion: [...motion, DEFAULT_REDUCED_MOTION_NOTE], a11y };
  }
  return { motion, a11y: [...a11y, DEFAULT_REDUCED_MOTION_NOTE] };
}

/**
 * Build a BehaviorBriefSpec from a section specification / recon notes.
 * Used by the ctrlc-clone skill and `ctrlc register --from-spec`.
 */
export function behaviorFromSpec(input: SpecToBehaviorInput): BehaviorBriefSpec {
  const label = input.label || input.id;
  const model = input.interactionModel || "static";

  let motion = input.motionNotes?.length
    ? [...input.motionNotes]
    : modelToMotionLines(model);
  let a11y = input.a11yNotes?.length
    ? [...input.a11yNotes]
    : ["Preserve landmarks, button/link semantics, and alt text from the source."];

  // F5: always include reduced-motion guidance (motion models get it on motion[])
  ({ motion, a11y } = withReducedMotionGuidance(String(model), motion, a11y));

  return {
    id: input.id,
    whatItIs:
      input.whatItIs ||
      input.description ||
      `Section "${label}" rebuilt as a React component for the target page.`,
    function:
      input.function ||
      `Deliver the visual and interactive role of "${label}" on the cloned page.`,
    behavior: [
      ...(input.behaviorNotes?.length
        ? input.behaviorNotes
        : modelToBehaviorLines(model)),
      `INTERACTION MODEL: ${model}`,
    ],
    motion,
    layout: input.layoutNotes?.length
      ? input.layoutNotes
      : ["Match source hierarchy and spacing from the section spec."],
    color: input.colorNotes?.length
      ? input.colorNotes
      : ["Use extracted design tokens; do not invent brand colors."],
    type: input.typeNotes?.length
      ? input.typeNotes
      : ["Match extracted font families, sizes, and weights from the spec."],
    responsive: input.responsiveNotes?.length
      ? input.responsiveNotes
      : [
          "Document desktop (1440), tablet (768), and mobile (390) layouts from recon.",
        ],
    a11y,
    influences: input.influenceNotes?.length
      ? input.influenceNotes
      : [
          "Spec file under docs/research/components/",
          "Shared tokens/globals from foundation phase",
          "Assets under public/",
        ],
    rebuildGuidance: input.rebuildNotes?.length
      ? input.rebuildNotes
      : [
          "React component only - never ship HTML dump as the product.",
          "Register SectionPack config + SectionBoundary after the component builds.",
          "Verify describe + prompt exports before marking the section done.",
        ],
  };
}

/**
 * Parse a minimal subset of a section.spec.md into SpecToBehaviorInput.
 * Best-effort; missing fields stay undefined.
 */
export function parseSpecMarkdown(
  id: string,
  markdown: string,
): SpecToBehaviorInput {
  const get = (re: RegExp) => {
    const m = markdown.match(re);
    return m?.[1]?.trim();
  };

  const interactionModel =
    get(/INTERACTION MODEL[:\s|*]+([a-zA-Z-]+)/i) ||
    get(/\*\*Interaction model:\*\*\s*([^\n|]+)/i) ||
    get(/interaction model[:\s|*]+([a-zA-Z-]+)/i);

  const label =
    get(/^#\s+Section spec:\s*`?([^`\n]+)`?/m) ||
    get(/^#\s+(.+?)\s+Specification/m);

  const bullets = (heading: string) => {
    const re = new RegExp(
      `##\\s*${heading}[\\s\\S]*?(?=\\n##\\s|$)`,
      "i",
    );
    const block = markdown.match(re)?.[0] ?? "";
    return [...block.matchAll(/^\s*[-*]\s+(.+)$/gm)].map((m) => m[1].trim());
  };

  return {
    id,
    label: label?.replace(/`/g, "").trim(),
    interactionModel: interactionModel?.toLowerCase().replace(/-driven$/, ""),
    behaviorNotes: bullets("States|Behavior"),
    motionNotes: bullets("Motion"),
    layoutNotes: bullets("Structure|Layout"),
    colorNotes: [],
    responsiveNotes: bullets("Responsive"),
    a11yNotes: [],
    influenceNotes: bullets("Assets"),
  };
}
