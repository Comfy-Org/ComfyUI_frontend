import type { CanvasPointerEvent } from '@comfyorg/graph-model/events'

import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

export function augmentToCanvasPointerEvent(
  e: PointerEvent,
  node: LGraphNode,
  canvas: LGraphCanvas
): asserts e is CanvasPointerEvent {
  canvas.adjustMouseEvent(e)
  canvas.graph_mouse[0] = e.offsetX + node.pos[0]
  canvas.graph_mouse[1] = e.offsetY + node.pos[1]
}
