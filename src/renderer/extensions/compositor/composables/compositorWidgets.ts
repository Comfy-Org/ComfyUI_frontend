import {
  emptyCompositorWidgetValue,
  isCompositorWidgetValue
} from '@/renderer/extensions/compositor/components/types'
import type { CompositorWidgetValue } from '@/renderer/extensions/compositor/components/types'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

export function setCompositorWidgetValue(
  node: LGraphNode,
  value: CompositorWidgetValue
): void {
  const widget = node.widgets?.find((w) => w.name === 'compositor')
  if (!widget) return
  widget.value = value
  widget.callback?.(value)
  if (node.widgets_values && node.widgets) {
    const index = node.widgets.indexOf(widget)
    if (index >= 0) node.widgets_values[index] = value
  }
}

export function getCompositorWidgetValue(
  node: LGraphNode
): CompositorWidgetValue | null {
  const widget = node.widgets?.find((w) => w.name === 'compositor')
  return isCompositorWidgetValue(widget?.value) ? widget.value : null
}

export function resetCompositorStateWidgets(node: LGraphNode): void {
  setCompositorWidgetValue(node, emptyCompositorWidgetValue())
}
