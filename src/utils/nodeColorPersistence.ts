import {
  adjustColor,
  parseToRgb,
  rgbToHex,
  toHexFromFormat
} from '@/utils/colorUtil'

export const DEFAULT_CUSTOM_NODE_COLOR = '#353535'

export const NODE_COLOR_FAVORITES_SETTING_ID = 'Comfy.NodeColor.Favorites'
export const NODE_COLOR_RECENTS_SETTING_ID = 'Comfy.NodeColor.Recents'
export const NODE_COLOR_DARKER_HEADER_SETTING_ID =
  'Comfy.NodeColor.DarkerHeader'

export const NODE_COLOR_SWATCH_LIMIT = 8

export function getDefaultCustomNodeColor(): string {
  return rgbToHex(parseToRgb(DEFAULT_CUSTOM_NODE_COLOR)).toLowerCase()
}

export function normalizeNodeColor(color: string | null | undefined): string {
  if (!color) return getDefaultCustomNodeColor()
  return toHexFromFormat(color, 'hex').toLowerCase()
}

export function deriveCustomNodeHeaderColor(
  backgroundColor: string,
  darkerHeader: boolean
): string {
  const normalized = normalizeNodeColor(backgroundColor)
  if (!darkerHeader) return normalized

  return rgbToHex(
    parseToRgb(adjustColor(normalized, { lightness: -0.18 }))
  ).toLowerCase()
}

export function upsertRecentNodeColor(
  colors: string[],
  color: string,
  limit: number = NODE_COLOR_SWATCH_LIMIT
): string[] {
  const normalized = normalizeNodeColor(color)
  return [normalized, ...colors.filter((value) => value !== normalized)].slice(
    0,
    limit
  )
}

export function toggleFavoriteNodeColor(
  colors: string[],
  color: string,
  limit: number = NODE_COLOR_SWATCH_LIMIT
): string[] {
  const normalized = normalizeNodeColor(color)
  if (colors.includes(normalized)) {
    return colors.filter((value) => value !== normalized)
  }

  return [...colors, normalized].slice(-limit)
}
