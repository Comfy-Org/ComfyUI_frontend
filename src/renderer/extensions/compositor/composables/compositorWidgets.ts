import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import {
  emptyCompositorWidgetValue,
  isCompositorWidgetValue
} from '@/renderer/extensions/compositor/components/types'
import type { CompositorWidgetValue } from '@/renderer/extensions/compositor/components/types'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetId } from '@/types/widgetId'
import { widgetId } from '@/types/widgetId'

const COMPOSITOR_WIDGET = 'compositor'

function compositorWidgetId(node: LGraphNode): WidgetId | null {
  const graphId = node.graph?.rootGraph?.id
  return graphId ? widgetId(graphId, node.id, COMPOSITOR_WIDGET) : null
}

export function setCompositorWidgetValue(
  node: LGraphNode,
  value: CompositorWidgetValue
): void {
  const id = compositorWidgetId(node)
  if (id && useWidgetValueStore().setValue(id, value)) return
  const widget = node.widgets?.find((w) => w.name === COMPOSITOR_WIDGET)
  if (widget) widget.value = value
}

export function getCompositorWidgetValue(
  node: LGraphNode
): CompositorWidgetValue | null {
  const id = compositorWidgetId(node)
  const value =
    (id ? useWidgetValueStore().getWidget(id)?.value : undefined) ??
    node.widgets?.find((w) => w.name === COMPOSITOR_WIDGET)?.value
  return isCompositorWidgetValue(value) ? value : null
}

export function resetCompositorStateWidgets(node: LGraphNode): void {
  setCompositorWidgetValue(node, emptyCompositorWidgetValue())
}
