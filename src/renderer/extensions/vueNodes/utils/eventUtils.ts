import type { LGraphCanvas } from '@comfyorg/litegraph/LGraphCanvas'
import type { LGraphNode } from '@comfyorg/litegraph/LGraphNode'
import type { CanvasPointerEvent } from '@comfyorg/graph-model/events'

export function augmentToCanvasPointerEvent(
  e: PointerEvent,
  node: LGraphNode,
  canvas: LGraphCanvas
): asserts e is CanvasPointerEvent {
  canvas.adjustMouseEvent(e)
  canvas.graph_mouse[0] = e.offsetX + node.pos[0]
  canvas.graph_mouse[1] = e.offsetY + node.pos[1]
}
