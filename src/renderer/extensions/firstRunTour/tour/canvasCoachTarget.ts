import type { VirtualElement } from '@floating-ui/vue'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import type { NodeId } from '@/types/nodeId'

/** Where a canvas node sits on screen; null until the render loop measures it. */
export function canvasNodeRect(nodeId: NodeId): DOMRect | null {
  const lgCanvas: LGraphCanvas | undefined = app.canvas
  const node = lgCanvas?.graph?.getNodeById(nodeId)
  if (!lgCanvas || !node) return null
  const [x, y, width, height] = node.boundingRect
  const { scale } = lgCanvas.ds
  const [left, top] = lgCanvas.ds.convertOffsetToCanvas([x, y])
  const host = lgCanvas.canvas.getBoundingClientRect()
  return new DOMRect(
    left + host.left,
    top + host.top,
    width * scale,
    height * scale
  )
}

/** A canvas node as a coachmark target; zero-sized until it is measurable. */
export function canvasNodeTarget(nodeId: NodeId): VirtualElement {
  return {
    getBoundingClientRect: () => canvasNodeRect(nodeId) ?? new DOMRect()
  }
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
