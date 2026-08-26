import { clamp } from 'es-toolkit'

import type { Transform } from '../node'
import { drawPlacedInto, placedBounds } from './bake'
import type { Bitmap } from './place'

const CLIPPED_LAYER_PREVIEW_OPACITY = 0.4

export interface OutsideCanvasPreviewLayer {
  bitmap: Bitmap
  opacity: number
  transform: Transform
}

interface CanvasSize {
  w: number
  h: number
}

function extendsOutsideCanvas(
  transform: Transform,
  canvas: CanvasSize
): boolean {
  const bounds = placedBounds(transform)
  return (
    bounds.x < 0 ||
    bounds.y < 0 ||
    bounds.x + bounds.w > canvas.w ||
    bounds.y + bounds.h > canvas.h
  )
}

export function drawOutsideCanvasPreview(
  ctx: CanvasRenderingContext2D,
  canvas: CanvasSize,
  layers: OutsideCanvasPreviewLayer[]
): void {
  const clippedLayers = layers.filter(
    (layer) =>
      layer.opacity > 0 && extendsOutsideCanvas(layer.transform, canvas)
  )
  if (!clippedLayers.length) return

  try {
    for (const layer of clippedLayers) {
      ctx.save()
      try {
        ctx.globalAlpha =
          CLIPPED_LAYER_PREVIEW_OPACITY * clamp(layer.opacity, 0, 1)
        drawPlacedInto(ctx, layer.bitmap, layer.transform, 0, 0)
      } finally {
        ctx.restore()
      }
    }
  } finally {
    ctx.clearRect(0, 0, canvas.w, canvas.h)
  }
}
