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
| `./workspaceAvatar`  | Deterministic workspace avatar styles by plan and name     |

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

Precedent (updated 2026-09-28): #14790 ("move the brand layer into the
package") took brand tokens out of `_palette.css` and stopped `base.css`
loading Inter. The review raised whether that should be a major release. npm
subsequently published `1.1.0` from `main` without the brand-layer move, while
#14790's merge remains outside `main`. The verdict is unchanged: the move **is
breaking** — the PR's own body says so — and now breaks the public surface of
the shipped `1.1.0`. When the brand-layer move reaches `main`, its first npm
release must therefore be **`2.0.0`**, not another `1.x` release.
