import { createBounds } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { Point } from '@/lib/litegraph/src/interfaces'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import type { NodeId } from '@/types/nodeId'

/** The toolbar Run button (queue on desktop, subscribe-to-run on cloud). */
export const RUN_BUTTON_SELECTOR =
  '[data-testid="queue-button"], [data-testid="subscribe-to-run-button"]'

/** A rectangle in client (viewport) coordinates. */
export interface ScreenRect {
  left: number
  top: number
  width: number
  height: number
}

/** The box edge the cursor sits on, pointing back at the target. */
export type CoachMarkEdge = 'top' | 'bottom' | 'left' | 'right'

/** A viewport-space position for the coach-mark plus the edge that points at the target. */
export interface CoachMarkPosition {
  left: number
  top: number
  pointerEdge: CoachMarkEdge
}

interface Size {
  width: number
  height: number
}

const COACH_MARK_GAP = 40
const VIEWPORT_PADDING = 12

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function fitsViewport(pos: CoachMarkPosition, bubble: Size, viewport: Size) {
  return (
    pos.left >= VIEWPORT_PADDING &&
    pos.top >= VIEWPORT_PADDING &&
    pos.left + bubble.width <= viewport.width - VIEWPORT_PADDING &&
    pos.top + bubble.height <= viewport.height - VIEWPORT_PADDING
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

/**
 * Place the coach-mark near `target` without covering it: try below, above,
 * right, then left, and take the first placement that fits the viewport and does
 * not overlap the target. Falls back to a clamped below-position when the node is
 * so large none fit. Pure so it is testable across screen sizes without layout.
 */
export function coachMarkPosition(
  target: ScreenRect,
  bubble: Size,
  viewport: Size
): CoachMarkPosition {
  const centerX = target.left + target.width / 2 - bubble.width / 2
  const centerY = target.top + target.height / 2 - bubble.height / 2
  const candidates: CoachMarkPosition[] = [
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

  const placed = candidates.find(
    (pos) =>
      fitsViewport(pos, bubble, viewport) && !overlaps(pos, bubble, target)
  )
  if (placed) return placed

  return {
    left: clamp(
      centerX,
      VIEWPORT_PADDING,
      Math.max(
        VIEWPORT_PADDING,
        viewport.width - bubble.width - VIEWPORT_PADDING
      )
    ),
    top: clamp(
      target.top + target.height + COACH_MARK_GAP,
      VIEWPORT_PADDING,
      Math.max(
        VIEWPORT_PADDING,
        viewport.height - bubble.height - VIEWPORT_PADDING
      )
    ),
    pointerEdge: 'top'
  }
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
 * Duration of the tour's framing animation. The overlay waits this out before
 * revealing the highlight, so it lands on an element already in position rather
 * than tracking it mid-zoom.
 */
export const TOUR_FOCUS_DURATION_MS = 450

/** Viewport fill fraction for the framing zoom — higher makes the node larger. */
export const TOUR_ZOOM_FILL = 0.3

/**
 * Frame the view around the given nodes. `zoom` is the viewport fill fraction
 * (higher = node appears larger); pass 0 to pan to the nodes at the current
 * scale without re-zooming, so the view zooms in once and then only pans. Uses
 * the animated focus path (marks the canvas dirty for us); no-op when none resolve.
 */
export function focusNodes(
  nodeIds: NodeId[],
  zoom: number = TOUR_ZOOM_FILL
): void {
  const nodes = resolveNodes(nodeIds)
  if (nodes.length === 0) return
  const bounds = createBounds(nodes)
  if (!bounds) return
  app.canvas?.animateToBounds(bounds, {
    zoom,
    duration: TOUR_FOCUS_DURATION_MS
  })
}
