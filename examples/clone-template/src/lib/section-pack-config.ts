import fs from "node:fs";
import path from "node:path";
import {
  defineSectionPackConfig,
  mergeSectionRegistry,
  type SectionPackConfig,
  type SectionPackRegistryFile,
} from "@ctrlc/core";

/**
 * Empty host SectionPack config for a fresh clone.
 * Runtime additions from `ctrlc register` live in `.ctrlc/registry.json`
 * and are merged by {@link getSectionPackConfig}.
 */
const baseSectionPackConfig = defineSectionPackConfig({
  defaultVariables: {},
  sharedUtilSelectors: [],
  recipes: [],
  sections: [],
});

/** Static base config (no demo sections). Prefer getSectionPackConfig() in the API. */
export const sectionPackConfig = baseSectionPackConfig;

/**
 * Config used by the SectionPack API: empty base + optional registry.json.
 */
export function getSectionPackConfig(): SectionPackConfig {
  const regPath = path.join(process.cwd(), ".ctrlc", "registry.json");
  if (!fs.existsSync(regPath)) return baseSectionPackConfig;
  try {
    const reg = JSON.parse(
      fs.readFileSync(regPath, "utf8"),
    ) as SectionPackRegistryFile;
    return mergeSectionRegistry(baseSectionPackConfig, reg);
  } catch {
    return baseSectionPackConfig;
  }
}

export default sectionPackConfig;
