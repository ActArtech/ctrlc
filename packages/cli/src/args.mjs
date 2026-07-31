/**
 * Minimal argv parser for CtrlC CLI.
 */

import fs from "node:fs";
import path from "node:path";

/**
 * @typedef {{
 *   command: string | null,
 *   positionals: string[],
 *   flags: Record<string, string | boolean>,
 *   help: boolean,
 * }} ParsedArgs
 */

/**
 * @param {string[]} argv
 * @returns {ParsedArgs}
 */
export function parseArgs(argv) {
  /** @type {ParsedArgs} */
  const out = {
    command: null,
    positionals: [],
    flags: {},
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      out.help = true;
      continue;
    }
    if (a === "--") {
      out.positionals.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq > 2) {
        const key = a.slice(2, eq);
        const val = a.slice(eq + 1);
        out.flags[key] = val;
        continue;
      }
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next != null && !next.startsWith("-")) {
        out.flags[key] = next;
        i++;
      } else {
        out.flags[key] = true;
      }
      continue;
    }
    if (a.startsWith("-") && a.length === 2) {
      const key = a.slice(1);
      const long =
        key === "c"
          ? "config"
          : key === "o"
            ? "out"
            : key === "f"
              ? "format"
              : key === "j"
                ? "json"
                : key;
      const next = argv[i + 1];
      if (long === "json" || next == null || next.startsWith("-")) {
        out.flags[long] = true;
      } else {
        out.flags[long] = next;
        i++;
      }
      continue;
    }
    if (!out.command) {
      out.command = a;
    } else {
      out.positionals.push(a);
    }
  }

  return out;
}

/**
 * @param {Record<string, string | boolean>} flags
 * @param {string} name
 * @returns {string | null}
 */
export function flagString(flags, name) {
  const v = flags[name];
  if (v == null || v === true || v === false) return null;
  return String(v);
}

/**
 * @param {Record<string, string | boolean>} flags
 * @param {string} name
 * @returns {boolean}
 */
export function flagBool(flags, name) {
  return flags[name] === true || flags[name] === "true" || flags[name] === "1";
}

/**
 * Resolve --cwd to an absolute path (default process.cwd()).
 * @param {Record<string, string | boolean>} flags
 * @returns {string}
 */
export function resolveCwd(flags) {
  const raw = flagString(flags, "cwd");
  return raw ? path.resolve(raw) : process.cwd();
}

/**
 * @param {Record<string, string | boolean>} flags
 * @returns {string | null}
 */
export function resolveConfigPath(flags) {
  const raw = flagString(flags, "config") ?? flagString(flags, "c");
  return raw ? path.resolve(raw) : null;
}

/**
 * Resolve an input path (e.g. --ir) so relative paths work from the shell cwd
 * even when --cwd points at a different project root.
 *
 * Order: absolute as-is → process.cwd() if exists → projectCwd if exists → process.cwd().
 *
 * @param {string} raw
 * @param {string} [projectCwd]
 * @returns {string}
 */
export function resolveInputPath(raw, projectCwd) {
  if (!raw) return raw;
  if (path.isAbsolute(raw)) return raw;
  const fromShell = path.resolve(process.cwd(), raw);
  if (fs.existsSync(fromShell)) return fromShell;
  if (projectCwd) {
    const fromProject = path.resolve(projectCwd, raw);
    if (fs.existsSync(fromProject)) return fromProject;
  }
  return fromShell;
}
