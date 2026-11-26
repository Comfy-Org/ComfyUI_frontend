import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { CanvasPointerEvent } from '@comfyorg/graph-model/events'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'

function toCanvasPointerEvent(
  click: MouseEvent | undefined,
  canvas: LGraphCanvas
): CanvasPointerEvent | undefined {
  if (!(click instanceof PointerEvent)) return undefined
  canvas.adjustMouseEvent(click)
  return click
}

/** Calls a button widget's callback with the arguments a canvas click passes: value, canvas, node, graph position, and event. */
export function invokeButtonWidgetCallback(
  widget: IBaseWidget,
  node: LGraphNode,
  canvas: LGraphCanvas | undefined,
  click?: MouseEvent
) {
  const e = canvas && toCanvasPointerEvent(click, canvas)
  const pos: [number, number] | undefined = e && [e.canvasX, e.canvasY]
  widget.callback?.(widget.value, canvas, node, pos, e)
}
