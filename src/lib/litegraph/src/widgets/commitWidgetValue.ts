import type {
  LGraphCanvas,
  LGraphNode
} from '@comfyorg/graph-model/entityRegistry'
import type { CanvasPointerEvent } from '@comfyorg/graph-model/events'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import { extensionValue } from '@/lib/litegraph/src/utils/extensionValue'

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
  widget.value = v
  const property = extensionValue(widget.options)?.property
  if (property && node.properties[property] !== undefined) {
    node.setProperty(property, v)
  }
  widget.callback?.(widget.value, canvas, node, canvas?.graph_mouse, e)

  node.onWidgetChanged?.(extensionValue(widget.name) ?? '', v, oldValue, widget)
  if (node.graph) node.graph.incrementVersion()
}
