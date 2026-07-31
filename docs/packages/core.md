# `@ctrlc/core`

Pack builder and pure logic. No React.

## Responsibilities

- Build single / multi section packs  
- Natural language briefs (+ auto-draft from sources)  
- Zip, recipes, variables  
- Validate config + JSON Schema  
- Graph, snapshot, diff, cache helpers  

## Install

```bash
npm install @ctrlc/core
```

## Common APIs

```ts
import {
  defineSectionPackConfig,
  buildSectionPackById,
  buildMultiSectionPack,
  formatPackForCopy,
  validateSectionPackConfig,
  draftBehaviorBrief,
  buildSectionGraph,
  snapshotSectionPack,
  diffSectionPacks,
  PackCache,
} from "@ctrlc/core";
```

## Demo config factory

```ts
import { createDemoSectionPackConfig } from "@ctrlc/core";

const config = createDemoSectionPackConfig(); // Northline paths
```

## Tests

```bash
npm run test -w @ctrlc/core
```

## Related

- [Config schema](../reference/config-schema.md)
- [Export formats](../reference/export-formats.md)
