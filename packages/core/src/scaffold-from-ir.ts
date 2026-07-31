/**
 * Scaffold React section stubs + home content + page.tsx from Page IR.
 *
 * Productizes the Tosea clone hand-scaffold:
 * components under src/components/sections/, content keys in home.ts,
 * SectionBoundary composition on page.tsx.
 *
 * Never writes HTML dumps - React components only.
 */

import fs from "node:fs";
import path from "node:path";
import {
  camelFromId,
  contentSlotsFromIrText,
  loadPageIR,
  listIrSections,
  parsePageIR,
  pascalFromId,
  type PageIR,
  type PageIrSection,
} from "./ir-to-specs";

/** Accept JSON string or already-parsed Page IR object. */
function asPageIR(ir: PageIR | unknown): PageIR {
  if (typeof ir === "string") return parsePageIR(ir);
  if (ir && typeof ir === "object") return ir as PageIR;
  throw new Error("Page IR must be a JSON object or JSON string");
}

export type ScaffoldSectionPlan = {
  id: string;
  label: string;
  exportName: string;
  contentKey: string;
  componentRelPath: string;
  fileName: string;
  title: string;
  body: string;
  eyebrow?: string;
  primaryCta?: string;
  secondaryCta?: string;
  listItems?: string[];
  interactionModel?: string;
};

export type ScaffoldFromIrOptions = {
  /** Project root (host app). */
  cwd: string;
  /** Overwrite existing component/content/page files (default true for scaffold outputs). */
  force?: boolean;
  /** Do not write files; return plan only. */
  dryRun?: boolean;
  /** Relative components dir (default src/components/sections). */
  componentsDir?: string;
  /** Relative content module (default src/content/home.ts). */
  contentPath?: string;
  /** Relative page path (default src/app/page.tsx). */
  pagePath?: string;
  /** Relative sections index (default src/components/sections/index.ts). */
  indexPath?: string;
  /** Relative styles file for clone hooks (default src/styles/clone.css). */
  cloneCssPath?: string;
  /** Relative app css to patch with scaffold utilities (default src/styles/app.css). */
  appCssPath?: string;
  /** Source URL note in file headers. */
  sourceUrl?: string;
  /** Max body chars per content stub (default 280). */
  maxBodyChars?: number;
  /** Skip writing page.tsx. */
  skipPage?: boolean;
  /** Skip writing home.ts. */
  skipContent?: boolean;
  /** Skip writing components. */
  skipComponents?: boolean;
  /** Skip CSS patch. */
  skipCss?: boolean;
};

export type ScaffoldWrittenFile = {
  path: string;
  kind: "component" | "content" | "page" | "index" | "css" | "clone-css";
  bytes: number;
  action: "write" | "skip" | "patch";
};

export type ScaffoldFromIrResult = {
  sections: ScaffoldSectionPlan[];
  files: ScaffoldWrittenFile[];
  sourceUrl?: string;
  notes: string[];
};

function escapeTsString(s: string): string {
  return JSON.stringify(s);
}

function sectionTitle(s: PageIrSection): string {
  const slots = contentSlotsFromIrText(s.text);
  if (slots.title) return slots.title.slice(0, 96);
  const heading = s.text?.headings?.[0];
  if (heading) return String(heading).slice(0, 96);
  const label = String(s.label || "").trim();
  if (label && !/^(div|span|section)$/i.test(label)) return label;
  const text = String(s.textSample || "")
    .replace(/\s+/g, " ")
    .trim();
  if (text) return text.slice(0, 96);
  return s.id;
}

