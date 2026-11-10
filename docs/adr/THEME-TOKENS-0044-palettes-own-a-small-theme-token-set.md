# ADR-THEME-TOKENS-0044: Palettes Own a Small Theme Token Set

Date: 2026-10-15

## Status

Proposed

## Context

After PrimeVue left, `packages/design-system/src/css/style.css` was 1,561 lines
with about 350 custom-property declarations. Light and dark were two
hand-mirrored blocks, and a `.dark-theme` class on `<html>` picked between
them. Eighteen files branched on the palette's `light_theme` flag. The arc,
github, nord and solarized palettes only set the old `comfy_base` variables
(`--comfy-menu-bg`, `--fg-color`, and so on), so every design-system surface
stayed charcoal inside them.

A theme author had to know about 101 component tokens per mode. Most were
hover, selected or disabled shades of a handful of colors.

## Decision

A palette is the only thing that changes the theme. Its `colors.theme` accepts
19 values. Ten are the core a theme author should set:

| Group    | Tokens                                               |
| -------- | ---------------------------------------------------- |
| Surfaces | `background`, `card`, `secondary`, `muted`, `accent` |
| Text     | `foreground`, `muted-foreground`                     |
| Roles    | `primary`, `destructive`                             |
| Lines    | `border`                                             |

The other nine fall back when a palette leaves them out:

| Token             | Fallback           |
| ----------------- | ------------------ |
| `popover`         | `background`       |
| `input`           | `accent`           |
| `ring`            | `muted-foreground` |
| `node`            | `card`             |
| `node-foreground` | `muted-foreground` |
| `node-header`     | `secondary`        |
| `node-border`     | `border`           |
| `warning`         | the base theme     |
| `shadow-color`    | the base theme     |

The base theme is `dark.json` or `light.json`, picked by the palette's
`light_theme` flag. `warning-foreground`, `success`, `credit` and `bypass` are
constants in `@theme`, not palette values.

The names follow shadcn/ui, and `ring` is the focus color as it is there. One
difference matters when importing a tweakcn theme: there are no
`*-foreground` pairs for the surfaces. The node layer exists because graph
nodes sit on the canvas and need their own contrast.

- `:root` holds the dark theme. `applyPaletteTheme` writes the active palette's
  values inline on `<html>`. There is no `.dark-theme` class, and components
  read tokens instead of `light_theme`. Code that must know the mode (Turnstile,
  media previews, node tinting) reads `colorPaletteStore.colorScheme`.
- A palette without `colors.theme` gets one derived from its `comfy_base` and
  `litegraph_base` colors, layered over the base theme, so older and custom
  palettes restyle the whole app.
- Interaction states use a core token with opacity (`secondary/80`,
  `primary/90`, `border/50`) or `accent` and `muted`. They do not get tokens of
  their own.
- `error` and `danger-*` fold into `destructive`.
- Shadows come from one scale. Tailwind's `shadow-2xs` to `shadow-2xl` and
  `drop-shadow-xs` to `drop-shadow-lg` all draw in `shadow-color`, so a
  palette changes every shadow with one value.
- The base layer sets `border-color` to `border`. Add a border color class
  only for a border that differs from it.
- Text color and size go on the element that owns them (`body`, the node root,
  widget hosts) and inherit. Tailwind preflight stays off, but the base layer
  copies its form-control rule (`font`, `letter-spacing` and `color` inherit
  on `button`, `input`, `select`, `optgroup` and `textarea`), so controls
  inherit too. Delete that rule when preflight lands.
- The old palette variables live in `_legacy-palette.css` as aliases of the
  theme tokens (`--comfy-menu-bg: var(--background)` and so on). Core palettes
  keep their original `comfy-input-bg`, `input-text` and `border-color` values
  for LiteGraph textareas and old-menu buttons. These controls retain their
  palette colors while modern controls use theme tokens. Non-core palettes
  still write their own `comfy_base` values. Custom nodes also read the old
  variables, so the aliases stay. Renamed extension variables stay in
  `_deprecated-aliases.css` for the same reason.

## Consequences

- A new theme needs 10 values. `dark.json` and `light.json` are the
  reference; each sets only the values that differ from the fallbacks.
- Adding a token touches the schema, both core palettes, the `:root` defaults,
  the `@theme inline` mapping and the legacy derivation.
- Derived palettes take `primary`, `destructive` and `warning` from the base
  theme, because `comfy_base` has no equivalent.
- Custom nodes that read a removed variable outside the deprecated aliases
  lose that color.
- The `dark:` variant and `--p-*` variables stay banned. When a component needs
  a different color per mode, it gets a token instead.

## Alternatives considered

- Keep the component tokens and only delete the dead ones. That still leaves
  two mirrored blocks and about 100 names per mode.
- Use CSS `light-dark()` for each token. It removes the class but keeps two
  values per token in the stylesheet, and palettes other than light and dark
  still cannot change them.
