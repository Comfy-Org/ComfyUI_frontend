import { useRafFn } from '@vueuse/core'

import type { DragAndScale } from '@/lib/litegraph/src/DragAndScale'

const EDGE_THRESHOLD = 50

interface AutoPanOptions {
  canvas: HTMLCanvasElement
  ds: DragAndScale
  maxPanSpeed: number
  onPan: (canvasDeltaX: number, canvasDeltaY: number) => void
}

/**
 * Calculates the pan speed for a single axis based on distance from the edge.
 * Returns negative speed for left/top edges, positive for right/bottom edges,
 * or 0 if the pointer is not near any edge. Pans at max speed when the
 * pointer is outside the bounds (e.g. dragged outside the window).
 */
export function calculateEdgePanSpeed(
  pointerPos: number,
  minBound: number,
  maxBound: number,
  scale: number,
  maxPanSpeed: number
): number {
  if (maxPanSpeed <= 0) return 0

  const distFromMin = pointerPos - minBound
  const distFromMax = maxBound - pointerPos

  if (distFromMin < 0) return -maxPanSpeed / scale

  if (distFromMax < 0) return maxPanSpeed / scale

  if (distFromMin < EDGE_THRESHOLD) {
    return (-maxPanSpeed * (1 - distFromMin / EDGE_THRESHOLD)) / scale
  }

  if (distFromMax < EDGE_THRESHOLD) {
    return (maxPanSpeed * (1 - distFromMax / EDGE_THRESHOLD)) / scale
  }

  return 0
}

export class AutoPanController {
  private pointerX = 0
  private pointerY = 0
  private readonly canvas: HTMLCanvasElement
  private readonly ds: DragAndScale
  private readonly maxPanSpeed: number
  private readonly onPan: (dx: number, dy: number) => void
  private readonly raf: ReturnType<typeof useRafFn>

  constructor(options: AutoPanOptions) {
    this.canvas = options.canvas
    this.ds = options.ds
    this.maxPanSpeed = options.maxPanSpeed
    this.onPan = options.onPan
    this.raf = useRafFn(() => this.tick(), { immediate: false })
  }

  updatePointer(screenX: number, screenY: number) {
    this.pointerX = screenX
    this.pointerY = screenY
  }

  start() {
    this.raf.resume()
  }

  stop() {
    this.raf.pause()
  }

  private tick() {
    const rect = this.canvas.getBoundingClientRect()
    const scale = this.ds.scale

    const panX = calculateEdgePanSpeed(
      this.pointerX,
      rect.left,
      rect.right,
      scale,
      this.maxPanSpeed
    )
    const panY = calculateEdgePanSpeed(
      this.pointerY,
      rect.top,
      rect.bottom,
      scale,
      this.maxPanSpeed
    )

    if (panX === 0 && panY === 0) return

    this.ds.offset[0] -= panX
    this.ds.offset[1] -= panY

    this.onPan(panX, panY)
  }
}
