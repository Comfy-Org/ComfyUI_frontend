---
globs:
  - 'src/components/**/*.vue'
  - 'src/views/**/*.vue'
---

# Comfy Design Standards

Applies when implementing or modifying user-facing components and views.

## Before Implementing UI Changes

Consult the **Comfy Design Standards** Figma file to ensure your changes follow the agreed-upon design principles. Use the Figma MCP tool to fetch the current standards:

```javascript
get_figma_data({ fileKey: "QreIv5htUaSICNuO2VBHw0", nodeId: "0-1", depth: 1 })
```

The Figma file is the single source of truth. Always fetch it live — do not rely on cached assumptions.

### Key Sections

| Section              | Node ID   | When to consult                                                               |
| -------------------- | --------- | ----------------------------------------------------------------------------- |
| Hover States         | `1-2`     | Adding/modifying interactive elements (buttons, inputs, links, nav items)     |
| Click Targets        | `4-243`   | Adding clickable elements, especially small ones (icons, handles, connectors) |
| Affordances          | `15-2202` | Any interactive element — ensuring visual feedback on interaction             |
| Feedback             | `15-2334` | User actions that need confirmation, success/error states                     |
| Slips and How to Fix | `15-2337` | Error prevention, undo patterns, destructive actions                          |
| Design Pillars       | `15-2340` | New features, architectural UI decisions                                      |
| The User             | `16-2348` | User flows, onboarding, accessibility                                         |

Fetch the specific section relevant to your task:

```javascript
get_figma_data({ fileKey: "QreIv5htUaSICNuO2VBHw0", nodeId: "<node-id>", depth: 3 })
```

## Figma Component Reference

The Figma file contains component specifications. When implementing these components, fetch details to match the design:

| Component         | Component Set ID |
| ----------------- | ---------------- |
| Button/Default    | `4:314`          |
| Search            | `4:2366`         |
| Base Node Example | `4:4739`         |

## Integration with Codebase

- Map Figma color values to Tailwind 4 semantic tokens — never hardcode hex values
- Use `cn()` from `@/utils/tailwindUtil` for conditional class merging
- Use the `dark:` avoidance rule from AGENTS.md — semantic tokens handle both themes
