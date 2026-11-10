import {
  getNodeWidgetValue,
  setNodeWidgetValue
} from '@/core/graph/widgets/nodeWidgetValues'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import {
  emptyCompositorWidgetValue,
  isCompositorWidgetValue
} from '@/renderer/extensions/layerEditor/compositor/widgetValue'
import type { CompositorWidgetValue } from '@/renderer/extensions/layerEditor/compositor/widgetValue'

const COMPOSITOR_WIDGET = 'compositor'

export function setCompositorWidgetValue(
  node: LGraphNode,
  value: CompositorWidgetValue
): void {
  setNodeWidgetValue(node, COMPOSITOR_WIDGET, value)
}

export function getCompositorWidgetValue(
  node: LGraphNode
): CompositorWidgetValue | null {
  const value = getNodeWidgetValue(node, COMPOSITOR_WIDGET)
  return isCompositorWidgetValue(value) ? value : null
}

export function resetCompositorStateWidgets(node: LGraphNode): void {
  setCompositorWidgetValue(node, emptyCompositorWidgetValue())
}
