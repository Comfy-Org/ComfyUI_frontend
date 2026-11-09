import type {
  LGraphCanvas,
  LGraphNode
} from '@comfyorg/graph-model/entityRegistry'
import type { CanvasPointerEvent } from '@comfyorg/graph-model/events'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import { extensionValue } from '@/lib/litegraph/src/utils/extensionValue'

const committingWidgets = new WeakSet<IBaseWidget>()

export function isCommittingWidgetValue(widget: IBaseWidget): boolean {
  return committingWidgets.has(widget)
}

export interface WidgetValueCommitOptions {
  node: LGraphNode
  canvas?: LGraphCanvas
  e?: CanvasPointerEvent
}

export function commitWidgetValue(
  widget: IBaseWidget,
  value: IBaseWidget['value'],
  { e, node, canvas }: WidgetValueCommitOptions
): void {
  const oldValue = widget.value
  const isNumber = widget.type === 'number'
  const v = isNumber ? Number(value) : value
  if (v === oldValue || (isNumber && Number.isNaN(v))) return
  const wasCommitting = committingWidgets.has(widget)
  committingWidgets.add(widget)
  try {
    widget.value = v
    const property = extensionValue(widget.options)?.property
    if (property && node.properties[property] !== undefined) {
      node.setProperty(property, v)
    }
    committingWidgets.delete(widget)
    widget.callback?.(widget.value, canvas, node, canvas?.graph_mouse, e)

    node.onWidgetChanged?.(
      extensionValue(widget.name) ?? '',
      v,
      oldValue,
      widget
    )
    if (node.graph) node.graph.incrementVersion()
  } finally {
    if (wasCommitting) committingWidgets.add(widget)
    else committingWidgets.delete(widget)
  }
}
