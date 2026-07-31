import { createSectionPackHandlers } from "@ctrlc/next";
import { getSectionPackConfig } from "@/lib/section-pack-config";

/**
 * GET /api/dev/section-pack
 *   ?list=1
 *   ?id=hero&format=prompt|prompt-short|describe|component|content|css|template|json|zip
 *   ?ids=hero,features&format=prompt-short
 *   ?recipe=landing-core
 *
 * Merges base demo config with `.ctrlc/registry.json` (ctrlc register).
 */
export const { GET } = createSectionPackHandlers(() => getSectionPackConfig());
