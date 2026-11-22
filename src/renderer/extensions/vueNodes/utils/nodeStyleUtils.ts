import { RenderShape } from '@comfyorg/graph-model/globalEnums'
import { useThemeStore } from '@/platform/theme/themeStore'
import { adjustColor } from '@comfyorg/shared-frontend-utils/colorUtil'

/** Adjusts a node color the way the active theme renders nodes. */
export function toThemeNodeColor(color?: string): string {
  if (!color) return ''
  const lightness = useThemeStore().activeTheme.canvas.nodeLightness
  return lightness ? adjustColor(color, { lightness }) : color
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
