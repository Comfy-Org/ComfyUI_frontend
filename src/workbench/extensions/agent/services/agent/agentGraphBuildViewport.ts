import type { DragAndScaleState } from '@/lib/litegraph/src/DragAndScale'
import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'

export function graphBuildCameraTarget(
  bounds: ReadOnlyRect,
  viewport: ReadOnlyRect,
  current: DragAndScaleState
): DragAndScaleState | null {
  const [x, y, width, height] = bounds
  const [left, top, viewportWidth, viewportHeight] = viewport
  if (viewportWidth <= 0 || viewportHeight <= 0 || width <= 0 || height <= 0)
    return null
  const screenX = (x + current.offset[0]) * current.scale
  const screenY = (y + current.offset[1]) * current.scale
  if (
    screenX >= left &&
    screenY >= top &&
    screenX + width * current.scale <= left + viewportWidth &&
    screenY + height * current.scale <= top + viewportHeight
  )
    return null
  const scale = Math.min(
    current.scale,
    viewportWidth / width,
    viewportHeight / height
  )
  return {
    scale,
    offset: [
      (left + viewportWidth / 2) / scale - x - width / 2,
      (top + viewportHeight / 2) / scale - y - height / 2
    ]
  }
}
