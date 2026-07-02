# Comfy Design Standards

Reference for implementing user-facing components and views anywhere in the
codebase (`src/components/`, `src/views/`, `src/platform/`, `src/workbench/`,
`apps/`).

## When to Consult

When adding new UI or changing visual design, fetch the relevant section of
the **Comfy Design Standards** Figma file before implementing. Skip this for
refactors, bugfixes, and logic-only changes. If the Figma MCP is unavailable,
say so in the PR description instead of skipping silently.

The Figma file is the single source of truth. Always fetch it live — do not
rely on cached assumptions:

```javascript
get_figma_data({ fileKey: 'QreIv5htUaSICNuO2VBHw0', nodeId: '0:1' })
```

> **Note:** The Figma MCP is read-only. It cannot detect changes or diffs between versions. Always fetch the latest state before implementing.

### Key Sections

| Section              | Node ID   | When to consult                                                               |
| -------------------- | --------- | ----------------------------------------------------------------------------- |
| Hover States         | `1:2`     | Adding/modifying interactive elements (buttons, inputs, links, nav items)     |
| Click Targets        | `4:243`   | Adding clickable elements, especially small ones (icons, handles, connectors) |
| Affordances          | `15:2202` | Any interactive element — ensuring visual feedback on interaction             |
| Feedback             | `15:2334` | User actions that need confirmation, success/error states                     |
| Slips and How to Fix | `15:2337` | Error prevention, undo patterns, destructive actions                          |
| Design Pillars       | `15:2340` | New features, architectural UI decisions                                      |
| The User             | `16:2348` | User flows, onboarding, accessibility                                         |

Fetch the specific section relevant to your task:

```javascript
get_figma_data({ fileKey: 'QreIv5htUaSICNuO2VBHw0', nodeId: '<node-id>' })
```

## Figma Component Reference

The Figma file contains component specifications. When implementing these components, fetch details to match the design:

| Component         | Component Set ID |
| ----------------- | ---------------- |
| Button/Default    | `4:314`          |
| Search            | `4:2366`         |
| Base Node Example | `4:4739`         |

## Figma Token Translation Rules

When translating Figma design tokens into code:

- **Skip `-hover` and `-selected` suffixed tokens.** These states exist in Figma only for prototype demonstrations. On the frontend, hover and selected states must be derived programmatically (e.g., via `color-mix()` or Tailwind modifier classes like `hover:`).
- **Color tier system:** Figma uses a tiered color hierarchy:
  - **Base** — default surface/background colors
  - **Secondary** — elevated surfaces (e.g., sidebars, cards)
  - **Tertiary** — elements on modal panels (one shade lighter than base)
- Map Figma token names directly to Tailwind 4 semantic tokens — never hardcode hex values.

## Integration with Codebase

- Map Figma color values to Tailwind 4 semantic tokens — never hardcode hex values
- Use `cn()` from `@comfyorg/tailwind-utils` for conditional class merging
- Use the `dark:` avoidance rule from AGENTS.md — semantic tokens handle both themes
