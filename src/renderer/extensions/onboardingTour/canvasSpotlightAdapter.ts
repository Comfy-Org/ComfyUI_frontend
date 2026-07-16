import { createBounds } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { Point } from '@/lib/litegraph/src/interfaces'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import type { NodeId } from '@/types/nodeId'

/** The toolbar Run button (queue on desktop, subscribe-to-run on cloud). */
export const RUN_BUTTON_SELECTOR =
  '[data-testid="queue-button"], [data-testid="subscribe-to-run-button"]'

/** The floating action bar the Run button sits in. */
export const ACTIONBAR_SELECTOR = '[data-testid="comfy-actionbar"]'

/** A rectangle in client (viewport) coordinates. */
export interface ScreenRect {
  left: number
  top: number
  width: number
  height: number
}

interface Size {
  width: number
  height: number
}

/** Whether any part of `rect` is inside `viewport`. */
export function rectIntersectsViewport(
  rect: ScreenRect,
  viewport: ScreenRect
): boolean {
  return (
    rect.left < viewport.left + viewport.width &&
    rect.left + rect.width > viewport.left &&
    rect.top < viewport.top + viewport.height &&
    rect.top + rect.height > viewport.top
  )
}

/** Space between the coach-mark and the target it points at. */
export const COACH_MARK_GAP = 40

interface CanvasFrame {
  left: number
  top: number
  offset: [number, number]
  scale: number
}

/** Client-space origin + transform of the litegraph canvas, or null if absent. */
function canvasFrame(): CanvasFrame | null {
  const canvas = app.canvas
  if (!canvas) return null
  const rect = canvas.canvas.getBoundingClientRect()
  const { offset, scale } = canvas.ds
  return { left: rect.left, top: rect.top, offset, scale }
}

/**
 * The region the overlay may draw in: the canvas's client rect, not the window.
 * Measuring the canvas excludes the toolbar and panels without assuming their size.
 * Null when the canvas is absent or unlaid-out.
 */
export function canvasViewport(): ScreenRect | null {
  const canvas = app.canvas
  if (!canvas) return null
  const { left, top, width, height } = canvas.canvas.getBoundingClientRect()
  if (!(width > 0) || !(height > 0)) return null
  return { left, top, width, height }
}

function toClient(frame: CanvasFrame, [x, y]: Point): Point {
  return [
    frame.left + (x + frame.offset[0]) * frame.scale,
    frame.top + (y + frame.offset[1]) * frame.scale
  ]
}

/**
 * Whether the canvas has a usable transform yet — a finite positive scale and
 * finite offset. Used to gate the tour start until the just-loaded graph has
 * actually laid out, so the spotlight never paints against a stale/absent frame.
 */
export function canvasTransformValid(): boolean {
  const frame = canvasFrame()
  return (
    frame !== null &&
    Number.isFinite(frame.scale) &&
    frame.scale > 0 &&
    Number.isFinite(frame.offset[0]) &&
    Number.isFinite(frame.offset[1])
  )
}

/** A node's bounding box in client coordinates, or null if the canvas is absent. */
export function nodeClientRect(node: LGraphNode): ScreenRect | null {
  const frame = canvasFrame()
  if (!frame) return null
  const [bx, by, bw, bh] = node.boundingRect
  const [left, top] = toClient(frame, [bx, by])
  return { left, top, width: bw * frame.scale, height: bh * frame.scale }
}

function resolveNodes(nodeIds: NodeId[]): LGraphNode[] {
  const graph = useCanvasStore().currentGraph
  if (!graph) return []
  return nodeIds
    .map((id) => graph.getNodeById(id))
    .filter((node): node is LGraphNode => node != null)
}

/** Whether every id resolves to a node on the live graph (vacuously true if none). */
export function nodesPresent(nodeIds: NodeId[]): boolean {
  return resolveNodes(nodeIds).length === nodeIds.length
}

