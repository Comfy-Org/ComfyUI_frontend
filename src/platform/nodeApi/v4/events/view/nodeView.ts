import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type { CanvasSource } from '@/platform/nodeApi/v4/canvasSource'
import { boundsOnCanvas } from '@/platform/nodeApi/v4/nodeHandle'
import type { NodeHandles } from '@/platform/nodeApi/v4/nodeHandle'
import type { Bounds, NodeHandle } from '@/platform/nodeApi/v4/types'

type NodeView = Pick<NodeHandle, 'getScreenRect' | 'getSlotPosition'>

/** Where the node `handle` names and its slots are. */
export function nodeViewMembers(
  handle: object,
  nodes: NodeHandles,
  source: () => CanvasSource | undefined
): NodeView {
  const live = () => nodes.locator(handle)?.()
  return {
    getScreenRect() {
      const found = live()
      const canvas = source()?.canvas()
      if (!found || !canvas || found.graph !== canvas.graph) return undefined
      return onPage(canvas, boundsOnCanvas(found.node))
    },
    getSlotPosition(side, index) {
      checkSlot(side, index)
      const found = live()
      return found && slotPosition(found.node, side, index)
    }
  }
}

function onPage(
  canvas: NonNullable<ReturnType<CanvasSource['canvas']>>,
  bounds: Bounds
): Bounds {
  const { scale, offset } = canvas.ds
  const { left, top } = canvas.canvas.getBoundingClientRect()
  return Object.freeze({
    x: (bounds.x + offset[0]) * scale + left,
    y: (bounds.y + offset[1]) * scale + top,
    width: bounds.width * scale,
    height: bounds.height * scale
  })
}

function checkSlot(side: unknown, index: unknown): void {
  if (side !== 'input' && side !== 'output') {
    throw invalidArgument('getSlotPosition', "'input' or 'output'", side)
  }
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) {
    throw invalidArgument('getSlotPosition', 'a slot index', index)
  }
}

function slotPosition(
  node: LGraphNode,
  side: 'input' | 'output',
  index: number
): { readonly x: number; readonly y: number } | undefined {
  const slots = side === 'input' ? node.inputs : node.outputs
  if (index >= slots.length) return undefined
  const [x, y] =
    side === 'input' ? node.getInputPos(index) : node.getOutputPos(index)
  return Object.freeze({ x, y })
}
