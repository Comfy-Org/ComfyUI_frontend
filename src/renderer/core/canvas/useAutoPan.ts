import { tryOnScopeDispose } from '@vueuse/core'

import type { DragAndScale } from '@/lib/litegraph/src/DragAndScale'
import { onCanvasFrame } from '@/lib/litegraph/src/canvas/canvasFrame'

const EDGE_THRESHOLD = 50
const STALL_LIMIT_MS = 50
const REFERENCE_FRAME_MS = 1000 / 60

interface AutoPanOptions {
  canvas: {
    canvas: HTMLCanvasElement
    ds: DragAndScale
  }
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
  private readonly canvas: AutoPanOptions['canvas']
  private readonly maxPanSpeed: number
  private readonly onPan: (dx: number, dy: number) => void
  private stopFrame: (() => void) | undefined
  private lastFrameTime = 0

  constructor(options: AutoPanOptions) {
    this.canvas = options.canvas
    this.maxPanSpeed = options.maxPanSpeed
    this.onPan = options.onPan
    tryOnScopeDispose(() => this.stop())
  }

  updatePointer(screenX: number, screenY: number) {
    this.pointerX = screenX
    this.pointerY = screenY
  }

  start() {
    if (this.stopFrame) return
    this.lastFrameTime = performance.now()
    this.stopFrame = onCanvasFrame(this.canvas, 'update', (frameIntervalMs) =>
      this.tick(frameIntervalMs)
    )
  }

  stop() {
    this.stopFrame?.()
    this.stopFrame = undefined
  }

  private tick(frameIntervalMs: number) {
    const { canvas, ds } = this.canvas
    const now = performance.now()
    const stallLimit = Math.max(STALL_LIMIT_MS, frameIntervalMs)
    const elapsed = Math.min(stallLimit, now - this.lastFrameTime)
    this.lastFrameTime = now
    const maxPanSpeed = (this.maxPanSpeed * elapsed) / REFERENCE_FRAME_MS
    const rect = canvas.getBoundingClientRect()
    const scale = ds.scale

    const panX = calculateEdgePanSpeed(
      this.pointerX,
      rect.left,
      rect.right,
      scale,
      maxPanSpeed
    )
    const panY = calculateEdgePanSpeed(
      this.pointerY,
      rect.top,
      rect.bottom,
      scale,
      maxPanSpeed
    )

    if (panX === 0 && panY === 0) return

    ds.offset[0] -= panX
    ds.offset[1] -= panY

    this.onPan(panX, panY)
  }
}
