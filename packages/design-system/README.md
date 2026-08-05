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
