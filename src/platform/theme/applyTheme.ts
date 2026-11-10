import type { Theme } from '@comfyorg/theme-core/resolveTheme'
import { usesThemeAliases } from '@comfyorg/theme-core/resolveTheme'
import {
  comfyBaseSchema,
  themeSchema
} from '@comfyorg/theme-core/themePresetSchema'

import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'

const THEME_ALIASED_LEGACY_KEYS: ReadonlySet<string> = new Set([
  'fg-color',
  'bg-color',
  'comfy-menu-bg',
  'comfy-menu-secondary-bg',
  'descrip-text',
  'drag-text',
  'error-text',
  'tr-even-bg-color',
  'tr-odd-bg-color',
  'content-bg',
  'content-fg',
  'content-hover-bg',
  'content-hover-fg'
])

type ThemeTarget = {
  style: CSSStyleDeclaration
  canvas?: LGraphCanvas
  dataTypes?: Iterable<string>
  backgroundImage?: string
}

function applyCssTokens(theme: Theme, style: CSSStyleDeclaration) {
  for (const key of themeSchema.keyof().options) {
    const value = theme.cssTokens[key]
    if (value) style.setProperty(`--${key}`, value)
    else style.removeProperty(`--${key}`)
  }
  style.colorScheme = theme.colorScheme
}

function applyLegacyCssVars(theme: Theme, target: ThemeTarget) {
  for (const key of comfyBaseSchema.keyof().options) {
    if (key === 'bg-img') continue
    const value = theme.legacyCss[key]
    if (
      value === undefined ||
      (usesThemeAliases(theme.id) && THEME_ALIASED_LEGACY_KEYS.has(key))
    ) {
      target.style.removeProperty(`--${key}`)
    } else {
      target.style.setProperty(`--${key}`, value)
    }
  }
  if (target.backgroundImage) {
    target.style.setProperty('--bg-img', `url('${target.backgroundImage}')`)
  } else {
    target.style.removeProperty('--bg-img')
  }
}

function applyLiteGraphGlobals(theme: Theme) {
  const values = theme.preset.colors.litegraph_base
  if (typeof values.NODE_DEFAULT_SHAPE === 'string') {
    console.warn(
      `litegraph_base.NODE_DEFAULT_SHAPE only accepts [${[
        LiteGraph.BOX_SHAPE,
        LiteGraph.ROUND_SHAPE,
        LiteGraph.CARD_SHAPE
      ].join(', ')}] but got ${values.NODE_DEFAULT_SHAPE}`
    )
  }
  Object.assign(LiteGraph, {
    ...values,
    NODE_DEFAULT_SHAPE:
      typeof values.NODE_DEFAULT_SHAPE === 'string'
        ? LiteGraph.ROUND_SHAPE
        : values.NODE_DEFAULT_SHAPE
  })
}

function applyCanvasColors(
  theme: Theme,
  canvas: LGraphCanvas,
  backgroundImage?: string
) {
  canvas.node_title_color = theme.canvas.nodeTitleColor
  canvas.default_link_color = theme.canvas.linkColor
  if (backgroundImage) {
    canvas.clear_background_color = 'transparent'
  } else {
    canvas.background_image = theme.canvas.backgroundImage
    canvas.clear_background_color = theme.canvas.clearBackgroundColor
  }
  canvas._pattern = undefined
}

function applyDataTypeColors(theme: Theme, target: ThemeTarget) {
  const colors: Record<string, string> = theme.dataTypeColors
  const types = Array.from(target.dataTypes ?? Object.keys(colors))
  for (const type of types) {
    const value = colors[type]
    if (value) target.style.setProperty(`--color-datatype-${type}`, value)
    else target.style.removeProperty(`--color-datatype-${type}`)
  }
  if (target.canvas) {
    const reset = Object.fromEntries(types.map((type) => [type, '']))
    Object.assign(target.canvas.default_connection_color_byType, reset, colors)
    Object.assign(LGraphCanvas.link_type_colors, reset, colors)
  }
}

export function applyTheme(theme: Theme, target: ThemeTarget) {
  if (target.canvas) {
    applyLiteGraphGlobals(theme)
    applyCanvasColors(theme, target.canvas, target.backgroundImage)
  }
  applyCssTokens(theme, target.style)
  applyDataTypeColors(theme, target)
  applyLegacyCssVars(theme, target)
  target.canvas?.setDirty(true, true)
}
