/**
 * IR section hygiene for CtrlC capture.
 *
 * 1. Drop empty / tiny / non-landmark noise nodes
 * 2. Dedupe near-duplicate sections
 * 3. Stable short semantic ids (hero, pricing, faq, ...) with full title as label
 */

import type { PageIR, PageIRSection } from "./ir";
import { normalizeSectionId, uniqueSectionIds } from "./section-ids";

export interface HygienizeOptions {
  /** Min meaningful text length for generic nodes (default 16). */
  minTextLength?: number;
  /** Min height px for generic nodes (default 32). */
  minHeight?: number;
  /** Min width px (default 48). */
  minWidth?: number;
  /** Max sections to keep after hygiene (default 24). */
  maxSections?: number;
  /** When true (default), map roles to short ids like hero/pricing/faq. */
  semanticIds?: boolean;
}

export interface HygienizeResult {
  sections: PageIRSection[];
  notes: string[];
  dropped: number;
  deduped: number;
}

const LANDMARK_TAGS = new Set([
  "header",
  "nav",
  "main",
  "footer",
  "aside",
  "section",
  "article",
]);

/** Semantic role → keyword matchers (order = priority when scores tie). */
const SEMANTIC_ROLES: Array<{ id: string; patterns: RegExp[] }> = [
  {
    id: "header",
    patterns: [/^header$/i, /\bsite[- ]?header\b/i, /\bpage[- ]?header\b/i],
  },
  // footer before nav so "Footer navigation" is not stolen by nav
  {
    id: "footer",
    patterns: [
      /^footer$/i,
      /\bfooter[- ]?nav/i,
      /\bsite[- ]?footer\b/i,
      /\bfooter\b/i,
    ],
  },
  {
    id: "nav",
    patterns: [
      /^nav$/i,
      /\bmain[- ]?navigation\b/i,
      /\bmain[- ]?nav\b/i,
      /\bprimary[- ]?nav\b/i,
      /\bnavigation\b/i,
    ],
  },
  {
    id: "pricing",
    patterns: [/\bpricing\b/i, /\bplans?\b/i, /\bsubscription\b/i],
  },
  {
    id: "faq",
    patterns: [/\bfaq\b/i, /frequently asked/i, /\bquestions\b/i],
  },
  {
    id: "templates",
    patterns: [/\btemplates?\b/i, /for every story/i, /template for/i],
  },
  {
    id: "testimonials",
    patterns: [
      /\btestimonials?\b/i,
      /new way to present/i,
      /\breviews?\b/i,
      /\bquotes?\b/i,
    ],
  },
  {
    id: "demo",
    patterns: [/see it in action/i, /\bdemo\b/i, /watch .{0,20}video/i],
  },
  {
    id: "features",
    patterns: [
      /evidence first/i,
      /\bfeatures?\b/i,
      /how it works/i,
      /how we/i,
    ],
  },
  {
    id: "cta",
    patterns: [
      /better stage/i,
      /deserves a better/i,
      /get started/i,
      /create my/i,
      /call to action/i,
      /\bcta\b/i,
    ],
  },
  {
    id: "resources",
    patterns: [/^resources$/i, /\bresources\b/i],
  },
  {
    id: "hero",
    patterns: [
      /\bhero\b/i,
      /professional presentation/i,
      /distill /i,
      /turn .{0,40} into /i,
      /landing/i,
      /jumbotron/i,
    ],
  },
];

function haystack(s: PageIRSection): string {
  return `${s.label || ""} ${s.textSample || ""} ${s.selector || ""}`;
}

function tagFromSelector(selector?: string): string {
  if (!selector) return "";
  const m = selector.match(/(?:^|[\s>+~])([a-z][a-z0-9]*)/i);
  return (m?.[1] || "").toLowerCase();
}

function textLen(s: PageIRSection): number {
  return String(s.textSample || "")
    .replace(/\s+/g, " ")
    .trim().length;
}

