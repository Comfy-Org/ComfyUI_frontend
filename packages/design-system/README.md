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

## Consuming tokens

Never write out a value this package ships — read it from the package. That
holds for every token here: colors, fonts, icons, spacing, radii, shadows, text
sizes.

Matching the value is not enough. A literal that equals the token today still
drifts the day the token changes, and nothing points at it when it does. Brand
yellow went stale by a full revision (`#f0ff41` vs `#f2ff59`) purely because
copies of it existed.

| Context                                 | Consume it as                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| Tailwind class                          | `bg-brand-yellow`, `fill-primary-comfy-ink`, `font-inter`                            |
| CSS, `style` attributes, inline SVG     | `var(--color-brand-yellow)`                                                          |
| A derived variant                       | `rgb(from var(--color-primary-comfy-ink) r g b / 0.8)`, never a pre-mixed literal    |
| Canvas, WebGL, any API needing a string | read it at runtime — in this repo, `readDesignToken('--color-primary-comfy-yellow')` |
| A fallback                              | another token — `readDesignToken('--color-muted-foreground', '--color-smoke-800')`   |

The runtime reader lives in `@comfyorg/shared-frontend-utils/designTokens`; it
resolves the custom property off `document.documentElement`, so the value stays
whatever the stylesheet says.

Do not use `fill="var(--token)"` as an SVG presentation attribute. Substitution
functions there were only resolved into SVG2 in Nov 2025 and Chromium support is
uneven — use a `fill-*` utility class or a `style="fill: var(...)"` declaration.

If the token you need is missing from the entry point you import, add it here
rather than copying the value. `base.css` is the marketing-site entry point and
deliberately excludes the PrimeVue and node-editor theme.

Two things this does not mean:

- A value that coincidentally equals a token is not a token usage. `#d9d9d9` as
  a minimap node fill is not `smoke-400`; rewriting it would couple unrelated UI
  to the brand and change it on the next brand tweak.
- Where a literal is unavoidable — a `<meta name="theme-color">`, a copyable hex
  on a brand page, a standalone `.svg` fetched as an image — pin it with a test
  instead, as `apps/website/src/data/brandColors.test.ts` does.

## Releasing

Run the **Version Bump Design System** workflow to open a version PR, then merge
it with the `Release` label. Publishing to npm happens automatically on merge.
