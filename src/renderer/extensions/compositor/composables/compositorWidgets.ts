import {
  nodeWidgetValue,
  setNodeWidgetValue
} from '@/composables/node/widgetStoreSync'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import {
  emptyCompositorWidgetValue,
  isCompositorWidgetValue
} from '@/renderer/extensions/compositor/components/types'
import type { CompositorWidgetValue } from '@/renderer/extensions/compositor/components/types'

export function setCompositorWidgetValue(
  node: LGraphNode,
  value: CompositorWidgetValue
): void {
  if (setNodeWidgetValue(node, 'compositor', value)) return
  const widget = node.widgets?.find((w) => w.name === 'compositor')
  if (widget) widget.value = value
}

export function getCompositorWidgetValue(
  node: LGraphNode
): CompositorWidgetValue | null {
  const value =
    nodeWidgetValue(node, 'compositor') ??
    node.widgets?.find((w) => w.name === 'compositor')?.value
  return isCompositorWidgetValue(value) ? value : null
}

export function resetCompositorStateWidgets(node: LGraphNode): void {
  setCompositorWidgetValue(node, emptyCompositorWidgetValue())
}
