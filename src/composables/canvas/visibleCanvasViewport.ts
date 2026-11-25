import type { ReadOnlyRect } from '@comfyorg/shared-frontend-utils/geometry'
import { clamp } from 'es-toolkit'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

/** The CSS-pixel part of the canvas that no side panel, properties panel or agent panel covers. */
export function visibleCanvasViewport(
  canvas: Pick<LGraphCanvas, 'ds'>
): ReadOnlyRect {
  const [width, height] = canvas.ds.getViewportSize()
  const graphArea = document
    .getElementById('graph-canvas-panel')
    ?.getBoundingClientRect()
  if (!graphArea) return [0, 0, width, height]

  const canvasLeft = canvas.ds.element.getBoundingClientRect().left
  const left = clamp(graphArea.left - canvasLeft, 0, width)
  const right = clamp(graphArea.right - canvasLeft, 0, width)
  return right > left ? [left, 0, right - left, height] : [0, 0, width, height]
}