/** Client rects for the revealed nodes, hugging each node box; unresolvable ids are dropped. */
export function maskRectsFor(nodeIds: NodeId[]): ScreenRect[] {
  return resolveNodes(nodeIds)
    .map((node) => nodeClientRect(node))
    .filter((rect): rect is ScreenRect => rect !== null)
}

/** Duration of the tour's framing animation; bounds the overlay's wait for it. */
export const TOUR_FOCUS_DURATION_MS = 450

/** Never magnify past this: the aim is a node that reads, not one that dominates. */
const MAX_FOCUS_SCALE = 0.6

/**
 * The fill fraction that frames `bounds` with room left for a `reserve`-sized
 * coach-mark, in the units `animateToBounds` expects.
 *
 * The mark sits beside the node *or* below it, never both, so each arrangement is
 * costed separately and the roomier one wins. Deliberately unfloored: forcing a
 * minimum scale is what pushes a big node past the viewport and strands the mark.
 */
export function focusFillFor(
  bounds: Size,
  viewport: ScreenRect,
  reserve: Size
): number {
  const width = Math.max(bounds.width, 1)
  const height = Math.max(bounds.height, 1)
  const freeWidth = viewport.width - COACH_MARK_GAP * 2
  const freeHeight = viewport.height - COACH_MARK_GAP * 2

  const beside = Math.min(
    (freeWidth - reserve.width) / width,
    freeHeight / height
  )
  const below = Math.min(
    freeWidth / width,
    (freeHeight - reserve.height) / height
  )
  const scale = Math.min(Math.max(beside, below), MAX_FOCUS_SCALE)

  // Invert litegraph's fit: it takes scale = min(fillX, fillY), each solved as
  // (fill * side) / max(bound, 300). To land on `scale`, the binding (smaller)
  // axis must equal it — so take the larger of the two per-axis fills.
  return Math.max(
    (scale * Math.max(bounds.width, 300)) / viewport.width,
    (scale * Math.max(bounds.height, 300)) / viewport.height
  )
}

/**
 * Frame the view around the given nodes. No-op when none resolve.
 *
 * @param reserve Space to leave for the coach-mark. Omit to pan at the current
 * scale, so the tour zooms once and only pans after.
 */
export function focusNodes(nodeIds: NodeId[], reserve?: Size): void {
  const nodes = resolveNodes(nodeIds)
  if (nodes.length === 0) return
  const bounds = createBounds(nodes)
  if (!bounds) return

  const viewport = canvasViewport()
  const zoom =
    reserve && viewport
      ? focusFillFor({ width: bounds[2], height: bounds[3] }, viewport, reserve)
      : 0

  app.canvas?.animateToBounds(bounds, {
    zoom,
    duration: TOUR_FOCUS_DURATION_MS
  })
}

/** The canvas element, or null when it is absent — for observing its size. */
export function canvasElement(): HTMLCanvasElement | null {
  return app.canvas?.canvas ?? null
}

/** Consecutive identical frames that mean the camera has stopped. */
const SETTLE_FRAMES = 2

/** How many frames the transform has held still, and whether that means settled. */
export interface SettleState {
  key: string | null
  frames: number
  settled: boolean
}

export const INITIAL_SETTLE: SettleState = {
  key: null,
  frames: 0,
  settled: false
}

/**
 * Fold one frame's transform into the settle state. `animateToBounds` reports no
 * completion and cannot be cancelled, so an unchanged transform is the only honest
 * "camera stopped" signal. An absent transform counts as settled: no camera to wait for.
 */
export function trackSettle(
  state: SettleState,
  key: string | null
): SettleState {
  if (key === null) return { key, frames: 0, settled: true }
  if (key !== state.key) return { key, frames: 0, settled: false }
  const frames = state.frames + 1
  return { key, frames, settled: frames >= SETTLE_FRAMES }
}

/** The canvas transform as a comparable string, or null when the canvas is absent. */
export function canvasTransformKey(): string | null {
  const frame = canvasFrame()
  if (!frame) return null
  return `${frame.scale}:${frame.offset[0]}:${frame.offset[1]}`
}
