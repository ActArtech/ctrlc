/**
 * ctrlc register-from-spec — register a section from section.spec.md
 *
 * Parses id from filename (hero.spec.md → hero) or Meta table / heading,
 * infers component path src/components/sections/<Pascal>.tsx, then
 * delegates to register with --from-spec behavior drafting.
 */

import fs from "node:fs";
import path from "node:path";
import { flagString, flagBool, resolveCwd } from "./args.mjs";
import { cmdRegister } from "./register.mjs";

/**
 * @param {string} filePath
 * @param {string} markdown
 * @returns {string}
 */
export function resolveSpecSectionId(filePath, markdown) {
  const base = path.basename(filePath);
  const fromName = base.replace(/\.spec\.md$/i, "").replace(/\.md$/i, "");
  if (fromName && fromName !== base) {
    // Prefer filename when it looks like an id (no spaces)
    if (/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(fromName)) {
      return fromName;
    }
  }

  const get = (re) => {
    const m = markdown.match(re);
    return m?.[1]?.trim();
  };

  const fromTable =
    get(/\|\s*\*\*id\*\*\s*\|\s*`?([^`|\n]+)`?\s*\|/i) ||
    get(/\|\s*id\s*\|\s*`?([^`|\n]+)`?\s*\|/i);
  if (fromTable) return fromTable.replace(/`/g, "").trim();

  const fromHeading =
    get(/^#\s+Section spec:\s*`?([^`\n]+)`?/m) ||
    get(/^#\s+(.+?)\s+Specification/m);
  if (fromHeading) {
    return fromHeading
      .replace(/`/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
  }

  if (fromName) return fromName;
  throw new Error(`Could not resolve section id from ${filePath}`);
}

/**
 * Best-effort label from Meta table or heading.
 * @param {string} markdown
 * @param {string} id
 */
function labelFromSpec(markdown, id) {
  const get = (re) => {
    const m = markdown.match(re);
    return m?.[1]?.trim();
  };
  const label =
    get(/\|\s*\*\*label\*\*\s*\|\s*([^|\n]+)\s*\|/i) ||
    get(/\|\s*label\s*\|\s*([^|\n]+)\s*\|/i) ||
    get(/^#\s+Section spec:\s*`?([^`\n]+)`?/m);
  if (!label || label === "{{label}}" || label === id) return id;
  return label.replace(/`/g, "").trim() || id;
}

/**
 * Best-effort interaction model from Meta table.
 * @param {string} markdown
 */
function interactionFromSpec(markdown) {
  const get = (re) => {
    const m = markdown.match(re);
    return m?.[1]?.trim();
  };
  const model =
    get(/\|\s*\*\*INTERACTION MODEL\*\*\s*\|\s*([^|\n]+)\s*\|/i) ||
    get(/INTERACTION MODEL[:\s|*]+([a-zA-Z-]+)/i) ||
    get(/\|\s*interaction model\s*\|\s*([^|\n]+)\s*\|/i);
  if (!model || model.includes("{{")) return null;
  return model
    .toLowerCase()
    .replace(/-driven$/, "")
    .split(/[|/]/)[0]
    .trim();
}

/**
 * @param {import("./args.mjs").ParsedArgs} args
 * @param {Awaited<ReturnType<import("./cli.mjs")["loadCore"]>>} core
 */
export async function cmdRegisterFromSpec(args, core) {
  const cwd = resolveCwd(args.flags);
  const specRaw =
    flagString(args.flags, "spec") ||
    flagString(args.flags, "from-spec") ||
    args.positionals[0];

  if (!specRaw) {
    console.error(`Usage: ctrlc register-from-spec --spec docs/research/components/hero.spec.md [--cwd .]

Options:
  --spec <file>          section.spec.md path (required)
  --cwd <dir>            Project root (default: process.cwd())
  --id <sectionId>       Override id (default: filename or Meta table)
  --component <path>     Override component path
  --export <Name>        Override export name
  --content-module <path>
  --content-key <name>
  --css <path>
  --selector <css>
  --label <text>
  --interaction <model>
  --json

Example:
  ctrlc register-from-spec --cwd . --spec docs/research/components/hero.spec.md
`);
    process.exit(1);
  }

  const specPath = path.isAbsolute(specRaw)
    ? specRaw
    : path.resolve(cwd, specRaw);
  if (!fs.existsSync(specPath)) {
    console.error(`Spec not found: ${specPath}`);
    process.exit(1);
  }

  const markdown = fs.readFileSync(specPath, "utf8");
  const id =
    flagString(args.flags, "id") || resolveSpecSectionId(specPath, markdown);

  // Rel path for --from-spec (prefer project-relative)
  let fromSpecRel = path.relative(cwd, specPath).replace(/\\/g, "/");
  if (fromSpecRel.startsWith("..")) {
    fromSpecRel = specPath;
  }

  const pascal =
    typeof core?.pascalFromId === "function"
      ? core.pascalFromId(id)
      : id
          .split(/[-_\s]+/)
          .filter(Boolean)
          .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
          .join("");

  const inferredLabel = labelFromSpec(markdown, id);
  const inferredInteraction = interactionFromSpec(markdown);

  // Build synthetic args for cmdRegister (same flags + id positional)
  /** @type {import("./args.mjs").ParsedArgs} */
  const regArgs = {
    command: "register",
    positionals: [id],
    help: false,
    flags: {
      ...args.flags,
      cwd,
      "from-spec": fromSpecRel,
      component:
        flagString(args.flags, "component") ||
        `src/components/sections/${pascal}.tsx`,
      export: flagString(args.flags, "export") || pascal,
      label: flagString(args.flags, "label") || inferredLabel,
    },
  };

  if (
    !flagString(args.flags, "interaction") &&
    !flagString(args.flags, "interaction-model") &&
    inferredInteraction
  ) {
    regArgs.flags.interaction = inferredInteraction;
  }

  // Ensure content-key defaults to camelCase of id when not provided
  if (
    !flagString(args.flags, "content-key") &&
    !flagString(args.flags, "content-keys")
  ) {
    const camel =
      typeof core?.camelFromId === "function"
        ? core.camelFromId(id)
        : pascal.charAt(0).toLowerCase() + pascal.slice(1);
    regArgs.flags["content-key"] = camel;
  }

  if (!flagString(args.flags, "selector") && !flagString(args.flags, "selectors")) {
    regArgs.flags.selector = `.${id}`;
  }

  await cmdRegister(regArgs, core);

  if (!flagBool(args.flags, "json")) {
    console.log(`register-from-spec: id=${id} from ${fromSpecRel}`);
  }
  return 0;
}
