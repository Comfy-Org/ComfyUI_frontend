import { adjustColor } from '@/utils/colorUtil'

/**
 * Applies light theme color adjustments to a color
 */
export function applyLightThemeColor(
  color: string,
  isLightTheme: boolean
): string {
  if (!color || !isLightTheme) {
    return color
  }
  return adjustColor(color, { lightness: 0.5 })
}
