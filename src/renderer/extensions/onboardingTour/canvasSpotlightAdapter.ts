import { createBounds } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { Point } from '@/lib/litegraph/src/interfaces'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import type { NodeId } from '@/types/nodeId'

/** A rectangle in client (viewport) coordinates. */
export interface ScreenRect {
  left: number
  top: number
  width: number
  height: number
}

/** Padding (client px, constant across zoom) added around each spotlit node. */
const MASK_PADDING = 10

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

/** A node's bounding box in client coordinates, or null if the canvas is absent. */
export function nodeClientRect(node: LGraphNode): ScreenRect | null {
  const frame = canvasFrame()
  if (!frame) return null
  const [bx, by, bw, bh] = node.boundingRect
  const [left, top] = toClient(frame, [bx, by])
  return { left, top, width: bw * frame.scale, height: bh * frame.scale }
}

/** Position of a node's input/output slot in client coordinates. */
export function portClientPos(
  node: LGraphNode,
  slot: number,
  isInput: boolean
): Point | null {
  const frame = canvasFrame()
  if (!frame) return null
  const pos = isInput ? node.getInputPos(slot) : node.getOutputPos(slot)
  return toClient(frame, pos)
}

function resolveNodes(nodeIds: NodeId[]): LGraphNode[] {
  const graph = useCanvasStore().currentGraph
  if (!graph) return []
  return nodeIds
    .map((id) => graph.getNodeById(id))
    .filter((node): node is LGraphNode => node !== null)
}

function padRect(rect: ScreenRect): ScreenRect {
  return {
    left: rect.left - MASK_PADDING,
    top: rect.top - MASK_PADDING,
    width: rect.width + MASK_PADDING * 2,
    height: rect.height + MASK_PADDING * 2
  }
}

/** Padded client rects for the revealed nodes; unresolvable ids are dropped. */
export function maskRectsFor(nodeIds: NodeId[]): ScreenRect[] {
  return resolveNodes(nodeIds)
    .map((node) => nodeClientRect(node))
    .filter((rect): rect is ScreenRect => rect !== null)
    .map(padRect)
}

/** Frame the view around the revealed nodes; no-op when none resolve. */
export function fitToBounds(nodeIds: NodeId[], zoom: number): void {
  const nodes = resolveNodes(nodeIds)
  if (nodes.length === 0) return
  const bounds = createBounds(nodes)
  if (!bounds) return
  app.canvas?.ds.fitToBounds(bounds, { zoom })
}
