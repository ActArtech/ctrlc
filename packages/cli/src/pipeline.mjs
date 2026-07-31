/**
 * ctrlc pipeline - orchestrate capture -> assets -> tokens -> registry -> specs
 * (+ optional baseline / plan-parallel when present).
 *
 *   ctrlc pipeline --ir path/to/ir.json --cwd project
 *   ctrlc pipeline --url https://example.com --cwd project [--out runs/host]
 *   ctrlc pipeline --ir ir.json --cwd . --dry-run
 *   ctrlc pipeline --ir ir.json --cwd . --json
 *
 * Uses static command-modules registry (bundles cleanly; no dynamic sibling paths).
 */

import fs from "node:fs";
import path from "node:path";
import {
  flagString,
  flagBool,
  resolveCwd,
  resolveInputPath,
} from "./args.mjs";
import { getCommandModule, resolveCommandFn } from "./command-modules.mjs";

/**
 * @typedef {{
 *   name: string,
 *   status: "ok" | "skipped" | "failed" | "planned",
 *   detail?: string,
 *   required?: boolean,
 * }} PipelineStepResult
 */

/**
 * @param {string} command
 * @param {Record<string, string | boolean>} flags
 * @param {string[]} [positionals]
 * @returns {import("./args.mjs").ParsedArgs}
 */
function synthArgs(command, flags, positionals = []) {
  return {
    command,
    positionals,
    flags: { ...flags },
    help: false,
  };
}

/**
 * Load a command module from the static registry (bundler-safe).
 * @param {string} modBase  e.g. "capture" or "plan-parallel"
 * @returns {Record<string, unknown> | null}
 */
function tryLoadSibling(modBase) {
  return getCommandModule(modBase);
}

/**
 * Host segment for default runs/<host>.
 * @param {string} url
 */
function hostSlug(url) {
  try {
    const u = new URL(url);
    return (
      u.hostname.replace(/^www\./, "").toLowerCase().replace(/[^a-z0-9._-]+/g, "-") ||
      "page"
    );
  } catch {
    return "page";
  }
}

/** Screenshot candidates next to IR (same idea as baseline.mjs). */
const SCREENSHOT_CANDIDATES = [
  "screenshot.png",
  path.join("screenshots", "full.png"),
  path.join("screenshots", "page.png"),
  "full.png",
];

/**
 * @param {string} dir
 * @returns {string | null}
 */
function findScreenshotInDir(dir) {
  for (const rel of SCREENSHOT_CANDIDATES) {
    const abs = path.join(dir, rel);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  }
  return null;
}

/**
 * @param {number | void | undefined} code
 * @returns {number}
 */
function asCode(code) {
  return typeof code === "number" ? code : 0;
}

function printPipelineHelp() {
  console.log(`ctrlc pipeline - run capture + IR post-process steps

Usage:
  ctrlc pipeline --ir <path-to-ir.json> --cwd <project>
  ctrlc pipeline --url <url> --cwd <project> [--out runs/<host>]

Steps (skip gracefully if module missing; required steps fail the pipeline):
  1. capture          (only with --url)
  2. materialize-assets  -> public/ctrlc-assets (or <out>/assets)
  3. tokens-from-ir      -> docs/research
  4. register-from-ir    -> .ctrlc/registry.json
  5. specs-from-ir       -> docs/research/components
  6. scaffold-from-ir    -> React stubs + home.ts + page.tsx
  7. baseline            (optional; only if screenshot next to IR)
  8. plan-parallel       (optional; only if module exists)

Options:
  --ir <file>              Page IR JSON (required unless --url)
  --url <url>              Live capture first (needs Playwright)
  --cwd <dir>              Project root (default: process.cwd())
  --out <dir>              Capture out dir (default: runs/<host> under --cwd)
  --skip-materialize       Skip asset materialization
  --skip-tokens            Skip tokens-from-ir
  --skip-register          Skip register-from-ir
  --skip-specs             Skip specs-from-ir
  --skip-scaffold          Skip React scaffold-from-ir
  --skip-baseline          Skip baseline even if screenshot exists
  --skip-plan              Skip plan-parallel even if present
  --dry-run                Print planned steps only (no work, no Playwright)
  --json                   Print machine-readable summary at end

Examples:
  ctrlc pipeline --ir packages/capture/fixtures/sample-ir.json --cwd . --dry-run
  ctrlc pipeline --ir runs/example.com/ir.json --cwd ./my-clone
  ctrlc pipeline --url https://example.com --cwd ./my-clone --out runs/example.com

Product: React rebuild pipeline - not an HTML dump.
`);
}

