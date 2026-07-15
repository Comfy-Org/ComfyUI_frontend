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

/** The box edge the cursor sits on, pointing back at the target. */
export type CoachMarkEdge = 'top' | 'bottom' | 'left' | 'right'

interface Size {
  width: number
  height: number
}

/** A viewport-space position for the coach-mark plus the edge that points at the target. */
export interface CoachMarkPosition {
  left: number
  top: number
  pointerEdge: CoachMarkEdge
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
const VIEWPORT_PADDING = 12

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function fitsViewport(
  pos: CoachMarkPosition,
  bubble: Size,
  viewport: ScreenRect
) {
  return (
    pos.left >= viewport.left + VIEWPORT_PADDING &&
    pos.top >= viewport.top + VIEWPORT_PADDING &&
    pos.left + bubble.width <=
      viewport.left + viewport.width - VIEWPORT_PADDING &&
    pos.top + bubble.height <= viewport.top + viewport.height - VIEWPORT_PADDING
  )
}

function overlaps(pos: CoachMarkPosition, bubble: Size, target: ScreenRect) {
  return (
    pos.left < target.left + target.width &&
    pos.left + bubble.width > target.left &&
    pos.top < target.top + target.height &&
    pos.top + bubble.height > target.top
  )
}

/** Pin a placement inside the padded viewport, so the mark is never cut off. */
function clampToViewport(
  pos: CoachMarkPosition,
  bubble: Size,
  viewport: ScreenRect
): CoachMarkPosition {
  const minLeft = viewport.left + VIEWPORT_PADDING
  const minTop = viewport.top + VIEWPORT_PADDING
  return {
    ...pos,
    left: clamp(
      pos.left,
      minLeft,
      Math.max(
        minLeft,
        viewport.left + viewport.width - bubble.width - VIEWPORT_PADDING
      )
    ),
    top: clamp(
      pos.top,
      minTop,
      Math.max(
        minTop,
        viewport.top + viewport.height - bubble.height - VIEWPORT_PADDING
      )
    )
  }
}

function candidatesFor(target: ScreenRect, bubble: Size): CoachMarkPosition[] {
  const centerX = target.left + target.width / 2 - bubble.width / 2
  const centerY = target.top + target.height / 2 - bubble.height / 2
  return [
    {
      left: centerX,
      top: target.top + target.height + COACH_MARK_GAP,
      pointerEdge: 'top'
    },
    {
      left: centerX,
      top: target.top - bubble.height - COACH_MARK_GAP,
      pointerEdge: 'bottom'
    },
    {
      left: target.left + target.width + COACH_MARK_GAP,
      top: centerY,
      pointerEdge: 'left'
    },
    {
      left: target.left - bubble.width - COACH_MARK_GAP,
      top: centerY,
      pointerEdge: 'right'
    }
  ]
}

/**
 * Place the coach-mark near `target` without covering it: try below, above,
 * right, then left, and take the first placement that fits the viewport and does
 * not overlap the target. The result is always clamped into the viewport, so the
 * mark stays fully on screen at any zoom, pan, or window size — including when
 * the target is larger than the viewport and no candidate fits.
 *
 * `preferredEdge` wins whenever it still fits. The mark is positioned every frame
 * with no transition (it rides the canvas rigidly), so an unpinned first-fit would
 * snap between edges mid-zoom as the target grows; holding the edge for the step's
 * duration keeps it put until that edge genuinely stops working.
 *
 * Pure, so it is testable across screen sizes without layout.
 */
export function coachMarkPosition(
  target: ScreenRect,
  bubble: Size,
  viewport: ScreenRect,
  preferredEdge?: CoachMarkEdge
): CoachMarkPosition {
  const candidates = candidatesFor(target, bubble)
  const viable = (pos: CoachMarkPosition) =>
    fitsViewport(pos, bubble, viewport) && !overlaps(pos, bubble, target)

  const preferred = candidates.find((pos) => pos.pointerEdge === preferredEdge)
  const placed =
    (preferred && viable(preferred) ? preferred : undefined) ??
    candidates.find(viable)
  if (placed) return placed

  // No candidate fits — the target is too big for the mark to sit clear of it (a
  // tall node leaves no room above or below, a wide one none to the sides). Take
  // the side with the most free space and pin the mark into the viewport there,
  // so it overlaps the target's edge rather than spilling off screen.
  return clampToViewport(
    candidates[freestEdgeIndex(target, viewport)],
    bubble,
    viewport
  )
}

/** Index into `candidatesFor`'s order (below, above, right, left) with most room. */
function freestEdgeIndex(target: ScreenRect, viewport: ScreenRect): number {
  const room = [
    viewport.top + viewport.height - (target.top + target.height), // below
    target.top - viewport.top, // above
    viewport.left + viewport.width - (target.left + target.width), // right
    target.left - viewport.left // left
  ]
  return room.indexOf(Math.max(...room))
}

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
 * The region the overlay may draw in: the canvas's own client rect, not the
 * window. The app lays the canvas out in a grid inset by the top/bottom/side
 * chrome, so this excludes the toolbar and panels by measuring them rather than
 * assuming their size — it stays correct when that chrome changes, and in modes
 * where the canvas is inset differently. Null when the canvas is absent.
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

/**
 * Duration of the tour's framing animation. The overlay waits for the camera to
 * stop moving rather than counting this out, but it bounds that wait.
 */
export const TOUR_FOCUS_DURATION_MS = 450

/** Never magnify past this: the aim is a node that reads, not one that dominates. */
const MAX_FOCUS_SCALE = 0.6

/**
 * The fill fraction that frames `bounds` with room left for a `reserve`-sized
 * coach-mark, in the units `animateToBounds` expects.
 *
 * Framing can't be one tuned number: litegraph derives the scale from whichever
 * axis binds, so a fixed fill zooms a tall node until it fills the height and
 * squeezes the mark off screen, while that same value leaves a small node distant.
 *
 * The mark sits beside the node *or* below it, never both, so each arrangement is
 * costed separately and the roomier one wins. Nothing floors the result — a node
 * too big to show whole is allowed to be small, because forcing a minimum scale is
 * what pushes it past the viewport and strands the mark in a corner.
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
 * Frame the view around the given nodes, sized so `reserve` worth of space is left
 * for the coach-mark beside them. Pass no `reserve` to pan to the nodes at the
 * current scale without re-zooming, so the tour zooms in once and only pans after.
 * Uses the animated focus path (marks the canvas dirty for us); no-op when none
 * resolve.
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

/**
 * The canvas transform as a comparable string, or null when the canvas is absent.
 * The overlay samples this per frame to tell when the camera has stopped moving:
 * `animateToBounds` reports no completion and cannot be cancelled, so an unchanged
 * transform is the only honest settle signal — it stays correct when two framing
 * tweens overlap, or when the user grabs the canvas mid-zoom.
 */
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
 * "camera stopped" signal — it stays correct when two framing tweens overlap or the
 * user grabs the canvas mid-zoom. An absent transform counts as settled: there is
 * no camera to wait for.
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

export function canvasTransformKey(): string | null {
  const frame = canvasFrame()
  if (!frame) return null
  return `${frame.scale}:${frame.offset[0]}:${frame.offset[1]}`
}
