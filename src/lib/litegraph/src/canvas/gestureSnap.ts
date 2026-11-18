import type {
  CompassCorners,
  Point2D
} from '@comfyorg/shared-frontend-utils/geometry'
import type { LGraphCanvas } from '@comfyorg/graph-model/entityRegistry'
import type { Positionable } from '@comfyorg/graph-model/interfaces'

/** A visual box in canvas units; `head` is the title band height above the body. */
export interface SnapBox {
  x: number
  y: number
  width: number
  height: number
  head: number
}

export interface ResizeEdges {
  x?: 'left' | 'right'
  y?: 'top' | 'bottom'
}

interface SnapStep {
  suspended: boolean
}

/** Snaps the offset of one drag gesture from its start. */
export interface MoveSnap {
  offset(raw: Point2D, step: SnapStep): Point2D
  stop(): void
}

/** Snaps the moving edges of one resize gesture. */
export interface ResizeSnap {
  resize(box: SnapBox, edges: ResizeEdges, step: SnapStep): SnapBox
  stop(): void
}

/** Supplies snapping for drag and resize gestures on a canvas. */
export interface GestureSnapProvider {
  move(canvas: LGraphCanvas, items: Positionable[]): MoveSnap
  resize(canvas: LGraphCanvas, item: Positionable): ResizeSnap
}

const passthroughMove: MoveSnap = { offset: (raw) => raw, stop: () => {} }
const passthroughResize: ResizeSnap = { resize: (box) => box, stop: () => {} }

let provider: GestureSnapProvider | undefined

/** Installs the gesture snap provider; returns a function that removes it. */
export function setGestureSnapProvider(next: GestureSnapProvider): () => void {
  provider = next
  return () => {
    if (provider === next) provider = undefined
  }
}

export function startMoveSnap(
  canvas: LGraphCanvas,
  items: Iterable<Positionable>
): MoveSnap {
  return provider?.move(canvas, [...items]) ?? passthroughMove
}

export function startResizeSnap(
  canvas: LGraphCanvas,
  item: Positionable
): ResizeSnap {
  return provider?.resize(canvas, item) ?? passthroughResize
}

/** The edges that move when resizing from a corner. */
export function resizeEdgesOf(corner: CompassCorners): ResizeEdges {
  return {
    x: corner.includes('W') ? 'left' : 'right',
    y: corner.includes('N') ? 'top' : 'bottom'
  }
}

interface IncrementalDrag {
  snap: MoveSnap
  raw: Point2D
  applied: Point2D
}

const incrementalDrags = new WeakMap<LGraphCanvas, IncrementalDrag>()

/** Begins snapping a drag that is applied as a series of relative steps. */
export function beginIncrementalDragSnap(
  canvas: LGraphCanvas,
  items: Iterable<Positionable>
): void {
  incrementalDrags.get(canvas)?.snap.stop()
  incrementalDrags.set(canvas, {
    snap: startMoveSnap(canvas, items),
    raw: { x: 0, y: 0 },
    applied: { x: 0, y: 0 }
  })
}

/** Converts a raw relative step into the step that lands on the snapped offset. */
export function snapIncrementalDragStep(
  canvas: LGraphCanvas,
  [deltaX, deltaY]: readonly [number, number],
  step: SnapStep
): [number, number] {
  const drag = incrementalDrags.get(canvas)
  if (!drag) return [deltaX, deltaY]
  drag.raw = { x: drag.raw.x + deltaX, y: drag.raw.y + deltaY }
  const next = drag.snap.offset(drag.raw, step)
  const snapped: [number, number] = [
    next.x - drag.applied.x,
    next.y - drag.applied.y
  ]
  drag.applied = next
  return snapped
}

export function endIncrementalDragSnap(canvas: LGraphCanvas): void {
  incrementalDrags.get(canvas)?.snap.stop()
  incrementalDrags.delete(canvas)
}