/**
 * @param {import("./args.mjs").ParsedArgs} args
 * @param {unknown} [core]
 * @returns {Promise<number>}
 */
export async function cmdPipeline(args, core) {
  if (args.help) {
    printPipelineHelp();
    return 0;
  }

  const cwd = resolveCwd(args.flags);
  const url = flagString(args.flags, "url");
  const irRaw = flagString(args.flags, "ir") || flagString(args.flags, "input");
  const outRaw = flagString(args.flags, "out") || flagString(args.flags, "o");
  const dryRun = flagBool(args.flags, "dry-run") || flagBool(args.flags, "dryRun");
  const asJson = flagBool(args.flags, "json");

  const skipMaterialize = flagBool(args.flags, "skip-materialize");
  const skipTokens = flagBool(args.flags, "skip-tokens");
  const skipRegister = flagBool(args.flags, "skip-register");
  const skipSpecs = flagBool(args.flags, "skip-specs");
  const skipScaffold = flagBool(args.flags, "skip-scaffold");
  const skipBaseline = flagBool(args.flags, "skip-baseline");
  const skipPlan = flagBool(args.flags, "skip-plan");

  if (!url && !irRaw) {
    printPipelineHelp();
    console.error("\npipeline: provide --ir and/or --url");
    return 1;
  }

  /** @type {PipelineStepResult[]} */
  const steps = [];
  let failed = false;

  /** @type {string | null} */
  let irPath = irRaw ? resolveInputPath(irRaw, cwd) : null;

  /** Capture out dir when using --url */
  let captureOut = null;
  if (url) {
    captureOut = outRaw
      ? path.isAbsolute(outRaw)
        ? outRaw
        : path.resolve(cwd, outRaw)
      : path.join(cwd, "runs", hostSlug(url));
  }

  const assetsOut = captureOut
    ? path.join(captureOut, "assets")
    : path.join(cwd, "public", "ctrlc-assets");

  // Planned step list for dry-run and logging
  /** @type {{ name: string, required: boolean, skip?: boolean, reason?: string }[]} */
  const plan = [];

  if (url) {
    plan.push({ name: "capture", required: true });
  }
  plan.push({
    name: "materialize-assets",
    required: false,
    skip: skipMaterialize,
    reason: skipMaterialize ? "flag --skip-materialize" : undefined,
  });
  plan.push({
    name: "tokens-from-ir",
    required: true,
    skip: skipTokens,
    reason: skipTokens ? "flag --skip-tokens" : undefined,
  });
  plan.push({
    name: "register-from-ir",
    required: true,
    skip: skipRegister,
    reason: skipRegister ? "flag --skip-register" : undefined,
  });
  plan.push({
    name: "specs-from-ir",
    required: true,
    skip: skipSpecs,
    reason: skipSpecs ? "flag --skip-specs" : undefined,
  });
  plan.push({
    name: "scaffold-from-ir",
    required: false,
    skip: skipScaffold,
    reason: skipScaffold
      ? "flag --skip-scaffold"
      : "React stubs + home.ts + page.tsx",
  });
  plan.push({
    name: "baseline",
    required: false,
    skip: skipBaseline,
    reason: skipBaseline ? "flag --skip-baseline" : "optional if screenshot exists",
  });
  plan.push({
    name: "plan-parallel",
    required: false,
    skip: skipPlan,
    reason: skipPlan ? "flag --skip-plan" : "optional if module exists",
  });

  if (!asJson) {
    console.log(`ctrlc pipeline`);
    console.log(`  cwd:     ${cwd}`);
    if (url) console.log(`  url:     ${url}`);
    if (irPath) console.log(`  ir:      ${irPath}`);
    if (captureOut) console.log(`  out:     ${captureOut}`);
    console.log(`  dry-run: ${dryRun ? "yes" : "no"}`);
    console.log("");
  }

  if (dryRun) {
    for (const p of plan) {
      const status = p.skip ? "skipped" : "planned";
      const detail = p.reason || (p.skip ? "skipped" : "would run");
      steps.push({
        name: p.name,
        status,
        detail,
        required: p.required,
      });
      if (!asJson) {
        const tag = p.skip ? "skip" : "plan";
        console.log(`  [${tag}]  ${p.name}${p.reason ? ` (${p.reason})` : ""}`);
      }
    }
    if (!asJson) {
      console.log("");
      console.log("pipeline: dry-run complete (no steps executed)");
    }
    if (asJson) {
      console.log(
        JSON.stringify(
          {
            ok: true,
            dryRun: true,
            cwd,
            url: url || null,
            ir: irPath,
            out: captureOut,
            steps,
          },
          null,
          2,
        ),
      );
    }
    return 0;
  }

  // --- 1. capture (url only) ---
  if (url) {
    const mod = tryLoadSibling("capture");
    const fn = mod ? resolveCommandFn(mod, "capture") : null;
    if (!fn) {
      steps.push({
        name: "capture",
        status: "failed",
        detail: "capture module missing",
        required: true,
      });
      failed = true;
      if (!asJson) console.error("pipeline: capture module not available");
    } else {
      if (!asJson) console.log("--- capture ---");
      try {
        const code = asCode(
          await fn(
            synthArgs(
              "capture",
              {
                out: captureOut,
                ...(flagString(args.flags, "width")
                  ? { width: flagString(args.flags, "width") }
                  : {}),
                ...(flagString(args.flags, "height")
                  ? { height: flagString(args.flags, "height") }
                  : {}),
              },
              [url],
            ),
          ),
        );
        if (code !== 0) {
          steps.push({
            name: "capture",
            status: "failed",
            detail: `exit ${code}`,
            required: true,
          });
          failed = true;
        } else {
          const capturedIr = path.join(/** @type {string} */ (captureOut), "ir.json");
          if (fs.existsSync(capturedIr)) {
            irPath = capturedIr;
          }
          steps.push({
            name: "capture",
            status: "ok",
            detail: irPath || captureOut || undefined,
            required: true,
          });
        }
      } catch (e) {
        steps.push({
          name: "capture",
          status: "failed",
          detail: String(/** @type {Error} */ (e)?.message ?? e),
          required: true,
        });
        failed = true;
      }
    }
  }

  if (!irPath || !fs.existsSync(irPath)) {
    if (!failed) {
      steps.push({
        name: "resolve-ir",
        status: "failed",
        detail: irPath
          ? `IR not found: ${irPath}`
          : "No IR path after capture / --ir",
        required: true,
      });
      failed = true;
    }
    return finish(failed, steps, {
      asJson,
      dryRun: false,
      cwd,
      url,
      irPath,
      captureOut,
    });
  }

  // Prefer absolute IR for sibling cmds that resolve from shell cwd
  const irAbs = path.resolve(irPath);

  // --- 2. materialize-assets ---
  if (!skipMaterialize && !failed) {
    const mod = tryLoadSibling("materialize-assets");
    const fn = mod ? resolveCommandFn(mod, "materialize-assets") : null;
    if (!fn) {
      steps.push({
        name: "materialize-assets",
        status: "skipped",
        detail: "module missing",
        required: true,
      });
      if (!asJson) {
        console.log("pipeline: skip materialize-assets (module missing)");
      }
    } else {
      if (!asJson) console.log("--- materialize-assets ---");
      try {
        const outIr = path.join(cwd, ".ctrlc", "ir.materialized.json");
        const publicDir = path.join(cwd, "public");
        const code = asCode(
          await fn(
            synthArgs("materialize-assets", {
              ir: irAbs,
              out: assetsOut,
              "out-ir": outIr,
              "public-dir": publicDir,
            }),
          ),
        );
        // Materialize is best-effort: partial asset failures should not kill the pipeline.
        // Exit 1 only when the command throws or module is broken; treat non-zero as warn.
        if (code !== 0) {
          steps.push({
            name: "materialize-assets",
            status: "ok",
            detail: `warn exit ${code} (continuing; assets may be incomplete) → ${assetsOut}`,
            required: false,
          });
          if (!asJson) {
            console.log(
              "pipeline: materialize-assets reported failures; continuing (tokens/specs do not require assets)",
            );
          }
        } else {
          steps.push({
            name: "materialize-assets",
            status: "ok",
            detail: assetsOut,
            required: false,
          });
        }
      } catch (e) {
        steps.push({
          name: "materialize-assets",
          status: "failed",
          detail: String(/** @type {Error} */ (e)?.message ?? e),
          required: true,
        });
        failed = true;
      }
    }
  } else if (skipMaterialize) {
    steps.push({
      name: "materialize-assets",
      status: "skipped",
      detail: "flag --skip-materialize",
      required: true,
    });
  }

  // --- 3. tokens-from-ir ---
  if (!skipTokens && !failed) {
    const mod = tryLoadSibling("tokens-from-ir");
    const fn = mod ? resolveCommandFn(mod, "tokens-from-ir") : null;
    if (!fn) {
      steps.push({
        name: "tokens-from-ir",
        status: "skipped",
        detail: "module missing",
        required: true,
      });
      if (!asJson) console.log("pipeline: skip tokens-from-ir (module missing)");
    } else {
      if (!asJson) console.log("--- tokens-from-ir ---");
      try {
        const code = asCode(
          await fn(
            synthArgs("tokens-from-ir", {
              ir: irAbs,
              cwd,
              "out-dir": path.join(cwd, "docs", "research"),
            }),
            core,
          ),
        );
        if (code !== 0) {
          steps.push({
            name: "tokens-from-ir",
            status: "failed",
            detail: `exit ${code}`,
            required: true,
          });
          failed = true;
        } else {
          steps.push({
            name: "tokens-from-ir",
            status: "ok",
            detail: path.join(cwd, "docs", "research"),
            required: true,
          });
        }
      } catch (e) {
        steps.push({
          name: "tokens-from-ir",
          status: "failed",
          detail: String(/** @type {Error} */ (e)?.message ?? e),
          required: true,
        });
        failed = true;
      }
    }
  } else if (skipTokens) {
    steps.push({
      name: "tokens-from-ir",
      status: "skipped",
      detail: "flag --skip-tokens",
      required: true,
    });
  }

  // --- 4. register-from-ir ---
  if (!skipRegister && !failed) {
    const mod = tryLoadSibling("register-from-ir");
    const fn = mod ? resolveCommandFn(mod, "register-from-ir") : null;
    if (!fn) {
      steps.push({
        name: "register-from-ir",
        status: "skipped",
        detail: "module missing",
        required: true,
      });
      if (!asJson) console.log("pipeline: skip register-from-ir (module missing)");
    } else {
      if (!asJson) console.log("--- register-from-ir ---");
      try {
        const code = asCode(
          await fn(
            synthArgs("register-from-ir", {
              ir: irAbs,
              cwd,
            }),
            core,
          ),
        );
        if (code !== 0) {
          steps.push({
            name: "register-from-ir",
            status: "failed",
            detail: `exit ${code}`,
            required: true,
          });
          failed = true;
        } else {
          steps.push({
            name: "register-from-ir",
            status: "ok",
            detail: path.join(cwd, ".ctrlc", "registry.json"),
            required: true,
          });
        }
      } catch (e) {
        steps.push({
          name: "register-from-ir",
          status: "failed",
          detail: String(/** @type {Error} */ (e)?.message ?? e),
          required: true,
        });
        failed = true;
      }
    }
  } else if (skipRegister) {
    steps.push({
      name: "register-from-ir",
      status: "skipped",
      detail: "flag --skip-register",
      required: true,
    });
  }

  // --- 5. specs-from-ir ---
  if (!skipSpecs && !failed) {
    const mod = tryLoadSibling("specs-from-ir");
    const fn = mod ? resolveCommandFn(mod, "specs-from-ir") : null;
    if (!fn) {
      steps.push({
        name: "specs-from-ir",
        status: "skipped",
        detail: "module missing",
        required: true,
      });
      if (!asJson) console.log("pipeline: skip specs-from-ir (module missing)");
    } else {
      if (!asJson) console.log("--- specs-from-ir ---");
      try {
        const code = asCode(
          await fn(
            synthArgs("specs-from-ir", {
              ir: irAbs,
              cwd,
            }),
            core,
          ),
        );
        if (code !== 0) {
          steps.push({
            name: "specs-from-ir",
            status: "failed",
            detail: `exit ${code}`,
            required: true,
          });
          failed = true;
        } else {
          steps.push({
            name: "specs-from-ir",
            status: "ok",
            detail: path.join(cwd, "docs", "research", "components"),
            required: true,
          });
        }
      } catch (e) {
        steps.push({
          name: "specs-from-ir",
          status: "failed",
          detail: String(/** @type {Error} */ (e)?.message ?? e),
          required: true,
        });
        failed = true;
      }
    }
  } else if (skipSpecs) {
    steps.push({
      name: "specs-from-ir",
      status: "skipped",
      detail: "flag --skip-specs",
      required: true,
    });
  }

  // --- 6. scaffold-from-ir (React stubs; non-fatal if missing) ---
  if (!skipScaffold && !failed) {
    const mod = tryLoadSibling("scaffold-from-ir");
    const fn = mod ? resolveCommandFn(mod, "scaffold-from-ir") : null;
    if (!fn) {
      steps.push({
        name: "scaffold-from-ir",
        status: "skipped",
        detail: "module missing",
        required: false,
      });
      if (!asJson) {
        console.log("pipeline: skip scaffold-from-ir (module missing)");
      }
    } else {
      if (!asJson) console.log("--- scaffold-from-ir ---");
      try {
        const code = asCode(
          await fn(
            synthArgs("scaffold-from-ir", {
              ir: irAbs,
              cwd,
            }),
            core,
          ),
        );
        if (code !== 0) {
          steps.push({
            name: "scaffold-from-ir",
            status: "failed",
            detail: `exit ${code} (non-fatal)`,
            required: false,
          });
          if (!asJson) {
            console.log("pipeline: scaffold-from-ir failed (continuing)");
          }
        } else {
          steps.push({
            name: "scaffold-from-ir",
            status: "ok",
            detail: path.join(cwd, "src", "components", "sections"),
            required: false,
          });
        }
      } catch (e) {
        steps.push({
          name: "scaffold-from-ir",
          status: "failed",
          detail: `${String(/** @type {Error} */ (e)?.message ?? e)} (non-fatal)`,
          required: false,
        });
        if (!asJson) {
          console.log("pipeline: scaffold-from-ir error (continuing)");
        }
      }
    }
  } else if (skipScaffold) {
    steps.push({
      name: "scaffold-from-ir",
      status: "skipped",
      detail: "flag --skip-scaffold",
      required: false,
    });
  }

  // --- 7. baseline (optional; do not fail pipeline) ---
  if (!skipBaseline && !failed) {
    const irDir = path.dirname(irAbs);
    const shot = findScreenshotInDir(irDir);
    if (!shot) {
      steps.push({
        name: "baseline",
        status: "skipped",
        detail: "no screenshot next to IR",
        required: false,
      });
      if (!asJson) {
        console.log("pipeline: skip baseline (no screenshot next to IR)");
      }
    } else {
      const mod = tryLoadSibling("baseline");
      const fn = mod ? resolveCommandFn(mod, "baseline") : null;
      if (!fn) {
        steps.push({
          name: "baseline",
          status: "skipped",
          detail: "module missing",
          required: false,
        });
      } else {
        if (!asJson) console.log("--- baseline ---");
        try {
          const code = asCode(
            await fn(
              synthArgs("baseline", {
                ir: irAbs,
                cwd,
              }),
            ),
          );
          if (code !== 0) {
            steps.push({
              name: "baseline",
              status: "failed",
              detail: `exit ${code} (non-fatal)`,
              required: false,
            });
            if (!asJson) {
              console.log("pipeline: baseline failed (continuing)");
            }
          } else {
            steps.push({
              name: "baseline",
              status: "ok",
              detail: shot,
              required: false,
            });
          }
        } catch (e) {
          steps.push({
            name: "baseline",
            status: "failed",
            detail: `${String(/** @type {Error} */ (e)?.message ?? e)} (non-fatal)`,
            required: false,
          });
          if (!asJson) {
            console.log("pipeline: baseline error (continuing)");
          }
        }
      }
    }
  } else if (skipBaseline) {
    steps.push({
      name: "baseline",
      status: "skipped",
      detail: "flag --skip-baseline",
      required: false,
    });
  }

  // --- 8. plan-parallel (optional; only if module exists) ---
  if (!skipPlan && !failed) {
    const mod = tryLoadSibling("plan-parallel");
    const fn = mod ? resolveCommandFn(mod, "plan-parallel") : null;
    if (!fn) {
      steps.push({
        name: "plan-parallel",
        status: "skipped",
        detail: "module not present",
        required: false,
      });
      if (!asJson) {
        console.log("pipeline: skip plan-parallel (module not present)");
      }
    } else {
      if (!asJson) console.log("--- plan-parallel ---");
      try {
        const code = asCode(
          await fn(
            synthArgs("plan-parallel", {
              ir: irAbs,
              cwd,
            }),
            core,
          ),
        );
        if (code !== 0) {
          steps.push({
            name: "plan-parallel",
            status: "failed",
            detail: `exit ${code} (non-fatal)`,
            required: false,
          });
        } else {
          steps.push({
            name: "plan-parallel",
            status: "ok",
            required: false,
          });
        }
      } catch (e) {
        steps.push({
          name: "plan-parallel",
          status: "failed",
          detail: `${String(/** @type {Error} */ (e)?.message ?? e)} (non-fatal)`,
          required: false,
        });
      }
    }
  } else if (skipPlan) {
    steps.push({
      name: "plan-parallel",
      status: "skipped",
      detail: "flag --skip-plan",
      required: false,
    });
  }

  return finish(failed, steps, {
    asJson,
    dryRun: false,
    cwd,
    url,
    irPath: irAbs,
    captureOut,
  });
}

/**
 * @param {boolean} failed
 * @param {PipelineStepResult[]} steps
 * @param {{
 *   asJson: boolean,
 *   dryRun: boolean,
 *   cwd: string,
 *   url: string | null,
 *   irPath: string | null,
 *   captureOut: string | null,
 * }} meta
 */
function finish(failed, steps, meta) {
  const ok = !failed;
  if (meta.asJson) {
    console.log(
      JSON.stringify(
        {
          ok,
          dryRun: meta.dryRun,
          cwd: meta.cwd,
          url: meta.url || null,
          ir: meta.irPath,
          out: meta.captureOut,
          steps,
        },
        null,
        2,
      ),
    );
  } else {
    console.log("");
    console.log(
      ok
        ? "pipeline: complete"
        : "pipeline: finished with required step failure(s)",
    );
    for (const s of steps) {
      console.log(`  ${s.status.padEnd(8)} ${s.name}${s.detail ? ` - ${s.detail}` : ""}`);
    }
  }
  return ok ? 0 : 1;
}
