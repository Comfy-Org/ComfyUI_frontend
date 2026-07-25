import type { VirtualElement } from '@floating-ui/vue'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import type { NodeId } from '@/types/nodeId'

function nodeClientRect(nodeId: NodeId): DOMRect | null {
  const lgCanvas: LGraphCanvas | undefined = app.canvas
  const node = lgCanvas?.graph?.getNodeById(nodeId)
  if (!lgCanvas || !node) return null
  const [x, y, width, height] = node.boundingRect
  const { offset, scale } = lgCanvas.ds
  const host = lgCanvas.canvas.getBoundingClientRect()
  return new DOMRect(
    (x + offset[0]) * scale + host.left,
    (y + offset[1]) * scale + host.top,
    width * scale,
    height * scale
  )
}

/** A canvas node as a coachmark target; zero-sized until it is measurable. */
export function canvasNodeTarget(nodeId: NodeId): VirtualElement {
  return {
    getBoundingClientRect: () => nodeClientRect(nodeId) ?? new DOMRect()
  }
}

/** Union client rect of the given nodes; null when none resolve. */
export function canvasNodesRect(nodeIds: NodeId[]): DOMRect | null {
  const rects = nodeIds
    .map(nodeClientRect)
    .filter((r): r is DOMRect => r !== null)
  if (!rects.length) return null
  const left = Math.min(...rects.map((r) => r.left))
  const top = Math.min(...rects.map((r) => r.top))
  const right = Math.max(...rects.map((r) => r.right))
  const bottom = Math.max(...rects.map((r) => r.bottom))
  return new DOMRect(left, top, right - left, bottom - top)
}

/** True once the canvas camera transform can place canvas targets on screen. */
export function canvasTransformValid(): boolean {
  const lgCanvas: LGraphCanvas | undefined = app.canvas
  if (!lgCanvas) return false
  const { offset, scale } = lgCanvas.ds
  return (
    Number.isFinite(scale) &&
    scale > 0 &&
    Number.isFinite(offset[0]) &&
    Number.isFinite(offset[1])
  )
}