function sectionBody(s: PageIrSection, max: number): string {
  const slots = contentSlotsFromIrText(s.text);
  if (slots.body) {
    return slots.body.slice(0, max).replace(/`/g, "'");
  }
  if (s.text?.paragraphs?.length) {
    return s.text.paragraphs
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max)
      .replace(/`/g, "'");
  }
  const text = String(s.textSample || s.label || s.id)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .replace(/`/g, "'");
  return text || s.id;
}

/**
 * Build ordered scaffold plans from Page IR sections.
 */
export function planScaffoldFromIR(
  ir: PageIR | unknown,
  opts?: { maxBodyChars?: number },
): ScaffoldSectionPlan[] {
  const doc = asPageIR(ir);
  const max = opts?.maxBodyChars ?? 280;
  const sections = listIrSections(doc);
  return sections.map((s) => {
    const id = s.id;
    const exportName = pascalFromId(id);
    const contentKey = camelFromId(id);
    const fileName = `${exportName}.tsx`;
    const slots = contentSlotsFromIrText(s.text);
    const listItems = Array.isArray(s.text?.listItems)
      ? s.text.listItems.map(String).filter(Boolean).slice(0, 12)
      : undefined;
    return {
      id,
      label: sectionTitle(s),
      exportName,
      contentKey,
      componentRelPath: `src/components/sections/${fileName}`,
      fileName,
      title: sectionTitle(s),
      body: sectionBody(s, max),
      ...(slots.eyebrow ? { eyebrow: slots.eyebrow } : {}),
      ...(slots.primaryCta ? { primaryCta: slots.primaryCta } : {}),
      ...(slots.secondaryCta ? { secondaryCta: slots.secondaryCta } : {}),
      ...(listItems?.length ? { listItems } : {}),
      interactionModel: s.interactionModel,
    };
  });
}

function renderComponent(plan: ScaffoldSectionPlan, sourceUrl?: string): string {
  const srcNote = sourceUrl
    ? `/** Scaffold from CtrlC IR (${sourceUrl}). Refine for fidelity. */`
    : `/** Scaffold from CtrlC Page IR. Refine for fidelity. */`;
  return `import { home } from "@/content/home";

${srcNote}
export function ${plan.exportName}() {
  const c = home.${plan.contentKey} as {
    eyebrow?: string;
    title: string;
    body: string;
    primaryCta?: string;
    secondaryCta?: string;
    listItems?: readonly string[];
  };
  return (
    <section
      className="section section-${plan.id}"
      data-section={${escapeTsString(plan.id)}}
      aria-labelledby="${plan.id}-title"
    >
      <div className="section-inner">
        {c?.eyebrow ? <p className="section-eyebrow">{c.eyebrow}</p> : null}
        <h2 id="${plan.id}-title" className="section-title">
          {c?.title ?? ${escapeTsString(plan.title)}}
        </h2>
        <p className="section-body">{c?.body}</p>
        {c?.listItems?.length ? (
          <ul className="section-list">
            {c.listItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        {(c?.primaryCta || c?.secondaryCta) ? (
          <div className="section-actions">
            {c.primaryCta ? (
              <a className="btn btn-primary" href="#">{c.primaryCta}</a>
            ) : null}
            {c.secondaryCta ? (
              <a className="btn btn-secondary" href="#">{c.secondaryCta}</a>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
`;
}

function renderHomeContent(
  plans: ScaffoldSectionPlan[],
  sourceUrl?: string,
): string {
  const header = sourceUrl
    ? `/** Content stubs from CtrlC Page IR (${sourceUrl}). Structured title/body/CTAs when present. */`
    : `/** Content stubs from CtrlC Page IR. Structured title/body/CTAs when present. */`;
  const lines = [header, "export const home = {"];
  for (const p of plans) {
    lines.push(`  ${p.contentKey}: {`);
    if (p.eyebrow) lines.push(`    eyebrow: ${escapeTsString(p.eyebrow)},`);
    lines.push(`    title: ${escapeTsString(p.title)},`);
    lines.push(`    body: ${escapeTsString(p.body)},`);
    if (p.primaryCta) {
      lines.push(`    primaryCta: ${escapeTsString(p.primaryCta)},`);
    }
    if (p.secondaryCta) {
      lines.push(`    secondaryCta: ${escapeTsString(p.secondaryCta)},`);
    }
    if (p.listItems?.length) {
      lines.push(
        `    listItems: ${JSON.stringify(p.listItems)} as const,`,
      );
    }
    lines.push(`  },`);
  }
  lines.push("} as const;");
  lines.push("");
  lines.push("export default home;");
  lines.push("");
  return lines.join("\n");
}

function baseNameNoTsx(fileName: string): string {
  return fileName.endsWith(".tsx") ? fileName.slice(0, -4) : fileName;
}

function renderIndex(plans: ScaffoldSectionPlan[]): string {
  return (
    plans
      .map(
        (p) =>
          `export { ${p.exportName} } from "./${baseNameNoTsx(p.fileName)}";`,
      )
      .join("\n") + "\n"
  );
}

function renderPage(plans: ScaffoldSectionPlan[], sourceUrl?: string): string {
  const imports = [
    'import { SectionBoundary } from "@ctrlc/react";',
    ...plans.map(
      (p) =>
        `import { ${p.exportName} } from "@/components/sections/${baseNameNoTsx(p.fileName)}";`,
    ),
  ];
  const body = plans.flatMap((p) => [
    `      <SectionBoundary id=${escapeTsString(p.id)} label=${escapeTsString(p.label)} component=${escapeTsString(p.exportName)}>`,
    `        <${p.exportName} />`,
    "      </SectionBoundary>",
    "",
  ]);
  const note = sourceUrl
    ? ` * Generated from Page IR (${sourceUrl}). Order follows IR section list.`
    : ` * Generated from Page IR. Order follows IR section list.`;
  return `${imports.join("\n")}

/**
 * Landing page composition (CtrlC scaffold-from-ir).
${note}
 * Section ids match registry / SectionPack.
 */
export default function HomePage() {
  return (
    <main className="page">
${body.join("\n").trimEnd()}
    </main>
  );
}
`;
}

const SCAFFOLD_CSS_SNIPPET = `
/* CtrlC scaffold-from-ir section primitives */
.page {
  min-height: 100vh;
}
.section {
  padding: clamp(3rem, 6vw, 4.5rem) 0;
  border-bottom: 1px solid color-mix(in oklab, currentColor 10%, transparent);
}
.section-inner {
  width: min(100% - 2 * var(--pc-gutter, 1.5rem), var(--pc-max, 72rem));
  margin-inline: auto;
}
.section-title {
  margin: 0 0 0.75rem;
  font-size: clamp(1.35rem, 2.5vw, 1.75rem);
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.section-body {
  margin: 0;
  max-width: 48rem;
  line-height: 1.65;
  opacity: 0.82;
}
`;

function writeFileTracked(
  abs: string,
  content: string,
  kind: ScaffoldWrittenFile["kind"],
  force: boolean,
  files: ScaffoldWrittenFile[],
  dryRun: boolean,
): void {
  const exists = fs.existsSync(abs);
  if (exists && !force) {
    files.push({
      path: abs,
      kind,
      bytes: 0,
      action: "skip",
    });
    return;
  }
  if (!dryRun) {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf8");
  }
  files.push({
    path: abs,
    kind,
    bytes: Buffer.byteLength(content, "utf8"),
    action: "write",
  });
}

/**
 * Write scaffold files into a clone host project.
 */
export function writeScaffoldFromIR(
  ir: PageIR | unknown,
  options: ScaffoldFromIrOptions,
): ScaffoldFromIrResult {
  const cwd = path.resolve(options.cwd);
  const force = options.force !== false;
  const dryRun = Boolean(options.dryRun);
  const notes: string[] = [];
  const files: ScaffoldWrittenFile[] = [];

  const doc = asPageIR(ir);
  const sourceUrl =
    options.sourceUrl ||
    (typeof doc.sourceUrl === "string" ? doc.sourceUrl : undefined);
  const plans = planScaffoldFromIR(doc, { maxBodyChars: options.maxBodyChars });

  if (plans.length === 0) {
    notes.push("No sections in IR; nothing to scaffold.");
    return { sections: plans, files, sourceUrl, notes };
  }

  const componentsDir = options.componentsDir || "src/components/sections";
  const contentRel = options.contentPath || "src/content/home.ts";
  const pageRel = options.pagePath || "src/app/page.tsx";
  const indexRel = options.indexPath || path.join(componentsDir, "index.ts");
  const cloneCssRel = options.cloneCssPath || "src/styles/clone.css";
  const appCssRel = options.appCssPath || "src/styles/app.css";

  if (!options.skipComponents) {
    for (const p of plans) {
      const abs = path.join(cwd, componentsDir, p.fileName);
      writeFileTracked(
        abs,
        renderComponent(p, sourceUrl),
        "component",
        force,
        files,
        dryRun,
      );
    }
    writeFileTracked(
      path.join(cwd, indexRel),
      renderIndex(plans),
      "index",
      force,
      files,
      dryRun,
    );
  }

  if (!options.skipContent) {
    writeFileTracked(
      path.join(cwd, contentRel),
      renderHomeContent(plans, sourceUrl),
      "content",
      force,
      files,
      dryRun,
    );
  }

  if (!options.skipPage) {
    writeFileTracked(
      path.join(cwd, pageRel),
      renderPage(plans, sourceUrl),
      "page",
      force,
      files,
      dryRun,
    );
  }

  if (!options.skipCss) {
    const cloneAbs = path.join(cwd, cloneCssRel);
    if (!fs.existsSync(cloneAbs) || force) {
      writeFileTracked(
        cloneAbs,
        "/* CtrlC scaffold-from-ir: section-level styles (expand per section) */\n",
        "clone-css",
        true,
        files,
        dryRun,
      );
    }

    const appAbs = path.join(cwd, appCssRel);
    if (fs.existsSync(appAbs)) {
      let css = fs.readFileSync(appAbs, "utf8");
      if (!css.includes(".section-inner") && !css.includes("scaffold-from-ir section")) {
        css = css.trimEnd() + "\n" + SCAFFOLD_CSS_SNIPPET;
        if (!dryRun) fs.writeFileSync(appAbs, css, "utf8");
        files.push({
          path: appAbs,
          kind: "css",
          bytes: Buffer.byteLength(css, "utf8"),
          action: "patch",
        });
        notes.push(`Patched ${appCssRel} with section scaffold primitives.`);
      } else {
        files.push({
          path: appAbs,
          kind: "css",
          bytes: 0,
          action: "skip",
        });
      }
    } else {
      notes.push(`No ${appCssRel}; skipped CSS patch (host may use different styles path).`);
    }
  }

  notes.push(
    `Scaffolded ${plans.length} section component(s) + content keys + page composition.`,
  );
  notes.push(
    "Next: refine components for fidelity, then ctrlc pack <id> --format describe.",
  );

  return { sections: plans, files, sourceUrl, notes };
}

/**
 * Load IR from disk and scaffold into cwd.
 */
export function scaffoldFromIrFile(
  irPath: string,
  options: ScaffoldFromIrOptions,
): ScaffoldFromIrResult {
  const ir = loadPageIR(irPath);
  return writeScaffoldFromIR(ir, options);
}
