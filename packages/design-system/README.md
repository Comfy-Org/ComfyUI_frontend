# @comfyorg/design-system

Shared design tokens, theme, and icon set for Comfy Org frontends. Ships raw CSS
and SVG so consumers compile them with their own Tailwind build.

## Install

```sh
pnpm add @comfyorg/design-system tailwindcss
```

Tailwind v4 is a peer dependency — `style.css` imports `tailwindcss/theme` and
`tailwindcss/utilities`, and the bundled plugins import `tailwindcss/plugin`.

## Usage

Import the full theme from your app's entry stylesheet:

```css
@import '@comfyorg/design-system/css/style.css';
```

This pulls in the fonts, the color palette, the Tailwind theme and utilities
layers, `tw-animate-css`, the PrimeUI plugin, and the Comfy and Lucide icon
plugins.

For the palette and fonts without the Tailwind layers or icon plugins:

```css
@import '@comfyorg/design-system/css/base.css';
```

## Exports

| Path                 | Contents                                                   |
| -------------------- | ---------------------------------------------------------- |
| `./css/style.css`    | Full theme — palette, fonts, Tailwind layers, icon plugins |
| `./css/base.css`     | Palette and fonts only                                     |
| `./css/_palette.css` | Color variables                                            |
| `./css/fonts.css`    | Font faces                                                 |
| `./icons/*.svg`      | Comfy icon set source SVGs                                 |

Icons are exposed to Tailwind as `icon-[comfy--*]` and `icon-mask-[comfy--*]`
utilities. Size them with `size-*`, not font-size classes.

## Releasing

Run the **Version Bump Design System** workflow to open a version PR, then merge
it with the `Release` label. Publishing to npm happens automatically on merge.

### SemVer policy

This package follows SemVer for everything it exports: the CSS entry points
(`style.css`, `base.css`, and every `./css/*` path in the [exports
table](#exports)) and the icon SVGs are the public surface, and removing or
repurposing tokens, `@font-face` declarations, or an entire file from that
surface is a **major** bump — even when no in-repo consumer breaks, because
published consumers pin this package by version.

Precedent (recorded 2026-09-03): #14790 ("move the brand layer into the
package") took brand tokens out of `_palette.css` and stopped `base.css`
loading Inter. That PR was merged into a feature-branch stack with an
in-tree version of `1.1.0`, and the review raised whether it should have been
`2.0.0`. The verdict: the change **is breaking** — the PR's own body says so,
and nothing was ever published to npm at `1.1.0` (the published versions are
`1.0.0` and `1.0.1`), so there is no shipped `1.1.x` to defend. The next
release that carries the brand-layer move must therefore be **`2.0.0`**, not
`1.1.0`; do not let the in-tree `1.1.0` from that stack reach npm.
