# @comfyorg/design-system

Shared CSS, tokens, and icon plugins for the ComfyUI Frontend app. This package is a **static CSS bundle** — no components, no runtime. Component-level design decisions (CVA variants, primitives) live under `src/components/ui/` in the main app.

## Files

| File                            | Role                                                                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/css/_palette.css`          | Tailwind v4 `@theme` tokens — color scales, brand colors, font family. These become utility classes (`bg-charcoal-500`, `text-brand-yellow`, `font-inter`).                                      |
| `src/css/layout.css`            | Tailwind v4 `@theme` tokens for the App Mode / App Builder layout system — grid dimensions, type scale, radii, motion timings, and layout-scoped color aliases bridged to PrimeVue theme tokens. |
| `src/css/base.css`              | Resets and baseline styles applied app-wide.                                                                                                                                                     |
| `src/css/fonts.css`             | `@font-face` rules.                                                                                                                                                                              |
| `src/css/style.css`             | Main entry — imports the above + Tailwind directives + plugins. App consumers import this.                                                                                                       |
| `src/css/lucideStrokePlugin.js` | Tailwind plugin that normalizes Lucide icon stroke widths.                                                                                                                                       |

## How consumers use this package

Consumed via the package's `./css/*` export (declared in `package.json`):

```css
@import '@comfyorg/design-system/css/style.css';
```

Done once at the app entry; nothing else to wire.

## When to add a token here vs. elsewhere

- **Palette-level** (a new brand color, a new neutral shade that any feature might use) → here, in `_palette.css` under `@theme`.
- **Component-specific** (button sizes, input heights, select trigger border states) → CVA variants file next to the component (e.g. `src/components/ui/button/button.variants.ts`).
- **Feature-specific** (e.g. a single view's grid dimensions, motion timings for a specific animation) → colocated with the feature.

Rule of thumb: if more than two unrelated features would plausibly use the token, it belongs here. If it's "App Mode only" or "this one view only," keep it local.

## See also

- `docs/guidance/design-standards.md` — binding rules, Figma mapping, color tiers.
- `docs/guidance/vue-components.md` — Vue/SFC conventions.
