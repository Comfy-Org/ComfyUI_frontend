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

/**
 * Whether a colour string will actually take when assigned to a canvas
 * `fillStyle`.
 *
 * Assigning an unparseable value is a silent no-op per the canvas spec - the
 * context keeps whatever colour it had - so callers that batch by colour need
 * to reject bad values up front rather than discover them by mis-painting.
 */
export function isRenderableColor(color: string | undefined): color is string {
  if (!color) return false
  // Absent in non-browser test environments; accepting the value there keeps
  // this from silently dropping every colour.
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') {
    return true
  }
  return CSS.supports('color', color)
}
