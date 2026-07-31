import { createSectionPackHandlers } from "@ctrlc/next";
import { getSectionPackConfig } from "@/lib/section-pack-config";

/**
 * GET /api/dev/section-pack
 *   ?list=1
 *   ?id=<section>&format=prompt|prompt-short|describe|component|content|css|template|json|zip
 *   ?ids=a,b&format=prompt-short
 *   ?recipe=<recipeId>
 *
 * Base config starts empty; `ctrlc register` writes `.ctrlc/registry.json`
 * and is merged by getSectionPackConfig().
 */
export const { GET } = createSectionPackHandlers(() => getSectionPackConfig());
