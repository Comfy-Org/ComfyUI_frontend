import { RenderShape } from '@comfyorg/graph-model/globalEnums'

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

/** Whether a canvas `fillStyle` would accept the colour. */
export function isRenderableColor(color: string | undefined): color is string {
  if (!color) return false
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') {
    return true
  }
  return CSS.supports('color', color)
}
