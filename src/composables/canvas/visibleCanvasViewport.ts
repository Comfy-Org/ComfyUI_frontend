import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

/* The CSS-pixel canvas region available for framing content. */
export function visibleCanvasViewport(canvas: LGraphCanvas): ReadOnlyRect {
  const width = canvas.canvas.width / window.devicePixelRatio
  const height = canvas.canvas.height / window.devicePixelRatio
  return [0, 0, width, height]
}
