# Dual export

Every SectionPack supports two complementary outputs.

## Natural language (`describe`)

A structured brief an agent (or human) can use to **rebuild** the section without pasting every source file:

- What it is  
- Function (job to be done)  
- Behavior and interaction  
- Motion and animation  
- Layout, alignment, spacing  
- Color and surfaces  
- Typography  
- Responsive behavior  
- Accessibility  
- Multi-file influences (paths, imports, shared modules)  
- Rebuild guidance  

**Sources of brief fields** (priority):

1. Hand-authored `entry.behavior` / registry briefs  
2. Auto-draft from component + CSS analysis  
3. Label/description fallbacks  

## Code as-is

Real multi-file implementation for templates and agents:

| Format | Content |
|--------|---------|
| `prompt` | Full markdown pack with tree + sources |
| `prompt-short` | Compact code pack |
| `component` / `content` / `css` | Single surface |
| `template` | Drop-in import snippet |
| `cursor-rule` | AGENTS / rule fragment |
| `json` | Machine-readable full pack |
| `zip` | Folder download (`NATURAL_LANGUAGE.md` + sources) |

## When to use which

| Goal | Prefer |
|------|--------|
| Redesign / prompt another model | Natural language |
| Reuse exact implementation | Code as-is (`prompt` or `zip`) |
| CI drift | Snapshots + `contentHash` |
| Offline agent bag | `ctrlc library` (both files per section) |

## Multi-section

Select several sections (inspector tray or catalog) or use recipes:

```http
GET /api/dev/section-pack?ids=hero,features,cta&format=describe
GET /api/dev/section-pack?recipe=landing-core&format=prompt
```

Brand variables:

```http
GET /api/dev/section-pack?id=hero&format=describe&var.productName=Acme
```

See [Export formats](../reference/export-formats.md).