function isLandmark(s: PageIRSection): boolean {
  const tag = tagFromSelector(s.selector);
  if (LANDMARK_TAGS.has(tag)) return true;
  const sel = s.selector || "";
  if (/\[role=['"]?(banner|navigation|main|contentinfo|complementary)['"]?\]/i.test(sel)) {
    return true;
  }
  // Semantic ids already applied later; treat known role labels as landmarks
  if (/^(header|nav|footer|main|hero|pricing|faq)$/i.test(s.label || "")) return true;
  return false;
}

function isHidden(s: PageIRSection): boolean {
  const st = s.styles || {};
  const display = String(st.display || "").toLowerCase();
  const visibility = String(st.visibility || "").toLowerCase();
  if (display === "none" || visibility === "hidden") return true;
  return false;
}

/**
 * True when section should be dropped as noise.
 */
export function isJunkSection(
  s: PageIRSection,
  opts: HygienizeOptions = {},
): boolean {
  const minText = opts.minTextLength ?? 16;
  const minH = opts.minHeight ?? 32;
  const minW = opts.minWidth ?? 48;

  if (isHidden(s)) return true;

  const tag = tagFromSelector(s.selector);
  const text = textLen(s);
  const box = s.boundingBox;
  const h = box?.height ?? 9999;
  const w = box?.width ?? 9999;

  // Tiny geometry (when measured)
  if (box && (h < 8 || w < 8)) return true;

  // Empty generic nodes
  if (text === 0) {
    if (tag === "div" || tag === "span" || tag === "" || tag === "body") return true;
    // Empty landmarks with no size are noise
    if (box && h < minH) return true;
  }

  // Generic short/tiny divs that are not landmarks
  if (!isLandmark(s) && (tag === "div" || tag === "span" || tag === "")) {
    if (text < minText && h < minH * 2) return true;
    if (text < 8) return true;
    if (box && (h < minH || w < minW) && text < minText * 2) return true;
  }

  // Id/label literally "div" with little content
  if (/^div$/i.test(s.id) || /^div$/i.test(s.label || "")) {
    if (text < minText) return true;
  }

  return false;
}

function fingerprint(s: PageIRSection): string {
  const t = String(s.textSample || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 96);
  if (t.length >= 24) return `t:${t}`;
  const l = normalizeSectionId(s.label || "");
  return `l:${l}|t:${t}`;
}

function preferenceScore(s: PageIRSection): number {
  let score = 0;
  if (isLandmark(s)) score += 50;
  const tag = tagFromSelector(s.selector);
  if (tag === "header" || tag === "nav" || tag === "footer") score += 20;
  if (tag === "section" || tag === "article" || tag === "main") score += 10;
  if (tag === "div") score -= 5;
  score += Math.min(40, Math.floor(textLen(s) / 8));
  score += Math.min(20, Math.floor((s.boundingBox?.height ?? 0) / 40));
  // Prefer interactive models over pure static noise
  if (s.interactionModel && s.interactionModel !== "static") score += 5;
  return score;
}

/**
 * Keep best section per near-duplicate fingerprint / nested text.
 */
export function dedupeSections(sections: PageIRSection[]): {
  sections: PageIRSection[];
  removed: number;
} {
  const byFp = new Map<string, PageIRSection>();
  let removed = 0;

  for (const s of sections) {
    const fp = fingerprint(s);
    const existing = byFp.get(fp);
    if (!existing) {
      byFp.set(fp, s);
      continue;
    }
    removed += 1;
    if (preferenceScore(s) > preferenceScore(existing)) {
      byFp.set(fp, s);
    }
  }

  // Second pass: drop sections whose text is almost fully contained in a preferred larger sibling
  const list = Array.from(byFp.values());
  const keep = new Set(list);
  for (let i = 0; i < list.length; i++) {
    for (let j = 0; j < list.length; j++) {
      if (i === j) continue;
      const a = list[i];
      const b = list[j];
      if (!keep.has(a) || !keep.has(b)) continue;
      const ta = String(a.textSample || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
      const tb = String(b.textSample || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
      if (ta.length < 40 || tb.length < 40) continue;
      // a nested in b and b is larger / preferred
      if (tb.includes(ta) && tb.length > ta.length * 1.15) {
        if (preferenceScore(b) >= preferenceScore(a) - 5) {
          keep.delete(a);
          removed += 1;
        }
      }
      // Near-equal titles / opening text (e.g. duplicate hero captures)
      const la = normalizeSectionId(a.label || "").slice(0, 24);
      const lb = normalizeSectionId(b.label || "").slice(0, 24);
      if (la && la === lb && Math.abs(ta.length - tb.length) < 40) {
        if (preferenceScore(b) > preferenceScore(a)) {
          keep.delete(a);
          removed += 1;
        }
      }
      const headA = ta.slice(0, 48);
      const headB = tb.slice(0, 48);
      if (headA.length >= 32 && headA === headB) {
        if (preferenceScore(b) > preferenceScore(a)) {
          keep.delete(a);
          removed += 1;
        }
      }
    }
  }

  // Preserve document order from original where possible
  const order = new Map(sections.map((s, i) => [s, i]));
  const out = sections.filter((s) => keep.has(s));
  // If fingerprint map replaced objects, rebuild order from list kept
  const keptList = list.filter((s) => keep.has(s));
  keptList.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));

  return { sections: keptList, removed };
}

function humanTitle(s: PageIRSection): string {
  const label = String(s.label || "").trim();
  const heading = s.text?.headings?.[0];
  const text = String(s.textSample || "")
    .replace(/\s+/g, " ")
    .trim();

  // Bare landmark tags: friendly titles (avoid glued nav text as label)
  if (/^header$/i.test(label)) return "Header";
  if (/^nav$/i.test(label) || /^main[- ]?navigation$/i.test(label)) {
    return "Main navigation";
  }
  if (/^footer$/i.test(label)) return "Footer";
  if (/^footer[- ]?navigation$/i.test(label)) return "Footer navigation";

  // Prefer first heading from structured text model
  if (heading && heading.length >= 2) return truncateTitle(heading);

  // Prefer a real label that is not a raw tag
  if (label && !/^(div|span|section|header|footer|nav|main|aside|article)$/i.test(label)) {
    // If label is truncated id-like, prefer start of text when richer
    if (label.length < 12 && text.length > label.length + 10) {
      return truncateTitle(text);
    }
    return truncateTitle(label);
  }
  if (text) return truncateTitle(text);
  return label || s.id || "Section";
}

function truncateTitle(raw: string, max = 96): string {
  const t = raw.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function scoreSemanticRole(
  roleId: string,
  patterns: RegExp[],
  s: PageIRSection,
): number {
  const h = haystack(s);
  const label = s.label || "";
  const id = s.id || "";

  // Hard exclusions to avoid role collisions
  if (roleId === "nav" && /footer/i.test(h)) return 0;
  if (roleId === "header" && /footer/i.test(h) && !/header/i.test(label)) {
    return 0;
  }
  if (roleId === "resources" && /footer/i.test(label) && !/resource/i.test(label)) {
    return 0;
  }
  if (
    roleId === "hero" &&
    /footer|pricing|faq|template|testimonial|navigation/i.test(label)
  ) {
    return 0;
  }

  let score = 0;
  for (const re of patterns) {
    if (re.test(h) || re.test(label) || re.test(id)) {
      score += 10;
    }
  }
  const tag = tagFromSelector(s.selector);
  if (roleId === "header" && tag === "header") score += 25;
  if (roleId === "nav" && tag === "nav") score += 25;
  if (roleId === "footer" && (tag === "footer" || /footer/i.test(label))) {
    score += 25;
  }
  if (roleId === "hero" && (s.boundingBox?.y ?? 9999) < 200) score += 5;
  // Prefer earlier large content blocks for hero when keywords hit
  if (roleId === "hero" && score > 0 && (s.boundingBox?.height ?? 0) > 280) {
    score += 8;
  }
  return score;
}

/**
 * Assign short semantic ids where confident; otherwise short unique slugs.
 * Always sets label to a human full title.
 */
export function assignStableIds(sections: PageIRSection[]): PageIRSection[] {
  const used = new Set<string>();
  const assigned = new Map<PageIRSection, string>();

  // Greedy: for each role, pick best unmatched section above threshold
  for (const role of SEMANTIC_ROLES) {
    let best: PageIRSection | null = null;
    let bestScore = 0;
    for (const s of sections) {
      if (assigned.has(s)) continue;
      const sc = scoreSemanticRole(role.id, role.patterns, s);
      if (sc > bestScore) {
        bestScore = sc;
        best = s;
      }
    }
    if (best && bestScore >= 10 && !used.has(role.id)) {
      assigned.set(best, role.id);
      used.add(role.id);
    }
  }

  // Remaining: short unique ids from title words
  const remainLabels: string[] = [];
  const remainSections: PageIRSection[] = [];
  for (const s of sections) {
    if (assigned.has(s)) continue;
    remainSections.push(s);
    const title = humanTitle(s);
    // First ~4 words for short id base
    const short = title
      .split(/\s+/)
      .slice(0, 4)
      .join(" ");
    remainLabels.push(short || s.id || "section");
  }
  const remainIds = uniqueSectionIds(remainLabels);
  // Cap length further for non-semantic
  for (let i = 0; i < remainSections.length; i++) {
    let id = remainIds[i] || `section-${i + 1}`;
    if (id.length > 28) {
      id = id.slice(0, 28).replace(/-+$/g, "") || `section-${i + 1}`;
    }
    let finalId = id;
    let n = 2;
    while (used.has(finalId)) {
      finalId = `${id}-${n}`;
      n += 1;
    }
    used.add(finalId);
    assigned.set(remainSections[i], finalId);
  }

  return sections.map((s) => {
    const id = assigned.get(s) || normalizeSectionId(s.id) || "section";
    return {
      ...s,
      id,
      label: humanTitle(s),
    };
  });
}

/**
 * Full hygiene pipeline on a section list.
 */
export function hygienizeSections(
  sections: readonly PageIRSection[],
  opts: HygienizeOptions = {},
): HygienizeResult {
  const notes: string[] = [];
  const maxSections = opts.maxSections ?? 24;
  const semanticIds = opts.semanticIds !== false;

  const before = sections.length;
  const filtered = sections.filter((s) => !isJunkSection(s, opts));
  const dropped = before - filtered.length;
  if (dropped > 0) {
    notes.push(
      `IR hygiene: dropped ${dropped} empty/tiny/non-landmark section(s).`,
    );
  }

  const { sections: dedupedList, removed } = dedupeSections(filtered);
  if (removed > 0) {
    notes.push(`IR hygiene: removed ${removed} near-duplicate section(s).`);
  }

  let next = dedupedList;
  if (semanticIds) {
    next = assignStableIds(next);
    notes.push(
      "IR hygiene: assigned stable short ids (hero/pricing/faq/…) where matched; labels keep full titles.",
    );
  }

  if (next.length > maxSections) {
    notes.push(
      `IR hygiene: capped sections ${next.length} → ${maxSections} (document order).`,
    );
    next = next.slice(0, maxSections);
  }

  return {
    sections: next,
    notes,
    dropped,
    deduped: removed,
  };
}

/**
 * Apply hygiene to a full Page IR document (immutable-style return).
 */
export function hygienizePageIR(ir: PageIR, opts?: HygienizeOptions): PageIR {
  const result = hygienizeSections(ir.sections || [], opts);
  const notes = [...(ir.notes || []), ...result.notes];
  return {
    ...ir,
    sections: result.sections,
    notes: notes.length ? notes : undefined,
  };
}
