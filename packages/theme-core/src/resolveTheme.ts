import {
  DEFAULT_DARK_THEME_PRESET,
  DEFAULT_LIGHT_THEME_PRESET
} from './builtInThemePresets'
import type {
  Colors,
  CompletedThemePreset,
  ThemePreset,
  ThemeTokens
} from './themePresetSchema'

export function usesThemeAliases(id: string) {
  return id === 'dark' || id === 'light'
}

function deriveLegacyTheme({
  comfy_base,
  litegraph_base
}: Colors): ThemeTokens {
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

const DERIVED_THEME_DEFAULTS: ThemeTokens = {
  popover: 'var(--background)',
  input: 'var(--accent)',
  ring: 'var(--muted-foreground)',
  node: 'var(--card)',
  'node-foreground': 'var(--muted-foreground)',
  'node-header': 'var(--secondary)',
  'node-border': 'var(--border)'
}

export function resolveTheme(preset: ThemePreset) {
  const defaults = preset.light_theme
    ? DEFAULT_LIGHT_THEME_PRESET
    : DEFAULT_DARK_THEME_PRESET
  const authoredLegacy = preset.colors.comfy_base
  const secondaryBackground =
    authoredLegacy['comfy-menu-bg'] &&
    !authoredLegacy['comfy-menu-secondary-bg']
      ? { 'comfy-menu-secondary-bg': authoredLegacy['comfy-menu-bg'] }
      : {}
  const completedPreset: CompletedThemePreset = {
    ...preset,
    colors: {
      ...preset.colors,
      node_slot: { ...defaults.colors.node_slot, ...preset.colors.node_slot },
      litegraph_base: {
        ...defaults.colors.litegraph_base,
        ...preset.colors.litegraph_base
      },
      comfy_base: {
        ...defaults.colors.comfy_base,
        ...authoredLegacy,
        ...secondaryBackground
      }
    }
  }
  const legacy = usesThemeAliases(preset.id)
    ? {}
    : deriveLegacyTheme(completedPreset.colors)
  const canvas = completedPreset.colors.litegraph_base
  return {
    id: preset.id,
    name: preset.name,
    colorScheme: preset.light_theme ? ('light' as const) : ('dark' as const),
    preset: completedPreset,
    cssTokens: {
      ...DERIVED_THEME_DEFAULTS,
      ...defaults.colors.theme,
      ...legacy,
      ...preset.colors.theme
    },
    legacyCss: completedPreset.colors.comfy_base,
    controls: {
      inputTextColor: completedPreset.colors.comfy_base['input-text']
    },
    dataTypeColors: completedPreset.colors.node_slot,
    canvas: {
      backgroundImage: canvas.BACKGROUND_IMAGE,
      clearBackgroundColor: canvas.CLEAR_BACKGROUND_COLOR,
      nodeTitleColor: canvas.NODE_TITLE_COLOR,
      nodeSelectedTitleColor: canvas.NODE_SELECTED_TITLE_COLOR,
      nodeTextColor: canvas.NODE_TEXT_COLOR,
      nodeDefaultColor: canvas.NODE_DEFAULT_COLOR,
      widgetBackgroundColor: canvas.WIDGET_BGCOLOR,
      widgetTextColor: canvas.WIDGET_TEXT_COLOR,
      widgetSecondaryTextColor: canvas.WIDGET_SECONDARY_TEXT_COLOR,
      linkColor: canvas.LINK_COLOR,
      badgeForegroundColor: canvas.BADGE_FG_COLOR,
      badgeBackgroundColor: canvas.BADGE_BG_COLOR
    }
  }
}

export type Theme = ReturnType<typeof resolveTheme>
