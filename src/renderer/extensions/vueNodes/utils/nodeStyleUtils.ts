import { RenderShape } from '@/lib/litegraph/src/types/globalEnums'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { adjustColor } from '@/utils/colorUtil'

/** Lightness litegraph applies to node colors in a light color scheme. */
export const LIGHT_THEME_NODE_LIGHTNESS = 0.5

/** Lightens a node color the way a light color scheme renders it. */
export function toLightThemeNodeColor(color: string): string {
  return adjustColor(color, { lightness: LIGHT_THEME_NODE_LIGHTNESS })
}

/** Lightens a node color only when the active palette is light. */
export function applyLightThemeColor(color?: string): string {
  if (!color) return ''

  if (useColorPaletteStore().colorScheme !== 'light') return color

  return toLightThemeNodeColor(color)
}

export interface ShapeClassVariants {
  readonly box: string
  readonly card: string
  readonly default: string
}

/**
 * Picks the class variant matching a node's render shape, treating every
 * shape other than BOX and CARD as the default rounding.
 */
export function shapeVariantClass(
  shape: RenderShape | undefined,
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
