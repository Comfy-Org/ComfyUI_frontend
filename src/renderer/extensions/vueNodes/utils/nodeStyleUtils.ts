import { RenderShape } from '@/lib/litegraph/src/types/globalEnums'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { adjustColor } from '@/utils/colorUtil'

/**
 * Applies light theme color adjustments to a color
 */
export function applyLightThemeColor(color?: string): string {
  if (!color) return ''

  if (!useColorPaletteStore().completedActivePalette.light_theme) return color

  return adjustColor(color, { lightness: 0.5 })
}

export interface ShapeClassVariants {
  box: string
  card: string
  default: string
}

/**
 * Picks the class variant matching a node's render shape, treating every
 * shape other than BOX and CARD as the default rounding.
 */
export function shapeVariantClass(
  shape: number | undefined,
  variants: ShapeClassVariants
): string {
  switch (shape) {
    case RenderShape.BOX:
      return variants.box
    case RenderShape.CARD:
      return variants.card
    default:
      return variants.default
  }
}
