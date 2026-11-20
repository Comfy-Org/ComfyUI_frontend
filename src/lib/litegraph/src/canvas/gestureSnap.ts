import type {
  Bounds,
  CompassCorners,
  Point2D
} from '@comfyorg/shared-frontend-utils/geometry'
import type { LGraphCanvas } from '@comfyorg/graph-model/entityRegistry'
import type { Positionable } from '@comfyorg/graph-model/interfaces'

interface SnapStep {
  snapToGrid: boolean
}

export interface MoveSnap {
  offset(offsetFromStart: Point2D, step: SnapStep): Point2D
  stop(): void
}

export interface ResizeSnap {
  resize(bounds: Bounds, corner: CompassCorners, step: SnapStep): Bounds
  stop(): void
}

/** Supplies snapping for drag and resize gestures; `undefined` leaves a gesture unsnapped. */
export interface GestureSnapProvider {
  move(canvas: LGraphCanvas, items: Positionable[]): MoveSnap | undefined
  resize(canvas: LGraphCanvas, item: Positionable): ResizeSnap | undefined
}

const passthroughMove: MoveSnap = { offset: (raw) => raw, stop: () => {} }
const passthroughResize: ResizeSnap = {
  resize: (bounds) => bounds,
  stop: () => {}
}

let provider: GestureSnapProvider | undefined
let providerRegistration: symbol | undefined

/** Registers the gesture snap provider; returns a function that removes it. */
export function registerGestureSnapProvider(
  next: GestureSnapProvider
): () => void {
  if (provider && provider !== next) {
    console.error('A gesture snap provider is already registered')
    return () => {}
  }

  const registration = Symbol()
  provider = next
  providerRegistration = registration

  return () => {
    if (providerRegistration !== registration) return
    provider = undefined
    providerRegistration = undefined
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

interface IncrementalDrag {
  snap: MoveSnap
  raw: Point2D
  applied: Point2D
}

const incrementalDrags = new WeakMap<LGraphCanvas, IncrementalDrag>()

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

/** Restarts snapping from the items' current positions when the dragged set changes mid-drag. */
export function retargetIncrementalDragSnap(
  canvas: LGraphCanvas,
  items: Iterable<Positionable>
): void {
  const drag = incrementalDrags.get(canvas)
  if (!drag) return
  drag.snap.stop()
  incrementalDrags.set(canvas, {
    snap: startMoveSnap(canvas, items),
    raw: { x: drag.raw.x - drag.applied.x, y: drag.raw.y - drag.applied.y },
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
