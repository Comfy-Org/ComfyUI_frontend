import {
  DEFAULT_DARK_COLOR_PALETTE,
  DEFAULT_LIGHT_COLOR_PALETTE
} from '@/constants/coreColorPalettes'
import { themeSchema } from '@/schemas/colorPaletteSchema'
import type {
  Colors,
  CompletedPalette,
  Theme
} from '@/schemas/colorPaletteSchema'

const THEME_KEYS = themeSchema.keyof().options

/** Whether the palette is the built-in dark or light palette. */
export function isCorePaletteId(colorPaletteId: string) {
  return colorPaletteId === 'dark' || colorPaletteId === 'light'
}

function deriveLegacyTheme({ comfy_base, litegraph_base }: Colors): Theme {
  const surface =
    comfy_base['interface-panel-surface'] ?? comfy_base['comfy-menu-bg']
  const contrast = comfy_base['contrast-mix-color'] ?? '#fff'
  const mixWithContrast = (surfacePercent: number) =>
    `color-mix(in srgb, ${surface} ${surfacePercent}%, ${contrast})`
  return {
    background: surface,
    foreground: comfy_base['fg-color'],
    'muted-foreground': comfy_base['descrip-text'],
    border: comfy_base['interface-stroke'] ?? mixWithContrast(75.5),
    accent:
      comfy_base['interface-panel-hover-surface'] ??
      comfy_base['interface-button-hover-surface'] ??
      mixWithContrast(92.5),
    muted:
      comfy_base['interface-panel-selected-surface'] ?? mixWithContrast(87.5),
    card: comfy_base['comfy-menu-secondary-bg'],
    secondary: litegraph_base.NODE_DEFAULT_COLOR,
    input: litegraph_base.WIDGET_BGCOLOR,
    node: litegraph_base.NODE_DEFAULT_BGCOLOR,
    'node-foreground': litegraph_base.NODE_TEXT_COLOR,
    'node-header': litegraph_base.NODE_DEFAULT_COLOR,
    'node-border': litegraph_base.WIDGET_OUTLINE_COLOR
  }
}

const DERIVED_THEME_DEFAULTS: Theme = {
  popover: 'var(--background)',
  input: 'var(--accent)',
  ring: 'var(--muted-foreground)',
  node: 'var(--card)',
  'node-foreground': 'var(--muted-foreground)',
  'node-header': 'var(--secondary)',
  'node-border': 'var(--border)'
}

function resolvePaletteTheme(palette: CompletedPalette): Theme {
  const base = palette.light_theme
    ? DEFAULT_LIGHT_COLOR_PALETTE.colors.theme
    : DEFAULT_DARK_COLOR_PALETTE.colors.theme
  const legacy = isCorePaletteId(palette.id)
    ? {}
    : deriveLegacyTheme(palette.colors)
  return {
    ...DERIVED_THEME_DEFAULTS,
    ...base,
    ...legacy,
    ...palette.colors.theme
  }
}

/** The CSS color scheme a palette's theme renders in. */
export function paletteColorScheme(
  palette: CompletedPalette
): 'light' | 'dark' {
  return palette.light_theme ? 'light' : 'dark'
}

/** Applies a palette's theme variables and color scheme to an element's inline style. */
export function applyPaletteTheme(
  style: CSSStyleDeclaration,
  palette: CompletedPalette
) {
  const theme = resolvePaletteTheme(palette)
  for (const key of THEME_KEYS) {
    const value = theme[key]
    if (value) {
      style.setProperty(`--${key}`, value)
    } else {
      style.removeProperty(`--${key}`)
    }
  }
  style.colorScheme = paletteColorScheme(palette)
}

/** Applies the core dark palette's theme variables to an element's inline style. */
export function applyDarkPaletteTheme(style: CSSStyleDeclaration) {
  applyPaletteTheme(style, DEFAULT_DARK_COLOR_PALETTE)
}
